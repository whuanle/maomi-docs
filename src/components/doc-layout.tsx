"use client";

import Link from "next/link";
import { CopyMarkdownUrlButton } from "./copy-markdown-url-button";
import { DocContent } from "./doc-content";
import { DocToc } from "./doc-toc";
import { Sidebar } from "./sidebar";
import { SidebarNode } from "@/lib/docs";
import { startsWithMarkdownHeading } from "@/lib/markdown";

interface DocItem {
  moduleId: string;
  locale: string;
  displayName: string;
  urlPath: string;
  contentRaw: string;
  frontmatter: {
    title?: string;
    updatedAt?: string;
  };
  filePath?: string;
}

interface DocLayoutProps {
  currentPath: string;
  sidebarItems: SidebarNode[];
  doc: DocItem;
  prev?: DocItem | null;
  next?: DocItem | null;
}

export function DocLayout({ currentPath, sidebarItems, doc, prev, next }: DocLayoutProps) {
  const title = doc.frontmatter.title ?? doc.displayName;
  const moduleRootPath = `/${doc.locale}/${doc.moduleId}`;
  const moduleTitle = doc.moduleId.toUpperCase();
  const updatedAt = doc.frontmatter.updatedAt;
  const articleContainerId = "doc-article-content";
  const showPageTitle = !startsWithMarkdownHeading(doc.contentRaw);

  return (
    <div className="flex w-full">
      <Sidebar items={sidebarItems} currentPath={currentPath} />

      <main className="flex-1 min-w-0">
        <div className="max-w-[1100px] mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] mb-5">
            <Link href={moduleRootPath} className="hover:text-[var(--accent-600)]">
              {moduleTitle}
            </Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[var(--text-primary)]">{title}</span>
          </nav>

          {/* Title + Copy */}
          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {showPageTitle ? (
                <h1 className="min-w-0 text-4xl sm:text-5xl font-bold text-[var(--text-primary)] leading-tight">
                  {title}
                </h1>
              ) : (
                <div />
              )}
              <div className="shrink-0">
                <CopyMarkdownUrlButton markdownContent={doc.contentRaw} />
              </div>
            </div>
            {updatedAt && (
              <div className="mt-2 text-xs text-[var(--text-muted)]">更新于 {updatedAt}</div>
            )}
          </div>

          {/* Content */}
          <div id={articleContainerId}>
            <DocContent content={doc.contentRaw} filePath={doc.filePath} currentPath={currentPath} />
          </div>

          {/* Prev/Next Navigation */}
          <div className="mt-16 pt-8 border-t border-[var(--border-default)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prev ? (
                <Link
                  href={prev.urlPath}
                  className="group flex flex-col p-4 rounded-lg border border-[var(--border-default)] hover:border-[var(--accent-600)]"
                >
                  <span className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    上一篇
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-600)]">
                    {prev.frontmatter.title ?? prev.displayName}
                  </span>
                </Link>
              ) : (
                <div />
              )}

              {next ? (
                <Link
                  href={next.urlPath}
                  className="group flex flex-col items-end text-right p-4 rounded-lg border border-[var(--border-default)] hover:border-[var(--accent-600)]"
                >
                  <span className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1">
                    下一篇
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-600)]">
                    {next.frontmatter.title ?? next.displayName}
                  </span>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>
      </main>

      <DocToc containerId={articleContainerId} />
    </div>
  );
}
