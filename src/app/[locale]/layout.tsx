import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listModules } from "@/lib/docs";
import { getSiteConfig, isSupportedLocale } from "@/lib/site-config";

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

  const [modules, siteConfig] = await Promise.all([
    listModules(),
    getSiteConfig(),
  ]);

  const siteTitle = siteConfig.title;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <SiteHeader
        locale={locale}
        modules={modules}
        siteTitle={siteTitle}
        headerLinks={siteConfig.headerLinks}
      />
      <div className="flex-1 w-full">{children}</div>
      <SiteFooter
        siteTitle={siteTitle}
        footerLinks={siteConfig.footerLinks}
        beian={siteConfig.beian}
      />
    </div>
  );
}
