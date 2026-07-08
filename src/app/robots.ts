import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteUrl();

  // 已知的 AI/生成式引擎爬虫，显式 Allow，避免被默认规则误封。
  const aiCrawlers = [
    "GPTBot",        // OpenAI / ChatGPT
    "ChatGPT-User",
    "OAI-SearchBot", // OpenAI 搜索
    "PerplexityBot", // Perplexity
    "Perplexity-User",
    "ClaudeBot",     // Anthropic / Claude
    "Claude-Web",
    "anthropic-ai",
    "Google-Extended", // Google Gemini 训练与回答
    "Bytespider",   // 字节 / 豆包
    "CCBot",        // 常见爬虫，多个 AI 使用其数据
    "Applebot-Extended", // Apple Intelligence
  ];

  const rules: MetadataRoute.Robots["rules"] = [
    // 默认：允许全部
    {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/mcp"],
    },
    // 显式允许各 AI 爬虫访问内容
    ...aiCrawlers.map((ua) => ({
      userAgent: ua,
      allow: "/",
      disallow: ["/api/", "/mcp"],
    })),
  ];

  const sitemaps = baseUrl ? [`${baseUrl}/sitemap.xml`] : [];

  return {
    rules,
    ...(sitemaps.length > 0 ? { sitemap: sitemaps, host: baseUrl } : {}),
  };
}
