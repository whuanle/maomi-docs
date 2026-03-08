import fs from "node:fs/promises";
import path from "node:path";
import { unstable_noStore } from "next/cache";

export interface SiteLink {
  label: string;
  href: string;
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
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  title: "技术文档",
  description: "探索技术文档和教程",
  headerLinks: [],
  footerLinks: [],
  beian: {},
};

const SITE_CONFIG_PATH = path.join(process.cwd(), "config", "site.json");

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLink(value: unknown): SiteLink | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const link = value as Partial<SiteLink>;
  const label = normalizeText(link.label);
  const href = normalizeText(link.href);

  if (!label || !href) {
    return null;
  }

  return {
    label,
    href,
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
    };

    const title = normalizeText(parsed.title) || DEFAULT_SITE_CONFIG.title;
    const description =
      normalizeText(parsed.description) || DEFAULT_SITE_CONFIG.description;

    return {
      title,
      description,
      headerLinks: normalizeLinks(parsed.headerLinks),
      footerLinks: normalizeLinks(parsed.footerLinks),
      beian: {
        icp: normalizeRecord(parsed.beian?.icp),
        police: normalizeRecord(parsed.beian?.police),
      },
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
