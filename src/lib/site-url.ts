import { unstable_noStore } from "next/cache";
import { getSiteConfig } from "@/lib/site-config";

/**
 * 站点 URL 解析层。
 *
 * 解析顺序：
 * 1. 环境变量 NEXT_PUBLIC_SITE_URL（部署时灵活覆盖）
 * 2. config/site.json 中的 url 字段
 * 3. 空字符串（表示未配置，相关功能降级）
 *
 * URL 末尾统一去除尾部斜杠，便于后续拼接。
 */
export async function getSiteUrl(): Promise<string> {
  unstable_noStore();

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    return stripTrailingSlash(envUrl);
  }

  const siteConfig = await getSiteConfig();
  if (siteConfig.url) {
    return stripTrailingSlash(siteConfig.url);
  }

  return "";
}

/**
 * 站点 URL 是否已配置。
 * 未配置时不输出 canonical / OG / sitemap host 等绝对链接，避免错误链接。
 */
export async function isSiteUrlConfigured(): Promise<boolean> {
  const url = await getSiteUrl();
  return url.length > 0;
}

/**
 * 拼接绝对 URL：siteUrl + path。
 * path 应以 "/" 开头。未配置域名时返回空字符串（调用方据此降级）。
 */
export async function getAbsoluteUrl(path: string): Promise<string> {
  const base = await getSiteUrl();
  if (!base) {
    return "";
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
