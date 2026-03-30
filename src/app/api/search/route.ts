import { NextRequest, NextResponse } from "next/server";
import { searchDocs } from "@/lib/search";
import {
  checkSearchRateLimit,
  createRateLimitHeaders,
  extractClientIp,
  runSearchTask,
  ServerBusyError,
} from "@/lib/server-protection";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const locale = searchParams.get("locale") || "zh";
  const clientIp = extractClientIp(request.headers);
  const rateLimit = checkSearchRateLimit(clientIp);

  if (!query) {
    return NextResponse.json({ results: [] });
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
