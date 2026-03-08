import Link from "next/link";
import { listModules } from "@/lib/docs";
import { getLocaleTitle } from "@/lib/site-config";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [modules, siteTitle] = await Promise.all([
    listModules(),
    getLocaleTitle(locale),
  ]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-50)] text-[var(--accent-600)] text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>基于 Markdown/MDX 的现代化文档平台</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-[var(--text-primary)] mb-6 tracking-tight">
            {siteTitle}
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
            简洁、高效的文档编写与阅读体验，支持多种编程语言和技术栈
          </p>
        </div>
      </section>
      
      {/* 文档模块 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">文档模块</h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
              探索各个技术领域的详细文档和教程
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module: { id: string; title: string; description?: string }) => (
              <Link
                key={module.id}
                href={`/${locale}/${module.id}`}
                className="group block p-6 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--accent-500)] hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    {module.title.charAt(0)}
                  </div>
                  <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-600)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-600)] transition-colors">
                  {module.title}
                </h3>
                {module.description && (
                  <p className="text-sm text-[var(--text-tertiary)] line-clamp-2">{module.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

