import type { Metadata } from "next";
import { HomepageMdxRenderer } from "@/components/homepage-mdx-renderer";
import { loadHomePageMdx } from "@/lib/homepage";
import { getSiteConfig } from "@/lib/site-config";
import { getAbsoluteUrl } from "@/lib/site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [siteConfig, absoluteUrl] = await Promise.all([
    getSiteConfig(),
    getAbsoluteUrl(`/${locale}`),
  ]);

  return {
    title: siteConfig.title,
    description: siteConfig.description,
    alternates: absoluteUrl ? { canonical: absoluteUrl } : undefined,
    openGraph: absoluteUrl
      ? {
          type: "website",
          locale: "zh_CN",
          url: absoluteUrl,
          siteName: siteConfig.title,
          title: siteConfig.title,
          description: siteConfig.description,
        }
      : undefined,
    twitter: {
      card: "summary_large_image",
      title: siteConfig.title,
      description: siteConfig.description,
    },
  };
}

export default async function HomePage() {
  const { content } = await loadHomePageMdx();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <HomepageMdxRenderer content={content} />
    </div>
  );
}
