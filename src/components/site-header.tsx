import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

interface SiteHeaderProps {
  locale: string;
  modules: Array<{ id: string; title: string }>;
  siteTitle: string;
}

export function SiteHeader({ locale, modules, siteTitle }: SiteHeaderProps) {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[var(--border-default)] bg-[var(--bg-tertiary)]/95 backdrop-blur">
        <div className="h-full flex items-center justify-between px-4 lg:px-6 max-w-[1440px] mx-auto">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent-600)]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-600)] to-[var(--accent-700)] text-white flex items-center justify-center font-bold text-sm">
              📚
            </div>
            <span className="font-semibold text-base hidden sm:block">{siteTitle}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href={`/${locale}`} className="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
              首页
            </Link>
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/${locale}/${module.id}`}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                {module.title}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="h-16" />
    </>
  );
}
