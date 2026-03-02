import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listModules } from "@/lib/docs";
import { getLocaleTitle, getSiteConfig, isSupportedLocale } from "@/lib/site-config";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  if (!(await isSupportedLocale(locale))) {
    notFound();
  }

  const [siteConfig, modules, siteTitle] = await Promise.all([
    getSiteConfig(),
    listModules(),
    getLocaleTitle(locale),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <SiteHeader locale={locale} modules={modules} siteTitle={siteTitle} />
      <div className="flex-1 w-full">{children}</div>
      <SiteFooter links={siteConfig.footerLinks} siteTitle={siteTitle} />
    </div>
  );
}
