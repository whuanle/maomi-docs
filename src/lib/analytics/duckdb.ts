import fs from "node:fs/promises";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

/**
 * DuckDB 统计侧库（analytics sidecar）。
 *
 * 参考 kobato 的 infra/analytics/duckdb.ts：
 * - 一个文件、一个实例，writer + reader 两条连接：写（批量刷盘、DDL）与读（页面渲染、
 *   报表查询）互不排队，一次慢写不会阻塞 SSR。
 * - DDL 由调用方注入，infra 不持有业务表结构。
 * - 关闭时先 CHECKPOINT 把 WAL 折回主文件，再关连接。
 *
 * 单例挂 globalThis：Next 的路由与页面各自有独立模块图，模块级变量会被实例化多次，
 * 而 DuckDB 是单写者——同一文件被打开两次会直接报 "File is already open"。
 */

export interface AnalyticsHandle {
  instance: DuckDBInstance;
  /** 批量写入、DDL、迁移。 */
  writer: DuckDBConnection;
  /** 页面渲染与统计查询。 */
  reader: DuckDBConnection;
  dbPath: string;
  closed: boolean;
}

interface AnalyticsRuntime {
  handle: AnalyticsHandle | null;
  opening: Promise<AnalyticsHandle> | null;
  /** writer 连接上的语句串行链 */
  writeChain: Promise<unknown>;
  /** reader 连接上的语句串行链 */
  readChain: Promise<unknown>;
}

const RUNTIME_KEY = "__maomiDocsAnalyticsRuntime" as const;
const globalStore = globalThis as typeof globalThis & { [RUNTIME_KEY]?: AnalyticsRuntime };

const runtime: AnalyticsRuntime = (globalStore[RUNTIME_KEY] ??= {
  handle: null,
  opening: null,
  writeChain: Promise.resolve(),
  readChain: Promise.resolve(),
});

async function openAnalyticsDatabase(dbPath: string, ddl: readonly string[]): Promise<AnalyticsHandle> {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  // threads=1：文档站全是单行点查与大批量 upsert，串行执行器省掉线程池开销
  const instance = await DuckDBInstance.create(dbPath, { threads: "1" });
  const writer = await instance.connect();
  const reader = await instance.connect();

  for (const statement of ddl) {
    await writer.run(statement);
  }

  return { instance, writer, reader, dbPath, closed: false };
}

/**
 * 关闭：CHECKPOINT 折回 WAL → 关连接。重复调用安全。
 */
export async function closeAnalyticsDatabase(handle: AnalyticsHandle): Promise<void> {
  if (handle.closed) return;
  handle.closed = true;
  try {
    await handle.writer.run("CHECKPOINT");
  } catch {
    // WAL 会在下次打开时重放，这里失败不影响数据正确性
  }
  handle.writer.closeSync();
  handle.reader.closeSync();
  handle.instance.closeSync();
}

/**
 * 打开（或复用）侧库。初始化失败时清空缓存的 promise，下次调用重试。
 */
export function getAnalyticsHandle(dbPath: string, ddl: readonly string[]): Promise<AnalyticsHandle> {
  if (runtime.handle && !runtime.handle.closed) {
    return Promise.resolve(runtime.handle);
  }
  if (!runtime.opening) {
    runtime.opening = openAnalyticsDatabase(dbPath, ddl)
      .then((handle) => {
        runtime.handle = handle;
        return handle;
      })
      .catch((err) => {
        runtime.opening = null;
        throw err;
      });
  }
  return runtime.opening;
}

/** 在 writer 连接上串行执行（写操作之间不交错）。 */
export function runWithWriter<T>(
  dbPath: string,
  ddl: readonly string[],
  task: (conn: DuckDBConnection) => Promise<T>,
): Promise<T> {
  const run = runtime.writeChain.then(async () => task((await getAnalyticsHandle(dbPath, ddl)).writer));
  runtime.writeChain = run.catch(() => {});
  return run;
}

/** 在 reader 连接上串行执行（读操作不排在任何写后面）。 */
export function runWithReader<T>(
  dbPath: string,
  ddl: readonly string[],
  task: (conn: DuckDBConnection) => Promise<T>,
): Promise<T> {
  const run = runtime.readChain.then(async () => task((await getAnalyticsHandle(dbPath, ddl)).reader));
  runtime.readChain = run.catch(() => {});
  return run;
}

/** 当前句柄（可能尚未打开）。 */
export function peekAnalyticsHandle(): AnalyticsHandle | null {
  return runtime.handle;
}
