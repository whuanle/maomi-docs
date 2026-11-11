const DEFAULT_MCP_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_MCP_RATE_LIMIT_MAX_REQUESTS = 30;
const DEFAULT_SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_SEARCH_RATE_LIMIT_MAX_REQUESTS = 90;
const DEFAULT_SEARCH_MAX_CONCURRENT = 4;
const DEFAULT_STATS_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_STATS_RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_LLM_RATE_LIMIT_WINDOW_MS = 60_000;
// llms.txt / llms-full.txt 是全量文档导出，每次未命中缓存的请求都要扫盘拼正文，
// 阈值比普通接口紧得多
const DEFAULT_LLM_RATE_LIMIT_MAX_REQUESTS = 20;

/** 反向代理层数，用于从 X-Forwarded-For 右侧取值。部署形态变化时用环境变量覆盖。 */
const DEFAULT_TRUSTED_PROXY_HOPS = 1;

const MAX_IP_LENGTH = 64;

type RateLimitSnapshot = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

class FixedWindowRateLimiter {
  private readonly store = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  check(key: string): RateLimitSnapshot {
    const now = Date.now();
    const current = this.store.get(key);
    const expired = !current || current.resetAt <= now;
    const next = expired
      ? { count: 1, resetAt: now + this.windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };

    this.store.set(key, next);

    if (this.store.size > 5_000) {
      this.cleanup(now);
    }

    const remaining = Math.max(0, this.maxRequests - next.count);

    return {
      allowed: next.count <= this.maxRequests,
      limit: this.maxRequests,
      remaining,
      resetAt: next.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((next.resetAt - now) / 1000)),
    };
  }

  private cleanup(now: number) {
    for (const [key, value] of this.store) {
      if (value.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

class ConcurrencyGuard {
  private active = 0;

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(task: () => Promise<T>) {
    if (this.active >= this.maxConcurrent) {
      throw new ServerBusyError();
    }

    this.active += 1;

    try {
      return await task();
    } finally {
      this.active -= 1;
    }
  }
}

export class ServerBusyError extends Error {
  constructor() {
    super("Server is busy");
    this.name = "ServerBusyError";
  }
}

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "RequestBodyTooLargeError";
  }
}

const mcpRateLimiter = new FixedWindowRateLimiter(
  getEnvNumber("MCP_RATE_LIMIT_WINDOW_MS", DEFAULT_MCP_RATE_LIMIT_WINDOW_MS),
  getEnvNumber("MCP_RATE_LIMIT_MAX_REQUESTS", DEFAULT_MCP_RATE_LIMIT_MAX_REQUESTS),
);
const searchRateLimiter = new FixedWindowRateLimiter(
  getEnvNumber("SEARCH_RATE_LIMIT_WINDOW_MS", DEFAULT_SEARCH_RATE_LIMIT_WINDOW_MS),
  getEnvNumber("SEARCH_RATE_LIMIT_MAX_REQUESTS", DEFAULT_SEARCH_RATE_LIMIT_MAX_REQUESTS),
);
const searchConcurrencyGuard = new ConcurrencyGuard(
  getEnvNumber("SEARCH_MAX_CONCURRENT_REQUESTS", DEFAULT_SEARCH_MAX_CONCURRENT),
);
const statsRateLimiter = new FixedWindowRateLimiter(
  getEnvNumber("STATS_RATE_LIMIT_WINDOW_MS", DEFAULT_STATS_RATE_LIMIT_WINDOW_MS),
  getEnvNumber("STATS_RATE_LIMIT_MAX_REQUESTS", DEFAULT_STATS_RATE_LIMIT_MAX_REQUESTS),
);
const llmRateLimiter = new FixedWindowRateLimiter(
  getEnvNumber("LLM_RATE_LIMIT_WINDOW_MS", DEFAULT_LLM_RATE_LIMIT_WINDOW_MS),
  getEnvNumber("LLM_RATE_LIMIT_MAX_REQUESTS", DEFAULT_LLM_RATE_LIMIT_MAX_REQUESTS),
);

export function checkMcpRateLimit(clientIp: string) {
  return mcpRateLimiter.check(`mcp:${clientIp}`);
}

export function checkSearchRateLimit(clientIp: string) {
  return searchRateLimiter.check(`search:${clientIp}`);
}

export function checkStatsRateLimit(clientIp: string) {
  return statsRateLimiter.check(`stats:${clientIp}`);
}

export function checkLlmRateLimit(clientIp: string) {
  return llmRateLimiter.check(`llm:${clientIp}`);
}

export async function runSearchTask<T>(task: () => Promise<T>) {
  return searchConcurrencyGuard.run(task);
}

function normalizeIp(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  const value = raw.trim();
  if (!value || value.length > MAX_IP_LENGTH) {
    return null;
  }

  // 只接受 IPv4 / IPv6 / 带端口的 IPv4，其余（比如被塞进来的任意字符串）一律不认
  if (
    !/^(?:\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-fA-F:.]+\]|[0-9a-fA-F:]+)(?::\d{1,5})?$/.test(value)
  ) {
    return null;
  }

  return value;
}

/**
 * 取客户端 IP。
 *
 * 旧实现取 X-Forwarded-For 的最左段——那一段完全由客户端控制，
 * 攻击者只要自带 `X-Forwarded-For: 1.2.3.4` 就能让每个请求落到不同的限流桶，限流形同虚设。
 *
 * 正确做法是从右往左数：右侧的条目是由我们自己的反向代理写入的，客户端无法伪造。
 * 默认假设前面有 1 层代理（nginx / 云负载均衡），多层时用 TRUSTED_PROXY_HOPS 调整。
 */
export function extractClientIp(headers: Headers) {
  const hops = Math.min(Math.max(getTrustedProxyHops(), 0), 10);

  if (hops > 0) {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor) {
      const parts = forwardedFor
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const candidate = normalizeIp(parts[parts.length - hops]);
      if (candidate) {
        return candidate;
      }
    }
  }

  const realIp = normalizeIp(headers.get("x-real-ip"));
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function getTrustedProxyHops() {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  return parsed;
}

/**
 * 带体积上限的 JSON 请求体读取。
 *
 * Next 的 App Router 没有内置 body 大小限制，`request.json()` 会把任意大的请求体读进内存，
 * 一个几十 MB 的请求就能拖住事件循环。这里先看 Content-Length，再在流式读取时二次卡住
 * （Content-Length 可以缺失或撒谎）。
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const body = request.body;
  if (!body) {
    throw new SyntaxError("Empty body");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new RequestBodyTooLargeError();
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(merged));
}

export function createRateLimitHeaders(snapshot: RateLimitSnapshot) {
  return {
    "X-RateLimit-Limit": String(snapshot.limit),
    "X-RateLimit-Remaining": String(snapshot.remaining),
    "X-RateLimit-Reset": String(Math.ceil(snapshot.resetAt / 1000)),
    "Retry-After": String(snapshot.retryAfterSeconds),
  };
}

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
