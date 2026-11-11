import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStats, recordLike, recordView } from "@/lib/stats-store";
import {
  checkStatsRateLimit,
  createRateLimitHeaders,
  extractClientIp,
  readJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/server-protection";

export const dynamic = "force-dynamic";

// 统计请求体很小，超过这个体积一定是异常流量
const MAX_BODY_BYTES = 4 * 1024;

// docPath 校验：必须是 /locale/moduleId/... 形式的站点内部路径
const DOC_PATH_PATTERN = /^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.\-/]+)?$/;
const VISITOR_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

function isValidDocPath(value: unknown): value is string {
  return typeof value === "string" && DOC_PATH_PATTERN.test(value);
}

/**
 * 去重用的访客标识。
 *
 * 不落原始 IP/原始 visitorId：只存 sha256 前缀，既满足去重又避免把个人标识堆在统计库里。
 * 点赞用纯 IP 作种子——visitorId 由客户端生成，混进去等于给刷量者一把新钥匙；
 * 阅读去重允许带上 visitorId，是为了让同一出口 IP 下的不同浏览器仍各算一次。
 */
function hashVoterKey(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { ...headers, "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const docPath = searchParams.get("path") ?? "";
  const clientIp = extractClientIp(request.headers);
  const rateLimit = checkStatsRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return jsonResponse({ view: 0, like: 0, error: "rate_limited" }, 429, createRateLimitHeaders(rateLimit));
  }

  if (!isValidDocPath(docPath)) {
    return jsonResponse({ view: 0, like: 0 }, 200, createRateLimitHeaders(rateLimit));
  }

  try {
    const snapshot = await getStats(docPath);
    return jsonResponse(snapshot, 200, createRateLimitHeaders(rateLimit));
  } catch (error) {
    console.error("[stats] 读取统计失败:", error);
    return jsonResponse({ view: 0, like: 0 }, 500, createRateLimitHeaders(rateLimit));
  }
}

interface StatsPostBody {
  type?: unknown;
  path?: unknown;
  visitorId?: unknown;
}

export async function POST(request: NextRequest) {
  const clientIp = extractClientIp(request.headers);
  const rateLimit = checkStatsRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return jsonResponse({ view: 0, like: 0, error: "rate_limited" }, 429, createRateLimitHeaders(rateLimit));
  }

  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  let body: StatsPostBody;
  try {
    body = (await readJsonBody(request, MAX_BODY_BYTES)) as StatsPostBody;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonResponse({ view: 0, like: 0, error: "payload_too_large" }, 413, rateLimitHeaders);
    }

    return jsonResponse({ view: 0, like: 0, error: "invalid_body" }, 400, rateLimitHeaders);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ view: 0, like: 0, error: "invalid_body" }, 400, rateLimitHeaders);
  }

  const docPath = body.path;
  if (!isValidDocPath(docPath)) {
    return jsonResponse({ view: 0, like: 0, error: "invalid_path" }, 400, rateLimitHeaders);
  }

  const visitorId =
    typeof body.visitorId === "string" && VISITOR_ID_PATTERN.test(body.visitorId)
      ? body.visitorId
      : "";
  const type = body.type;

  try {
    if (type === "view") {
      const snapshot = await recordView(docPath, hashVoterKey(`view|${clientIp}|${visitorId}`));
      return jsonResponse(snapshot, 200, rateLimitHeaders);
    }

    if (type === "like") {
      const snapshot = await recordLike(docPath, hashVoterKey(`like|${clientIp}`));
      return jsonResponse(snapshot, 200, rateLimitHeaders);
    }

    return jsonResponse({ view: 0, like: 0, error: "invalid_type" }, 400, rateLimitHeaders);
  } catch (error) {
    console.error("[stats] 写入统计失败:", error);
    return jsonResponse({ view: 0, like: 0 }, 500, rateLimitHeaders);
  }
}
