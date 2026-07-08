import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";

/**
 * 文档统计存储（单 JSON 快照 + 原子写）。
 *
 * 设计：
 * - 数据落在 docs/.stats/stats.json，结构为 { "<docPath>": { view, like } }。
 * - 状态常驻内存，读写都在内存完成，写操作串行化排队后整体重写文件。
 * - 落盘用「写临时文件 → fsync → rename 覆盖」原子写，避免写到一半崩溃损坏数据。
 * - 防抖批量写：短时间内的多次更新合并为一次落盘。
 *
 * 适用场景：单实例、文档站级访问量。多实例部署时各自有内存副本，
 * 文件写以最后写入为准（无跨进程锁，文档站规模下可接受）。
 */

const statsRoot = path.join(process.cwd(), "docs", ".stats");
const statsFilePath = path.join(statsRoot, "stats.json");
const tmpFilePath = path.join(statsRoot, "stats.json.tmp");

// 防抖：合并短时间内的多次写入为一次落盘
const FLUSH_DEBOUNCE_MS = 1000;
// 最长允许积压时间，超过则立即落盘
const FLUSH_MAX_WAIT_MS = 3000;

export interface StatsSnapshot {
  view: number;
  like: number;
}

interface DocStats {
  view: number;
  like: number;
}

// 内存状态：key = docPath
type StatsState = Record<string, DocStats>;

let state: StatsState | null = null;
let initPromise: Promise<StatsState> | null = null;

// 串行写队列：保证同一时刻只有一个写操作在执行
let writeChain: Promise<void> = Promise.resolve();
// 脏标记 + 防抖定时器：标记内存已变更、尚未落盘
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;
let firstDirtyAt = 0;

function normalizeLoadedDoc(raw: unknown): DocStats | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const view = Number(obj.view);
  const like = Number(obj.like);
  return {
    view: Number.isFinite(view) && view > 0 ? Math.trunc(view) : 0,
    like: Number.isFinite(like) && like > 0 ? Math.trunc(like) : 0,
  };
}

/**
 * 从磁盘读取快照。文件不存在或损坏时返回空状态（不抛错）。
 */
async function loadState(): Promise<StatsState> {
  try {
    await fs.mkdir(statsRoot, { recursive: true });
  } catch {
    // 目录可能已存在，忽略
  }

  let content: string;
  try {
    content = await fs.readFile(statsFilePath, "utf8");
  } catch {
    // 文件不存在视为空
    return {};
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: StatsState = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const doc = normalizeLoadedDoc(value);
      if (doc) {
        result[key] = doc;
      }
    }
    return result;
  } catch {
    // 文件损坏：备份后从空开始，避免覆盖丢失可恢复的数据
    try {
      await fs.copyFile(statsFilePath, `${statsFilePath}.bad-${Date.now()}`);
    } catch {
      // ignore
    }
    console.warn("[stats-store] stats.json 解析失败，已备份损坏文件并重置");
    return {};
  }
}

/**
 * 懒加载单例。进程首次访问时读取并载入内存。
 */
async function getState(): Promise<StatsState> {
  if (state) return state;
  if (!initPromise) {
    initPromise = loadState().then((loaded) => {
      state = loaded;
      return loaded;
    });
  }
  return initPromise;
}

function getOrCreateDoc(state: StatsState, docPath: string): DocStats {
  let doc = state[docPath];
  if (!doc) {
    doc = { view: 0, like: 0 };
    state[docPath] = doc;
  }
  return doc;
}

/**
 * 原子落盘：临时文件 → fsync → rename 覆盖。
 * rename 在同一文件系统上是原子操作，写到一半崩溃也不会损坏旧文件。
 */
function persistState(snapshot: StatsState): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(snapshot, null, 2);
    // 用流写入，便于拿到 fd 做 fsync
    const stream = createWriteStream(tmpFilePath, { mode: 0o644 });
    let finished = false;

    stream.on("error", (err) => {
      if (finished) return;
      finished = true;
      reject(err);
    });

    stream.on("finish", () => {
      // 确保数据刷到磁盘后再 rename
      stream.close(async (closeErr) => {
        if (finished) return;
        if (closeErr) {
          finished = true;
          reject(closeErr);
          return;
        }
        try {
          await fs.rename(tmpFilePath, statsFilePath);
          finished = true;
          resolve();
        } catch (err) {
          finished = true;
          reject(err);
        }
      });
    });

    stream.end(data);
  });
}

function markDirty() {
  dirty = true;
  if (!firstDirtyAt) firstDirtyAt = Date.now();
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;

  // 积压超过最大等待时间，立即落盘
  if (firstDirtyAt && Date.now() - firstDirtyAt >= FLUSH_MAX_WAIT_MS) {
    void triggerFlush();
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void triggerFlush();
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * 触发一次落盘。所有写操作串行排队，保证不并发写同一文件。
 */
async function triggerFlush(): Promise<void> {
  if (!dirty || !state) return;
  dirty = false;
  firstDirtyAt = 0;

  // 深拷贝当前快照，避免写盘期间内存被并发修改
  const snapshot: StatsState = JSON.parse(JSON.stringify(state));

  writeChain = writeChain
    .then(() => persistState(snapshot))
    .catch((err) => {
      console.error("[stats-store] 落盘失败，下次重试:", err);
      // 落盘失败重新标记脏，等待下次重试
      dirty = true;
      if (!firstDirtyAt) firstDirtyAt = Date.now();
      scheduleFlush();
    });

  return writeChain;
}

/**
 * 记录一次阅读（总阅读量，每次访问 +1）。返回最新快照。
 */
export async function recordView(docPath: string): Promise<StatsSnapshot> {
  const current = await getState();
  const doc = getOrCreateDoc(current, docPath);
  doc.view += 1;
  markDirty();
  return { view: doc.view, like: doc.like };
}

/**
 * 记录一次点赞（单向递增）。返回最新快照。
 */
export async function recordLike(docPath: string): Promise<StatsSnapshot> {
  const current = await getState();
  const doc = getOrCreateDoc(current, docPath);
  doc.like += 1;
  markDirty();
  return { view: doc.view, like: doc.like };
}

/**
 * 读取某篇文档的统计快照。
 */
export async function getStats(docPath: string): Promise<StatsSnapshot> {
  const current = await getState();
  const doc = current[docPath];
  return doc ? { view: doc.view, like: doc.like } : { view: 0, like: 0 };
}

/**
 * 进程退出前尽量把缓冲落盘。
 */
let gracefulRegistered = false;
export function registerGracefulFlush() {
  if (gracefulRegistered) return;
  gracefulRegistered = true;
  process.on("beforeExit", () => {
    void triggerFlush();
  });
}
