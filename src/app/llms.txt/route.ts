import { NextRequest, NextResponse } from "next/server";
import { extractShortSummary } from "@/lib/doc-summary";
import { buildDocCatalog } from "@/lib/llms-catalog";
import { getSiteConfig } from "@/lib/site-config";
import { getSiteUrl } from "@/lib/site-url";
import {
  checkLlmRateLimit,
  createRateLimitHeaders,
  extractClientIp,
} from "@/lib/server-protection";

export const dynamic = "force-dynamic";

const TEXT_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  // llms.txt / llms-full.txt 都是全量文档导出，共享同一个限流桶
  const rateLimit = checkLlmRateLimit(extractClientIp(request.headers));

  if (!rateLimit.allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        ...createRateLimitHeaders(rateLimit),
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const [baseUrl, siteConfig, catalog] = await Promise.all([
    getSiteUrl(),
    getSiteConfig(),
    buildDocCatalog(),
  ]);

  const lines: string[] = [];

  // 标题块（H1 + 描述引用）
  lines.push(`# ${siteConfig.title}`);
  lines.push("");
  lines.push(`> ${siteConfig.description}`);
  lines.push("");

  // 可选：站点全量索引
  if (baseUrl) {
    lines.push(`全量内容（含正文）：[llms-full.txt](${baseUrl}/llms-full.txt)`);
    lines.push("");
  }

  // 按模块分组列出文档
  for (const { module, docs } of catalog) {
    lines.push(`## ${module.title}`);
    if (module.description) {
      lines.push("");
      lines.push(`> ${module.description}`);
    }
    lines.push("");
    for (const doc of docs) {
      const title = doc.frontmatter.title || doc.displayName;
      const summary = extractShortSummary(doc.contentRaw);
      const url = baseUrl ? `${baseUrl}${doc.urlPath}` : doc.urlPath;
      const summaryText = summary ? `: ${summary}` : "";
      lines.push(`- [${title}]${summaryText}: ${url}`);
    }
    lines.push("");
  }

  // 可选链接（站点配置中的头部链接）
  if (siteConfig.headerLinks.length > 0) {
    lines.push("## 相关链接");
    for (const link of siteConfig.headerLinks) {
      lines.push(`- [${link.label}](${link.href})`);
    }
    lines.push("");
  }

  const body = `${lines.join("\n")}\n`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": TEXT_CACHE_CONTROL,
      ...createRateLimitHeaders(rateLimit),
    },
  });
}
