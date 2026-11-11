/**
 * 批量刷盘骨架（参考 kobato 的 infra/db/insert-batcher.ts）。
 *
 * 目标：把高频的计数写入先在内存里累加，按「时间间隔」或「累计条数」触发一次落库，
 * 把 N 次 fsync 合并成 1 次；同时提供 pendingDelta() 让读取方把未落库的增量加回去，
 * 对外仍是一个精确的数字。
 *
 * 关键细节（都是被别人踩过的坑）：
 * - 定时器 unref()：不让进程因为一个待刷盘的批量任务而无法退出，空闲时也不占 CPU。
 * - 单飞（singleflight）drain：刷盘期间到达的新增量不会被丢弃，drain 会一直取到空。
 * - 失败合并回缓冲区：写失败不丢计数，等下一轮重试。
 */

export interface CounterBatcherOptions {
  /** 触发刷盘的时间间隔（毫秒）。 */
  flushIntervalMs: number;
  /** 缓冲内累计条数达到该值立即刷盘。 */
  flushThreshold: number;
  /** 把一批增量写入存储。 */
  write: (deltas: Map<string, number>) => Promise<void>;
  /** 失败回调，便于记录日志。 */
  onError?: (error: unknown, deltas: Map<string, number>) => void;
}

export class CounterBatcher {
  private buffer = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;
  private paused = false;

  constructor(private readonly options: CounterBatcherOptions) {}

  /** 累加一次。达到阈值立即刷盘，否则安排一次延迟刷盘。 */
  increment(key: string, delta = 1): void {
    this.buffer.set(key, (this.buffer.get(key) ?? 0) + delta);

    if (this.buffer.size >= this.options.flushThreshold) {
      void this.flush();
      return;
    }
    this.armFlushTimer();
  }

  /** 某 key 尚未落库的增量——读取时合并用，不会把缓冲取走。 */
  pendingDelta(key: string): number {
    return this.buffer.get(key) ?? 0;
  }

  armFlushTimer(): void {
    if (this.paused || this.timer !== null) return;
    this.timer = setTimeout(() => {
      // 先清空句柄再刷盘：残留句柄会让后续 arm 永久失效
      this.timer = null;
      void this.flush();
    }, this.options.flushIntervalMs);
    this.timer.unref();
  }

  /** 单飞刷盘：已有刷盘在跑时直接复用，返回同一个 Promise。 */
  flush(): Promise<void> {
    if (this.paused) return Promise.resolve();
    return this.drain();
  }

  /** 进程退出前调用：无视暂停标记，把剩余增量写完。 */
  flushForShutdown(): Promise<void> {
    this.paused = false;
    return this.drain();
  }

  private drain(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = this.takePending();
    if (pending === null) return Promise.resolve();

    this.flushing = (async () => {
      let current = pending;
      try {
        for (;;) {
          try {
            await this.options.write(current);
          } catch (error) {
            this.mergeBack(current);
            this.options.onError?.(error, current);
            // 失败的批次已合并回缓冲区，重新安排一次刷盘，避免就此停摆
            this.armFlushTimer();
            return;
          }
          // 刷盘期间到达的增量没有定时器，这里继续取直到取空
          const more = this.takePending();
          if (more === null) return;
          current = more;
        }
      } finally {
        this.flushing = null;
      }
    })();

    return this.flushing;
  }

  private takePending(): Map<string, number> | null {
    if (this.buffer.size === 0) return null;
    const snapshot = this.buffer;
    this.buffer = new Map();
    return snapshot;
  }

  private mergeBack(deltas: Map<string, number>): void {
    for (const [key, delta] of deltas) {
      this.buffer.set(key, (this.buffer.get(key) ?? 0) + delta);
    }
  }
}
