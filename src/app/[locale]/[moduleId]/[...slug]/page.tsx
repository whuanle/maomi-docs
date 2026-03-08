import { notFound } from "next/navigation";
import { DocLayout } from "@/components/doc-layout";
import { getDocBySlug, getModuleContent } from "@/lib/docs";
import { isSupportedLocale } from "@/lib/site-config";

export const dynamic = "force-dynamic";

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

  return (
    <DocLayout
      currentPath={currentPath}
      sidebarItems={content.sidebarTree}
      doc={doc}
      prev={prev}
      next={next}
    />
  );
}
