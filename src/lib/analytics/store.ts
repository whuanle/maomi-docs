import fs from "node:fs/promises";
import path from "node:path";
import { ANALYTICS_DDL } from "./schema";
import { CounterBatcher } from "./batcher";
import {
  closeAnalyticsDatabase,
  getAnalyticsHandle,
  peekAnalyticsHandle,
  runWithReader,
  runWithWriter,
} from "./duckdb";

/**
 * 文档访问统计的读写层。
 *
 * 写入路径（参考 kobato 的 pv-batcher）：
 * - 阅读量先进内存计数 Map，按 5s / 50 条触发一次批量 upsert，
 *   把 N 次事务合并成 1 次，避开每来一个访问就 fsync 一次。
 * - 点赞是低频的显式动作，直接写库并返回最新值，保证点了就落盘。
 * - 读取 = 库里的值 + 尚未落库的增量，所以页面上的数字始终是精确的。
 *
 * 首次启动时若表为空且存在旧版 stats.json，自动迁移（原文件保留作备份）。
 */

// 统计库目录可独立挂载：文档内容本身可以只读挂载，只有这个目录需要写权限。
// 默认仍放在 docs/.stats 下，保持单机/开发环境零配置。
const statsRoot = process.env.STATS_DIR
  ? path.resolve(process.env.STATS_DIR)
  : path.join(process.cwd(), "docs", ".stats");
const dbPath = path.join(statsRoot, "stats.duckdb");
const legacyJsonPath = path.join(statsRoot, "stats.json");

// 刷盘节奏：文档站访问稀疏，5s 的延迟感知不到，又能显著减少写放大
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 50;

// 阅读去重窗口：同一访客在窗口内重复刷新同一篇文档只计一次，0 表示关闭去重
const DEFAULT_VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const VIEW_DEDUPE_MAX_ENTRIES = 20_000;

export interface StatsSnapshot {
  view: number;
  like: number;
}

interface StatsRuntime {
  viewBatcher: CounterBatcher;
  dailyBatcher: CounterBatcher;
  ready: Promise<void> | null;
  shutdownRegistered: boolean;
}

const RUNTIME_KEY = "__maomiDocsStatsRuntime" as const;
const globalStore = globalThis as typeof globalThis & { [RUNTIME_KEY]?: StatsRuntime };

function getRuntime(): StatsRuntime {
  const existing = globalStore[RUNTIME_KEY];
  if (existing) return existing;

  const created: StatsRuntime = {
    viewBatcher: new CounterBatcher({
      flushIntervalMs: FLUSH_INTERVAL_MS,
      flushThreshold: FLUSH_THRESHOLD,
      write: (deltas) => upsertDocViews(deltas),
      onError: (error) => console.error("[stats] 阅读量批量落库失败，已合并回缓冲区重试:", error),
    }),
    dailyBatcher: new CounterBatcher({
      flushIntervalMs: FLUSH_INTERVAL_MS,
      flushThreshold: FLUSH_THRESHOLD,
      write: (deltas) => upsertDailyViews(deltas),
      onError: (error) => console.error("[stats] 每日阅读量批量落库失败，已合并回缓冲区重试:", error),
    }),
    ready: null,
    shutdownRegistered: false,
  };
  globalStore[RUNTIME_KEY] = created;
  return created;
}

const runtime = getRuntime();

function buildPlaceholders(rowCount: number, columnsPerRow: number): string {
  return Array.from({ length: rowCount }, () => `(${Array.from({ length: columnsPerRow }, () => "?").join(", ")})`).join(", ");
}

/**
 * 累计阅读量：一次 INSERT 多行 + 冲突时把增量加到原值上。
 */
async function upsertDocViews(deltas: Map<string, number>): Promise<void> {
  const entries = [...deltas];
  if (entries.length === 0) return;

  await runWithWriter(dbPath, ANALYTICS_DDL, async (conn) => {
    await conn.run(
      `INSERT INTO doc_stats (doc_path, views, likes) VALUES ${buildPlaceholders(entries.length, 3)}
       ON CONFLICT (doc_path) DO UPDATE SET views = doc_stats.views + excluded.views`,
      entries.flatMap(([docPath, delta]) => [docPath, delta, 0]),
    );
  });
}

