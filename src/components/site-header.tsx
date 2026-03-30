"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  const headerRef = useRef<HTMLElement | null>(null);

  const homeHref = `/${locale}`;

  const isModuleActive = (moduleId: string) => {
    const modulePath = `/${locale}/${moduleId}`;
    return pathname === modulePath || pathname.startsWith(`${modulePath}/`);
  };

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) {
      return;
    }

    const rootStyle = document.documentElement.style;
    const updateHeaderHeight = () => {
      rootStyle.setProperty("--site-header-height", `${headerElement.offsetHeight}px`);
    };

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeaderHeight();
    });

    resizeObserver.observe(headerElement);
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-primary)]"
      >
        <div className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-3 lg:px-8">
          {/* Logo + 网站标题 - 可点击返回首页 */}
          <Link 
            href={homeHref} 
            className="flex min-h-9 items-center gap-2.5 self-center shrink-0 hover:opacity-80 transition-opacity"
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
          <nav className="flex min-w-0 flex-wrap items-center justify-start gap-x-1 gap-y-2 px-2">
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/${locale}/${module.id}`}
                className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm whitespace-nowrap transition-colors ${
                  isModuleActive(module.id)
                    ? "bg-[var(--accent-50)] text-[var(--accent-700)] font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-700)]"
                }`}
                aria-current={isModuleActive(module.id) ? "page" : undefined}
              >
                {module.title}
              </Link>
            ))}
          </nav>

          {/* 右侧工具栏 */}
          <div className="site-header-toolbar flex min-h-9 items-center justify-end gap-1 self-start shrink-0">
            {headerLinks.length > 0 && (
              <div className="site-header-links hidden xl:flex items-center gap-1 mr-1">
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
          </div>
        </div>
      </header>

      <div className="h-[var(--site-header-height)]" />
    </>
  );
}
