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
      <section className="relative pt-20 pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]">
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
          <p className="text-xl text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto">
            简洁、高效的文档编写与阅读体验，支持多种编程语言和技术栈
          </p>

          {/* 产品截图占位区 */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent-500)] to-purple-600 rounded-2xl blur opacity-20"></div>
            <div className="relative aspect-[16/9] max-w-4xl mx-auto rounded-xl border-2 border-dashed border-[var(--border-dashed)] bg-[var(--bg-card)] flex items-center justify-center shadow-lg">
              <div className="text-center p-8">
                <svg className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-[var(--text-muted)] text-lg">这里可以替换为你的产品截图、架构图或教程流程图</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 内容更新方式 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[var(--bg-secondary)]">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-6">
                内容更新方式
              </h2>
              <div className="space-y-4 text-[var(--text-secondary)]">
                <p className="leading-relaxed">
                  本站页面直接读取 <code className="px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--accent-600)] font-mono text-sm">docs</code> 目录中的 Markdown/MDX 文件。
                </p>
                <p className="leading-relaxed">
                  教程更新后只需拉取最新 docs 内容，页面会按最新文档实时展示，无需重新制作 Docker 镜像。
                </p>
                <div className="flex gap-4 pt-4">
                  <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>实时更新</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>无需重启</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>支持 Docker</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-50)] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[var(--text-primary)]">文档结构</h3>
              </div>
              <pre className="text-sm text-[var(--text-secondary)] font-mono leading-relaxed">
                {`docs/
├── README.md
├── map.json
├── module1/
│   ├── README.md
│   └── 1.intro.md
└── module2/
    └── README.md`}
              </pre>
            </div>
          </div>
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
