import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData, buildArticleSchema } from "@/components/structured-data";
import { ArticleStats } from "@/components/article-stats";
import { DocContent } from "@/components/doc-content";
import { Sidebar } from "@/components/sidebar";
import { getModuleContent, getReadmeDoc, listModules } from "@/lib/docs";
import { extractDocSummary } from "@/lib/doc-summary";
import { getSiteConfig, isSupportedLocale } from "@/lib/site-config";
import { getAbsoluteUrl, getSiteUrl, isSiteUrlConfigured } from "@/lib/site-url";
import { startsWithMarkdownHeading } from "@/lib/markdown";
import { getStats } from "@/lib/stats-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; moduleId: string }>;
}): Promise<Metadata> {
  const { locale, moduleId } = await params;

  if (!(await isSupportedLocale(locale))) {
    return {};
  }

  const [content, readmeDoc, moduleMeta, siteConfig, absoluteUrl] =
    await Promise.all([
      getModuleContent(moduleId, locale),
      getReadmeDoc(moduleId, locale),
      listModules(),
      getSiteConfig(),
      getAbsoluteUrl(`/${locale}/${moduleId}`),
    ]);

  if (!content) {
    return {};
  }

  const meta = moduleMeta.find((m) => m.id === moduleId);
  const title = meta?.title ?? moduleId;
  const description =
    (readmeDoc ? extractDocSummary(readmeDoc.contentRaw) : "") ||
    meta?.description ||
    siteConfig.description;

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

export default async function ModulePage({
  params,
}: {
  params: Promise<{ locale: string; moduleId: string }>;
}) {
  const { locale, moduleId } = await params;

  if (!(await isSupportedLocale(locale))) {
    notFound();
  }

  const content = await getModuleContent(moduleId, locale);
  if (!content) {
    notFound();
  }

  const readmeDoc = await getReadmeDoc(moduleId, locale);

  const moduleRootPath = `/${locale}/${moduleId}`;

  // 结构化数据
  const [siteConfig, siteUrl, configured] = await Promise.all([
    getSiteConfig(),
    getSiteUrl(),
    isSiteUrlConfigured(),
  ]);
  const articleSchema = configured
    ? buildArticleSchema({
        title:
          readmeDoc?.frontmatter.title || content.moduleMeta.title,
        description:
          (readmeDoc ? extractDocSummary(readmeDoc.contentRaw) : "") ||
          content.moduleMeta.description ||
          "",
        url: `${siteUrl}${moduleRootPath}`,
        siteUrl,
        siteName: siteConfig.title,
        author: siteConfig.author,
        dateModified:
          typeof readmeDoc?.frontmatter.updatedAt === "string"
            ? readmeDoc.frontmatter.updatedAt
            : undefined,
      })
    : null;

  if (readmeDoc) {
    const showPageTitle = !startsWithMarkdownHeading(readmeDoc.contentRaw);

    // 阅读量：服务端只读取统计用于首屏渲染；阅读量由客户端组件挂载时上报。
    const articleStats = await getStats(readmeDoc.urlPath);

    return (
      <div className="flex w-full">
        {articleSchema && <StructuredData data={articleSchema} />}
        <Sidebar items={content.sidebarTree} currentPath={moduleRootPath} />
        <main className="flex-1 min-w-0">
          <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {showPageTitle && (
              <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-tight">
                {readmeDoc.frontmatter.title ?? content.moduleMeta.title}
              </h1>
            )}
            <div className="mb-6">
              <ArticleStats
                docPath={readmeDoc.urlPath}
                initialViews={articleStats.view}
                initialLikes={articleStats.like}
              />
            </div>
            <DocContent
              content={readmeDoc.contentRaw}
              filePath={readmeDoc.filePath}
              currentPath={moduleRootPath}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full">
      {articleSchema && <StructuredData data={articleSchema} />}
      <Sidebar items={content.sidebarTree} currentPath={moduleRootPath} />
      <main className="flex-1 min-w-0">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-8">
            {content.moduleMeta.title}
          </h1>
          <p className="text-[var(--text-secondary)]">此模块暂无 README 文档。</p>
        </div>
      </main>
    </div>
  );
}
