import type { Metadata } from "next";
import { CustomHeadElements } from "@/components/custom-head-elements";
import { StructuredData, buildWebSiteSchema } from "@/components/structured-data";
import { ThemeProvider } from "@/components/theme-provider";
import { getSiteConfig } from "@/lib/site-config";
import { getSiteUrl, isSiteUrlConfigured } from "@/lib/site-url";
import "katex/dist/katex.min.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [siteConfig, siteUrl, configured] = await Promise.all([
    getSiteConfig(),
    getSiteUrl(),
    isSiteUrlConfigured(),
  ]);

  const url = configured ? `${siteUrl}/zh` : undefined;

  return {
    metadataBase: configured ? new URL(siteUrl) : undefined,
    title: {
      default: siteConfig.title,
      template: `%s | ${siteConfig.title}`,
    },
    description: siteConfig.description,
    keywords: siteConfig.keywords,
    authors: siteConfig.author ? [{ name: siteConfig.author }] : undefined,
    applicationName: siteConfig.title,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url,
      siteName: siteConfig.title,
      title: siteConfig.title,
      description: siteConfig.description,
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.title,
      description: siteConfig.description,
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [siteConfig, siteUrl, configured] = await Promise.all([
    getSiteConfig(),
    getSiteUrl(),
    isSiteUrlConfigured(),
  ]);

  const websiteSchema = configured
    ? buildWebSiteSchema({
        siteUrl,
        title: siteConfig.title,
        description: siteConfig.description,
        author: siteConfig.author,
      })
    : null;

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <CustomHeadElements html={siteConfig.customHeadHtml} />
        {websiteSchema && <StructuredData data={websiteSchema} />}
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
