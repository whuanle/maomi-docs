import { NextRequest, NextResponse } from "next/server";
import { sanitizeLocale, searchDocs } from "@/lib/search";
import {
  checkSearchRateLimit,
  createRateLimitHeaders,
  extractClientIp,
  runSearchTask,
  ServerBusyError,
} from "@/lib/server-protection";

export const dynamic = "force-dynamic";

// 与 MCP 端点对齐：超长查询只可能是异常流量
const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const locale = sanitizeLocale(searchParams.get("locale"));
  const clientIp = extractClientIp(request.headers);
  const rateLimit = checkSearchRateLimit(clientIp);

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ results: [], error: "query_too_long" }, { status: 400 });
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { results: [], error: "rate_limited" },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimit),
      },
    );
  }

  try {
    const results = await runSearchTask(() =>
      searchDocs({
        query,
        locale,
        limit: 20,
      }),
    );

    return NextResponse.json(
      { results },
      {
        headers: createRateLimitHeaders(rateLimit),
      },
    );
  } catch (error) {
    if (error instanceof ServerBusyError) {
      return NextResponse.json(
        { results: [], error: "server_busy" },
        {
          status: 503,
          headers: {
            ...createRateLimitHeaders(rateLimit),
            "Retry-After": "1",
          },
        },
      );
    }

    console.error("搜索错误:", error);
    return NextResponse.json(
      { results: [] },
      {
        status: 500,
        headers: createRateLimitHeaders(rateLimit),
      },
    );
  }
}
