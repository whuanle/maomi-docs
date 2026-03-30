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