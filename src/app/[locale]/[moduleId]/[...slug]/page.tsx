import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocLayout } from "@/components/doc-layout";
import { StructuredData, buildArticleSchema } from "@/components/structured-data";
import { getDocBySlug, getModuleContent } from "@/lib/docs";
import { extractDocSummary } from "@/lib/doc-summary";
import { getSiteConfig, isSupportedLocale } from "@/lib/site-config";
import { getAbsoluteUrl, getSiteUrl, isSiteUrlConfigured } from "@/lib/site-url";
import { getStats } from "@/lib/stats-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; moduleId: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale, moduleId, slug } = await params;

  if (!(await isSupportedLocale(locale))) {
    return {};
  }

  const [doc, siteConfig, absoluteUrl] = await Promise.all([
    getDocBySlug(locale, moduleId, slug),
    getSiteConfig(),
    getAbsoluteUrl(`/${locale}/${moduleId}/${slug.join("/")}`),
  ]);

  if (!doc) {
    return {};
  }

  const title = doc.frontmatter.title || doc.displayName;
  const description = extractDocSummary(doc.contentRaw);

  return {
    title,
    description,
    alternates: absoluteUrl ? { canonical: absoluteUrl } : undefined,
    openGraph: absoluteUrl
      ? {
          type: "article",
          locale: "zh_CN",
          url: absoluteUrl,
          title,
          description,
          siteName: siteConfig.title,
        }
      : undefined,
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; moduleId: string; slug: string[] }>;
}) {
  const { locale, moduleId, slug } = await params;

  if (!(await isSupportedLocale(locale))) {
    notFound();
  }

  const [content, doc] = await Promise.all([
    getModuleContent(moduleId, locale),
    getDocBySlug(locale, moduleId, slug),
  ]);

  if (!content || !doc) {
    notFound();
  }

  const currentPath = doc.urlPath;
  const currentIndex = content.docs.findIndex((d) => d.urlPath === doc.urlPath);
  const prev = currentIndex > 0 ? content.docs[currentIndex - 1] : null;
  const next = currentIndex < content.docs.length - 1 ? content.docs[currentIndex + 1] : null;

  // 阅读量：服务端只读取统计用于首屏渲染，不在服务端记录阅读。
  // 阅读量由客户端组件挂载时上报（每次访问 +1），避免服务端+客户端重复计数。
  const articleStats = await getStats(currentPath);

  const [siteConfig, siteUrl, configured] = await Promise.all([
    getSiteConfig(),
    getSiteUrl(),
    isSiteUrlConfigured(),
  ]);

  const articleSchema = configured
    ? buildArticleSchema({
        title: doc.frontmatter.title || doc.displayName,
        description: extractDocSummary(doc.contentRaw),
        url: `${siteUrl}${doc.urlPath}`,
        siteUrl,
        siteName: siteConfig.title,
        author: siteConfig.author,
        dateModified: typeof doc.frontmatter.updatedAt === "string" ? doc.frontmatter.updatedAt : undefined,
      })
    : null;

  return (
    <>
      {articleSchema && <StructuredData data={articleSchema} />}
      <DocLayout
        currentPath={currentPath}
        sidebarItems={content.sidebarTree}
        doc={doc}
        prev={prev}
        next={next}
        articleStats={articleStats}
      />
    </>
  );
}
