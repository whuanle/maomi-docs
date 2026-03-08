import fs from "node:fs/promises";
import path from "node:path";
import { unstable_noStore } from "next/cache";

export interface SiteLink {
  label: string;
  href: string;
  icon?: string;
  newTab?: boolean;
}

export interface SiteRecord {
  text: string;
  href?: string;
}

export interface SiteBeian {
  icp?: SiteRecord;
  police?: SiteRecord;
}

export interface SiteConfig {
  title: string;
  description: string;
  headerLinks: SiteLink[];
  footerLinks: SiteLink[];
  beian: SiteBeian;
  customHeadHtml?: string;
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  title: "技术文档",
  description: "探索技术文档和教程",
  headerLinks: [],
  footerLinks: [],
  beian: {
    icp: {
      text: "粤ICP备18051778号",
      href: "https://beian.miit.gov.cn/",
    },
    police: {
      text: "粤公网安备 44030902003257号",
      href: "http://www.beian.gov.cn/portal/registerSystemInfo",
    },
  },
  customHeadHtml: undefined,
};

const SITE_CONFIG_PATH = path.join(process.cwd(), "config", "site.json");

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHtmlSnippet(value: unknown) {
  if (typeof value === "string") {
    const html = value.trim();
    return html || undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const lines = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.join("\n");
}

async function resolveCustomHeadHtml(
  inlineValue: unknown,
  fileValue: unknown,
) {
  const inlineHtml = normalizeHtmlSnippet(inlineValue);
  const filePath = normalizeText(fileValue);
  const parts: string[] = [];

  if (filePath) {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    try {
      const fileHtml = (await fs.readFile(resolvedPath, "utf8")).trim();

      if (fileHtml) {
        parts.push(fileHtml);
      }
    } catch {}
  }

  if (inlineHtml) {
    parts.push(inlineHtml);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("\n");
}

function normalizeLink(value: unknown): SiteLink | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const link = value as Partial<SiteLink>;
  const label = normalizeText(link.label);
  const href = normalizeText(link.href);
  const icon = normalizeText(link.icon);

  if (!label || !href) {
    return null;
  }

  return {
    label,
    href,
    icon: icon || undefined,
    newTab: typeof link.newTab === "boolean" ? link.newTab : undefined,
  };
}

function normalizeLinks(value: unknown): SiteLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeLink(item))
    .filter((item): item is SiteLink => item !== null);
}

function normalizeRecord(value: unknown): SiteRecord | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Partial<SiteRecord>;
  const text = normalizeText(record.text);
  const href = normalizeText(record.href);

  if (!text) {
    return undefined;
  }

  return href ? { text, href } : { text };
}

export async function getSiteConfig(): Promise<SiteConfig> {
  unstable_noStore();

  try {
    const raw = await fs.readFile(SITE_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SiteConfig> & {
      beian?: Partial<SiteBeian>;
      customHeadHtmlFile?: string;
    };

    const title = normalizeText(parsed.title) || DEFAULT_SITE_CONFIG.title;
    const description =
      normalizeText(parsed.description) || DEFAULT_SITE_CONFIG.description;
    const customHeadHtml = await resolveCustomHeadHtml(
      parsed.customHeadHtml,
      parsed.customHeadHtmlFile,
    );

    return {
      title,
      description,
      headerLinks: normalizeLinks(parsed.headerLinks),
      footerLinks: normalizeLinks(parsed.footerLinks),
      beian: {
        icp: normalizeRecord(parsed.beian?.icp),
        police: normalizeRecord(parsed.beian?.police),
      },
      customHeadHtml,
    };
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

export async function isSupportedLocale(locale: string) {
  return locale === "zh";
}

export async function getLocaleTitle(locale: string) {
  if (!(await isSupportedLocale(locale))) {
    return DEFAULT_SITE_CONFIG.title;
  }

  const siteConfig = await getSiteConfig();
  return siteConfig.title;
}
