const DEFAULT_MCP_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_MCP_RATE_LIMIT_MAX_REQUESTS = 30;
const DEFAULT_SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_SEARCH_RATE_LIMIT_MAX_REQUESTS = 90;
const DEFAULT_SEARCH_MAX_CONCURRENT = 4;

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

export function checkMcpRateLimit(clientIp: string) {
  return mcpRateLimiter.check(`mcp:${clientIp}`);
}

export function checkSearchRateLimit(clientIp: string) {
  return searchRateLimiter.check(`search:${clientIp}`);
}

export async function runSearchTask<T>(task: () => Promise<T>) {
  return searchConcurrencyGuard.run(task);
}

export function extractClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
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