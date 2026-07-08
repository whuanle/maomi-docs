import { NextResponse } from "next/server";
import { stripFrontmatter } from "@/lib/doc-summary";
import { buildDocCatalog } from "@/lib/llms-catalog";
import { getSiteConfig } from "@/lib/site-config";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// 单文档正文截断上限，避免极长内容撑爆响应
const MAX_BODY_CHARS = 20_000;
const TEXT_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  const [baseUrl, siteConfig, catalog] = await Promise.all([
    getSiteUrl(),
    getSiteConfig(),
    buildDocCatalog(),
  ]);

  const parts: string[] = [];

  parts.push(`# ${siteConfig.title}`);
  parts.push("");
  parts.push(`> ${siteConfig.description}`);
  parts.push("");

  for (const { module, docs } of catalog) {
    parts.push("================================");
    parts.push("");
    parts.push(`# 模块：${module.title}`);
    if (module.description) {
      parts.push("");
      parts.push(module.description);
    }
    parts.push("");

    for (const doc of docs) {
      const title = doc.frontmatter.title || doc.displayName;
      const url = baseUrl ? `${baseUrl}${doc.urlPath}` : doc.urlPath;

      parts.push("--------------------------------");
      parts.push("");
      parts.push(`标题：${title}`);
      parts.push(`来源：${url}`);
      parts.push("");

      const body = stripFrontmatter(doc.contentRaw);
      const trimmed = body.length > MAX_BODY_CHARS
        ? `${body.slice(0, MAX_BODY_CHARS)}\n\n[内容已截断，完整内容见来源链接]`
        : body;

      parts.push(trimmed);
      parts.push("");
    }
  }

  const result = `${parts.join("\n")}\n`;

  return new NextResponse(result, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": TEXT_CACHE_CONTROL,
    },
  });
}
