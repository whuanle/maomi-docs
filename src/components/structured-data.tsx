interface StructuredDataProps {
  /**
   * 以 JSON-LD 对象形式提供，会被序列化为 <script type="application/ld+json">。
   */
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * 注入 JSON-LD 结构化数据的客户端安全组件。
 * 这是 GEO（生成式引擎优化）的核心信号之一，AI 引擎据此解析内容实体。
 */
export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface WebSiteSchemaInput {
  siteUrl: string;
  title: string;
  description: string;
  author?: string;
}

/**
 * 站点级 schema：WebSite + Organization。
 * 用于首页 / 全局。
 */
export function buildWebSiteSchema({
  siteUrl,
  title,
  description,
  author,
}: WebSiteSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: title,
    url: siteUrl,
    description,
    inLanguage: "zh-CN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/zh?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: author
      ? {
          "@type": "Organization",
          name: author,
          url: siteUrl,
        }
      : undefined,
  };
}

interface ArticleSchemaInput {
  title: string;
  description: string;
  url: string;
  siteUrl: string;
  siteName: string;
  author?: string;
  dateModified?: string;
}

/**
 * 文档页 schema：TechArticle（Article 的子类型，适合技术文档）。
 */
export function buildArticleSchema({
  title,
  description,
  url,
  siteUrl,
  siteName,
  author,
  dateModified,
}: ArticleSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description: description || undefined,
    url,
    inLanguage: "zh-CN",
    dateModified: dateModified || undefined,
    author: author
      ? { "@type": "Person", name: author }
      : undefined,
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}