/**
 * 每日阅读量：key 拆成 (doc_path, day) 两列。
 */
async function upsertDailyViews(deltas: Map<string, number>): Promise<void> {
  const entries = [...deltas];
  if (entries.length === 0) return;

  const rows = entries.map(([key, delta]) => {
    const [docPath, day] = key.split("\u0000");
    return [docPath, day, delta];
  });

  await runWithWriter(dbPath, ANALYTICS_DDL, async (conn) => {
    await conn.run(
      `INSERT INTO doc_daily_views (doc_path, day, views) VALUES ${buildPlaceholders(rows.length, 3)}
       ON CONFLICT (doc_path, day) DO UPDATE SET views = doc_daily_views.views + excluded.views`,
      rows.flat(),
    );
  });
}

async function migrateLegacyJson(): Promise<void> {
  try {
    await runWithWriter(dbPath, ANALYTICS_DDL, async (conn) => {
      const countReader = await conn.runAndReadAll(`SELECT COUNT(*) AS n FROM doc_stats`);
      if (Number(countReader.getRowObjectsJson()[0]?.n ?? 0) > 0) return;

      const content = await fs.readFile(legacyJsonPath, "utf8").catch(() => null);
      if (content === null) return;

      const parsed = JSON.parse(content) as Record<string, { view?: unknown; like?: unknown }>;
      const rows: (string | number)[][] = [];
      for (const [docPath, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object") continue;
        const view = Number(value.view);
        const like = Number(value.like);
        rows.push([
          docPath,
          Number.isFinite(view) && view > 0 ? Math.trunc(view) : 0,
          Number.isFinite(like) && like > 0 ? Math.trunc(like) : 0,
        ]);
      }
      if (rows.length === 0) return;

      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await conn.run(
          `INSERT INTO doc_stats (doc_path, views, likes) VALUES ${buildPlaceholders(batch.length, 3)}
           ON CONFLICT (doc_path) DO NOTHING`,
          batch.flat(),
        );
      }
      console.log(`[stats] 已从 stats.json 迁移 ${rows.length} 条历史数据到 DuckDB`);
    });
  } catch (err) {
    console.warn("[stats] 迁移旧 stats.json 失败（忽略，从空表开始）:", err);
  }
}

/**
 * 确保侧库已打开且历史数据已迁移。多个模块实例共享同一个 promise。
 */
