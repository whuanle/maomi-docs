import type { MetadataRoute } from "next";
import { getDocBySlug, getModuleContent, listModules } from "@/lib/docs";
import { getAbsoluteUrl, getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

async function safeMtime(filePath: string): Promise<Date | undefined> {
  try {
    const fs = await import("node:fs/promises");
    const stat = await fs.stat(filePath);
    return stat.mtime;
  } catch {
    return undefined;
  }
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getSiteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // 首页
  entries.push({
    url: baseUrl ? `${baseUrl}/zh` : "/zh",
    lastModified: now,
    changeFrequency: "daily",
    priority: 1.0,
  });

  const modules = await listModules();

  for (const moduleMeta of modules) {
    const content = await getModuleContent(moduleMeta.id, "zh");
    if (!content) continue;

    // 模块落地页
    const readmeDoc = content.docs.find(
      (d) => d.fileName.toLowerCase() === "readme.md",
    );
    const readmeMtime = readmeDoc ? await safeMtime(readmeDoc.filePath) : undefined;
    entries.push({
      url: baseUrl ? `${baseUrl}/zh/${moduleMeta.id}` : `/zh/${moduleMeta.id}`,
      lastModified: parseDate(readmeDoc?.frontmatter.updatedAt) ?? readmeMtime ?? now,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    // 各文档页
    for (const doc of content.docs) {
      const mtime = await safeMtime(doc.filePath);
      entries.push({
        url: baseUrl ? `${baseUrl}${doc.urlPath}` : doc.urlPath,
        lastModified: parseDate(doc.frontmatter.updatedAt) ?? mtime ?? now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
