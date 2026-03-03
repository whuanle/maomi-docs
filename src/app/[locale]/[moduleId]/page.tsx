import { notFound } from "next/navigation";
import { getModuleContent, getReadmeDoc } from "@/lib/docs";
import { isSupportedLocale } from "@/lib/site-config";
import { DocContent } from "@/components/doc-content";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

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

  if (readmeDoc) {
    return (
      <div className="flex w-full">
        <Sidebar items={content.sidebarTree} currentPath={moduleRootPath} />
        <main className="flex-1 min-w-0">
          <div className="max-w-[740px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-8">
              {readmeDoc.frontmatter.title ?? content.moduleMeta.title}
            </h1>
            <DocContent content={readmeDoc.contentRaw} filePath={readmeDoc.filePath} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full">
      <Sidebar items={content.sidebarTree} currentPath={moduleRootPath} />
      <main className="flex-1 min-w-0">
        <div className="max-w-[740px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-8">
            {content.moduleMeta.title}
          </h1>
          <p className="text-[var(--text-secondary)]">此模块暂无 README 文档。</p>
        </div>
      </main>
    </div>
  );
}