function ensureReady(): Promise<void> {
  if (!runtime.ready) {
    runtime.ready = (async () => {
      registerShutdown(runtime);
      await getAnalyticsHandle(dbPath, ANALYTICS_DDL);
      await migrateLegacyJson();
    })().catch((err) => {
      runtime.ready = null;
      throw err;
    });
  }
  return runtime.ready;
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 阅读去重的内存窗口。
 *
 * 只挡"按 F5 刷阅读量"这类低成本刷法：同一 viewerKey 在窗口内重复访问不再累加。
 * 用内存而非落库，是因为阅读量本身允许有误差，不值得为它付一次写事务；
 * 进程重启后窗口清空，最多多算一次。
 */
const recentViews = new Map<string, number>();

function getViewDedupeWindowMs() {
  const raw = Number(process.env.VIEW_DEDUPE_WINDOW_MS);
  if (!Number.isFinite(raw) || raw < 0) {
    return DEFAULT_VIEW_DEDUPE_WINDOW_MS;
  }
  return raw;
}

function shouldCountView(key: string) {
  const windowMs = getViewDedupeWindowMs();
  if (windowMs <= 0) {
    return true;
  }

  const now = Date.now();
  const expiresAt = recentViews.get(key);
  if (expiresAt !== undefined && expiresAt > now) {
    return false;
  }

  recentViews.set(key, now + windowMs);

  if (recentViews.size > VIEW_DEDUPE_MAX_ENTRIES) {
    for (const [entryKey, entryExpiresAt] of recentViews) {
      if (entryExpiresAt <= now) {
        recentViews.delete(entryKey);
      }
    }

    // 全是未过期条目说明正在被批量刷，直接丢掉窗口重新开始，避免内存无上限增长
    if (recentViews.size > VIEW_DEDUPE_MAX_ENTRIES * 1.2) {
      recentViews.clear();
    }
  }

  return true;
}

/**
 * 记录一次阅读：进内存缓冲区，累计与当日两份计数同时 +1。
 * 返回的数值已合并未落库的增量。
 */
export async function recordView(docPath: string, viewerKey: string): Promise<StatsSnapshot> {
  if (shouldCountView(`${docPath}\u0000${viewerKey}`)) {
    runtime.viewBatcher.increment(docPath);
    runtime.dailyBatcher.increment(`${docPath}\u0000${getTodayKey()}`);
  }
  return getStats(docPath);
}

/**
 * 记录一次点赞：直接写库（低频动作，保证点了就落盘），返回最新快照。
 *
 * voterKey 相同的点赞每天只生效一次，由 doc_like_votes 的主键保证——
 * 重复投票时 INSERT ... ON CONFLICT DO NOTHING 不返回行，计数保持不变。
 */
export async function recordLike(docPath: string, voterKey: string): Promise<StatsSnapshot> {
  await ensureReady();
  const today = getTodayKey();

  const snapshot = await runWithWriter(dbPath, ANALYTICS_DDL, async (conn) => {
    const voteResult = await conn.runAndReadAll(
      `INSERT INTO doc_like_votes (doc_path, voter_key, day) VALUES (?, ?, CAST(? AS DATE))
       ON CONFLICT DO NOTHING
       RETURNING 1 AS inserted`,
      [docPath, voterKey, today],
    );

    const isNewVote = voteResult.getRowObjectsJson().length > 0;

    const reader = isNewVote
      ? await conn.runAndReadAll(
          `INSERT INTO doc_stats (doc_path, views, likes) VALUES (?, 0, 1)
           ON CONFLICT (doc_path) DO UPDATE SET likes = doc_stats.likes + 1
           RETURNING views, likes`,
          [docPath],
        )
      : await conn.runAndReadAll(
          `SELECT views, likes FROM doc_stats WHERE doc_path = ?`,
          [docPath],
        );

    const row = reader.getRowObjectsJson()[0];
    return { view: Number(row?.views ?? 0), like: Number(row?.likes ?? 0) };
  });

  // 库里还没合并进缓冲的阅读增量，一并加上，避免点赞后数字回退
  return { view: snapshot.view + runtime.viewBatcher.pendingDelta(docPath), like: snapshot.like };
}

/**
 * 读取某篇文档的统计快照。失败时返回零值，不阻塞页面渲染。
 */
export async function getStats(docPath: string): Promise<StatsSnapshot> {
  try {
    await ensureReady();
    const base = await runWithReader(dbPath, ANALYTICS_DDL, async (conn) => {
      const reader = await conn.runAndReadAll(
        `SELECT views, likes FROM doc_stats WHERE doc_path = ?`,
        [docPath],
      );
      const row = reader.getRowObjectsJson()[0];
      return { view: Number(row?.views ?? 0), like: Number(row?.likes ?? 0) };
    });
    return { view: base.view + runtime.viewBatcher.pendingDelta(docPath), like: base.like };
  } catch (err) {
    console.error("[stats] 读取统计失败:", err);
    return { view: 0, like: 0 };
  }
}

/**
 * 退出前把缓冲写完并 CHECKPOINT 关库。
 * WAL 本身保证崩溃时不丢已提交数据，这里只是让退出更干净（也确认不丢未落库增量）。
 */
function registerShutdown(target: StatsRuntime): void {
  if (target.shutdownRegistered) return;
  target.shutdownRegistered = true;

  let running = false;
  const shutdown = () => {
    if (running) return;
    running = true;
    void (async () => {
      await Promise.allSettled([
        target.viewBatcher.flushForShutdown(),
        target.dailyBatcher.flushForShutdown(),
      ]);
      const handle = peekAnalyticsHandle();
      if (handle) await closeAnalyticsDatabase(handle);
    })();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  process.once("beforeExit", shutdown);
}
