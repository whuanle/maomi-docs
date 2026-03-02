"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { GlobalSearch } from "./global-search";
import { useState } from "react";

interface SiteHeaderProps {
  locale: string;
  modules: Array<{ id: string; title: string }>;
  siteTitle: string;
}

export function SiteHeader({ locale, modules, siteTitle }: SiteHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            <GlobalSearch locale={locale} />
            <ThemeToggle />
            
            {/* 移动端菜单按钮 */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              aria-label="菜单"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>
      <div className="h-16" />

      {/* 移动端菜单 */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 z-40 bg-[var(--bg-primary)] border-t border-[var(--border-default)]">
          <nav className="flex flex-col p-4 gap-1">
            <Link 
              href={`/${locale}`} 
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-3 text-base font-medium rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              首页
            </Link>
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/${locale}/${module.id}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-4 py-3 text-base font-medium rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                {module.title}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
