"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { GlobalSearch } from "./global-search";

interface ModuleMeta {
  id: string;
  title: string;
}

interface SiteHeaderProps {
  locale: string;
  modules: ModuleMeta[];
  siteTitle: string;
}

export function SiteHeader({ locale, modules, siteTitle }: SiteHeaderProps) {
  const pathname = usePathname() ?? `/${locale}`;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const homeHref = `/${locale}`;

  const isModuleActive = (moduleId: string) => {
    const modulePath = `/${locale}/${moduleId}`;
    return pathname === modulePath || pathname.startsWith(`${modulePath}/`);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
        <div className="h-full flex items-center justify-between px-4 lg:px-8 w-full">
          {/* Logo + 网站标题 - 可点击返回首页 */}
          <Link 
            href={homeHref} 
            className="flex items-center gap-2.5 text-[var(--accent-600)] shrink-0 hover:opacity-80 transition-opacity"
            title="返回首页"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-600)] text-white flex items-center justify-center font-bold">
              文
            </div>
            <span className="font-semibold hidden sm:block">{siteTitle}</span>
          </Link>

          {/* 导航菜单 中间 - 去掉首页 */}
          <nav className="hidden lg:flex items-stretch gap-1 absolute left-1/2 -translate-x-1/2 h-full">
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/${locale}/${module.id}`}
                className={`inline-flex items-center h-full px-3 text-sm whitespace-nowrap transition-colors ${
                  isModuleActive(module.id)
                    ? "text-[var(--accent-700)] font-semibold border-b-2 border-[var(--accent-600)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--accent-700)]"
                }`}
                aria-current={isModuleActive(module.id) ? "page" : undefined}
              >
                {module.title}
              </Link>
            ))}
          </nav>

          {/* 右侧工具栏 */}
          <div className="flex items-center gap-1 shrink-0">
            <GlobalSearch locale={locale} />
            <ThemeToggle />
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
            </a>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden w-9 h-9 flex items-center justify-center text-[var(--text-secondary)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed top-16 left-0 right-0 bottom-0 z-40 bg-[var(--bg-primary)] border-t border-[var(--border-default)]">
          <nav className="flex flex-col p-4 gap-1">
            <Link
              href={homeHref}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-3 rounded-md text-sm text-[var(--accent-600)] hover:bg-[var(--bg-hover)]"
            >
              首页
            </Link>
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/${locale}/${module.id}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-md text-sm ${
                  isModuleActive(module.id)
                    ? "text-[var(--accent-600)] bg-[var(--accent-50)]"
                    : "text-[var(--accent-600)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {module.title}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <div className="h-16" />
    </>
  );
}
