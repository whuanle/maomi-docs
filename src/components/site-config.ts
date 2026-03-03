import fs from "node:fs/promises";
import path from "node:path";

export interface SiteLink {
  label: string;
  href: string;
}

export interface SiteConfig {
  title: string;
  description: string;
  footerLinks: SiteLink[];
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  title: "技术文档",
  description: "探索技术文档和教程",
  footerLinks: [],
};

const SITE_CONFIG_PATH = path.join(process.cwd(), "config", "site.json");

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const raw = await fs.readFile(SITE_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SiteConfig>;

    return {
      ...DEFAULT_SITE_CONFIG,
      ...parsed,
    };
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

// 为了保持兼容性，保留这些函数但简化实现
export async function isSupportedLocale(locale: string): Promise<boolean> {
  return true; // 单语言模式下始终返回 true
}

export async function getLocaleTitle(locale: string): Promise<string> {
  const siteConfig = await getSiteConfig();
  return siteConfig.title;
}
