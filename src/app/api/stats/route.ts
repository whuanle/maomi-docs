import { NextRequest, NextResponse } from "next/server";
import { getStats, recordLike, recordView } from "@/lib/stats-store";
import { checkStatsRateLimit, createRateLimitHeaders, extractClientIp } from "@/lib/server-protection";

export const dynamic = "force-dynamic";

// docPath 校验：必须是 /locale/moduleId/... 形式的站点内部路径
const DOC_PATH_PATTERN = /^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.\-/]+)?$/;

function isValidDocPath(value: unknown): value is string {
  return typeof value === "string" && DOC_PATH_PATTERN.test(value);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const docPath = searchParams.get("path") ?? "";
  const clientIp = extractClientIp(request.headers);
  const rateLimit = checkStatsRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { view: 0, like: 0, error: "rate_limited" },
      { status: 429, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  if (!isValidDocPath(docPath)) {
    return NextResponse.json(
      { view: 0, like: 0 },
      { status: 200, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  try {
    const snapshot = await getStats(docPath);
    return NextResponse.json(snapshot, {
      headers: createRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    console.error("[stats] 读取统计失败:", error);
    return NextResponse.json(
      { view: 0, like: 0 },
      { status: 500, headers: createRateLimitHeaders(rateLimit) },
    );
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
    return NextResponse.json(
      { view: 0, like: 0, error: "rate_limited" },
      { status: 429, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  let body: StatsPostBody;
  try {
    body = (await request.json()) as StatsPostBody;
  } catch {
    return NextResponse.json(
      { view: 0, like: 0, error: "invalid_body" },
      { status: 400, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  const docPath = body.path;
  if (!isValidDocPath(docPath)) {
    return NextResponse.json(
      { view: 0, like: 0, error: "invalid_path" },
      { status: 400, headers: createRateLimitHeaders(rateLimit) },
    );
  }

  const type = body.type;
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  try {
    if (type === "view") {
      const snapshot = await recordView(docPath);
      return NextResponse.json(snapshot, { headers: rateLimitHeaders });
    }

    if (type === "like") {
      const snapshot = await recordLike(docPath);
      return NextResponse.json(snapshot, { headers: rateLimitHeaders });
    }

    return NextResponse.json(
      { view: 0, like: 0, error: "invalid_type" },
      { status: 400, headers: rateLimitHeaders },
    );
  } catch (error) {
    console.error("[stats] 写入统计失败:", error);
    return NextResponse.json(
      { view: 0, like: 0 },
      { status: 500, headers: rateLimitHeaders },
    );
  }
}
