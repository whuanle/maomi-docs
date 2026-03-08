"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SiteLink } from "@/lib/site-config";
import { SiteLinkItem } from "./site-link-item";
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
  headerLinks: SiteLink[];
}

export function SiteHeader({
  locale,
  modules,
  siteTitle,
  headerLinks,
}: SiteHeaderProps) {
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
            className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity"
            title="返回首页"
          >
            <Image
              src="/logo.png"
              alt={`${siteTitle} logo`}
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-lg object-contain"
            />
            <span className="font-semibold hidden sm:block text-[var(--text-primary)]">
              {siteTitle}
            </span>
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
            {headerLinks.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 mr-1">
                {headerLinks.map((link) => (
                  <SiteLinkItem
                    key={`${link.label}-${link.href}`}
                    link={link}
                    className="inline-flex h-9 items-center rounded-md px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                  />
                ))}
              </div>
            )}
            <GlobalSearch locale={locale} />
            <ThemeToggle />

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
            {headerLinks.length > 0 && (
              <div className="mt-3 border-t border-[var(--border-default)] pt-3 flex flex-col gap-1">
                {headerLinks.map((link) => (
                  <SiteLinkItem
                    key={`${link.label}-${link.href}`}
                    link={link}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  />
                ))}
              </div>
            )}
          </nav>
        </div>
      )}

      <div className="h-16" />
    </>
  );
}
