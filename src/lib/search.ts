import { getModuleContent, listModules } from "@/lib/docs";

export interface SearchResultItem {
  title: string;
  path: string;
  module: string;
  snippet: string;
}

interface SearchIndexEntry {
  title: string;
  titleLower: string;
  path: string;
  module: string;
  contentText: string;
  contentLower: string;
}

interface SearchIndexCacheEntry {
  expiresAt: number;
  entries?: SearchIndexEntry[];
  pending?: Promise<SearchIndexEntry[]>;
}

const DEFAULT_SEARCH_INDEX_TTL_MS = 5 * 60 * 1000;
const searchIndexCache = new Map<string, SearchIndexCacheEntry>();

/**
 * 索引缓存的语言桶上限。每个 locale 会持有一份全量文档索引（正文各存两份大小写），
 * 不设上限时攻击者轮换 locale 值就能把内存吃穿。正常站点只有一两个 locale，
 * 16 个桶足够宽裕，超了按插入顺序淘汰最旧的。
 */
const MAX_SEARCH_INDEX_LOCALES = 16;

/**
 * locale 白名单形态校验。
 *
 * locale 直接作为索引缓存 key 使用：不校验的话，`?locale=a`、`?locale=b`…… 每个值都会
 * 触发一次全量扫盘建索引并永久驻留缓存（过期条目只在被再次访问时才替换，key 本身不清理），
 * 是一个廉价的内存耗尽 DoS 向量。不匹配的值一律回退 zh。
 */
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{1,8})?$/;

export function sanitizeLocale(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return LOCALE_PATTERN.test(raw) ? raw : "zh";
}

export async function searchDocs({
  query,
  locale = "zh",
  limit = 10,
}: {
  query: string;
  locale?: string;
  limit?: number;
}): Promise<SearchResultItem[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const entries = await getSearchIndex(locale);
  const scoredResults: Array<SearchResultItem & { score: number }> = [];

  for (const entry of entries) {
    const score = scoreEntry(entry, normalizedQuery, terms);
    if (score <= 0) {
      continue;
    }

    scoredResults.push({
      title: entry.title,
      path: entry.path,
      module: entry.module,
      snippet: buildSnippet(entry.contentText, normalizedQuery),
      score,
    });
  }

  return scoredResults
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "zh-CN"))
    .slice(0, safeLimit)
    .map(({ score: _score, ...result }) => result);
}

async function getSearchIndex(locale: string) {
  const now = Date.now();
  const cached = searchIndexCache.get(locale);

  if (cached?.entries && cached.expiresAt > now) {
    return cached.entries;
  }

  if (cached?.pending) {
    return cached.pending;
  }

  pruneSearchIndexCache(now);

  const pending = buildSearchIndex(locale)
    .then((entries) => {
      searchIndexCache.set(locale, {
        entries,
        expiresAt: now + getSearchIndexTtlMs(),
      });
      return entries;
    })
    .finally(() => {
      const latest = searchIndexCache.get(locale);
      if (latest?.pending) {
        searchIndexCache.set(locale, {
          entries: latest.entries,
          expiresAt: latest.expiresAt,
        });
      }
    });

  searchIndexCache.set(locale, {
    entries: cached?.entries,
    expiresAt: cached?.expiresAt ?? 0,
    pending,
  });

  return pending;
}

/**
 * 缓存清理：先清过期桶，仍然超上限就按插入顺序淘汰最旧的桶。
 * 删除带 pending 的桶是安全的：构建完成后 then 回调会把结果重新写回缓存。
 */
function pruneSearchIndexCache(now: number) {
  for (const [key, value] of searchIndexCache) {
    if (!value.pending && value.expiresAt <= now) {
      searchIndexCache.delete(key);
    }
  }

  while (searchIndexCache.size >= MAX_SEARCH_INDEX_LOCALES) {
    const oldestKey = searchIndexCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }

    searchIndexCache.delete(oldestKey);
  }
}

async function buildSearchIndex(locale: string) {
  const modules = await listModules();
  const entries: SearchIndexEntry[] = [];

  for (const moduleItem of modules) {
    const content = await getModuleContent(moduleItem.id, locale);
    if (!content) {
      continue;
    }

    for (const doc of content.docs) {
      const title = doc.frontmatter.title || doc.displayName;
      const contentText = normalizeSearchText(doc.contentRaw);

      entries.push({
        title,
        titleLower: title.toLowerCase(),
        path: doc.urlPath,
        module: moduleItem.title,
        contentText,
        contentLower: contentText.toLowerCase(),
      });
    }
  }

  return entries;
}

function normalizeSearchText(content: string) {
  return content
    .replace(/^---[\s\S]*?---/m, " ")
    .replace(/`{3}[\s\S]*?`{3}/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreEntry(entry: SearchIndexEntry, normalizedQuery: string, terms: string[]) {
  let score = 0;

  if (entry.titleLower === normalizedQuery) {
    score += 120;
  } else if (entry.titleLower.startsWith(normalizedQuery)) {
    score += 80;
  } else if (entry.titleLower.includes(normalizedQuery)) {
    score += 40;
  }

  if (entry.contentLower.includes(normalizedQuery)) {
    score += 16;
  }

  for (const term of terms) {
    if (entry.titleLower.includes(term)) {
      score += 12;
    }

    if (entry.contentLower.includes(term)) {
      score += 4;
    }
  }

  return score;
}

function buildSnippet(content: string, normalizedQuery: string) {
  if (!content) {
    return "";
  }

  const contentLower = content.toLowerCase();
  const matchIndex = contentLower.indexOf(normalizedQuery);
  const snippetRadius = 56;

  if (matchIndex === -1) {
    return `${content.slice(0, 120).trim()}${content.length > 120 ? "..." : ""}`;
  }

  const start = Math.max(0, matchIndex - snippetRadius);
  const end = Math.min(content.length, matchIndex + normalizedQuery.length + snippetRadius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

function getSearchIndexTtlMs() {
  const value = Number(process.env.SEARCH_INDEX_TTL_MS);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_SEARCH_INDEX_TTL_MS;
  }

  return value;
}