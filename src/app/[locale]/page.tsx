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
    <div className="max-w-[740px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="mb-12">
        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
          {siteTitle}
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          一个基于 Markdown/MDX 的文档网站
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">文档模块</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module: { id: string; title: string }) => (
            <Link
              key={module.id}
              href={`/${locale}/${module.id}`}
              className="block p-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-600)] hover:shadow-sm transition-all"
            >
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">{module.title}</h3>
              <p className="text-sm text-[var(--text-tertiary)]">{module.id}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
