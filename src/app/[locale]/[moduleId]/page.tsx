import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleContent } from "@/lib/docs";
import { isSupportedLocale } from "@/lib/site-config";
import { DocContent } from "@/components/doc-content";

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

  // 查找 README.md
  const readmeDoc = content.docs.find((doc) => {
    const fileName = doc.contentRaw.toLowerCase();
    return fileName.includes("readme.md") || fileName.includes("index.md");
  });

  const moduleRootPath = `/${locale}/${moduleId}`;

  if (readmeDoc) {
    return (
      <div className="flex w-full">
        <aside className="hidden lg:block w-[280px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <div className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto p-4">
            <nav className="space-y-1">
              {content.sidebarTree.map((item, idx) => (
                item.urlPath ? (
                  <Link
                    key={idx}
                    href={item.urlPath}
                    className="block px-3 py-2 text-sm rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    {item.displayName}
                  </Link>
                ) : null
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="max-w-[740px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] mb-5">
              <span className="text-[var(--text-primary)]">{content.moduleMeta.title}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-[var(--text-primary)]">概述</span>
            </nav>

            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                {readmeDoc.frontmatter.title ?? content.moduleMeta.title}
              </h1>
            </div>

            <DocContent content={readmeDoc.contentRaw} basePath={moduleRootPath} />
          </div>
        </main>
      </div>
    );
  }

  // 没有 README，显示文档列表
  return (
    <div className="flex w-full">
      <aside className="hidden lg:block w-[280px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto p-4">
          <nav className="space-y-1">
            {content.sidebarTree.map((item, idx) => (
              item.urlPath ? (
                <Link
                  key={idx}
                  href={item.urlPath}
                  className="block px-3 py-2 text-sm rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {item.displayName}
                </Link>
              ) : null
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-[740px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <section className="mb-8">
            <p className="text-sm text-[var(--text-tertiary)] mb-2">模块</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
              {content.moduleMeta.title}
            </h1>
          </section>

          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">文档目录</h2>
              <span className="text-sm text-[var(--text-tertiary)]">共 {content.docs.length} 篇</span>
            </div>

            <ul className="grid gap-4 md:grid-cols-2">
              {content.docs.slice(0, 12).map((docItem) => (
                <li key={docItem.urlPath}>
                  <Link
                    href={docItem.urlPath}
                    className="block p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-600)] transition-all"
                  >
                    <h3 className="font-medium text-[var(--text-primary)]">
                      {docItem.frontmatter.title ?? docItem.displayName}
                    </h3>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
