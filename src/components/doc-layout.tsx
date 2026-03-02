import Link from "next/link";
import { CopyMarkdownUrlButton } from "./copy-markdown-url-button";
import { DocContent } from "./doc-content";
import { DocToc } from "./doc-toc";
import { Sidebar } from "./sidebar";

interface SidebarItem {
  type: string;
  name: string;
  displayName: string;
  urlPath?: string;
  children?: SidebarItem[];
}

interface DocLayoutProps {
  currentPath: string;
  sidebarItems: SidebarItem[];
  doc: {
    moduleId: string;
    locale: string;
    displayName: string;
    urlPath: string;
    contentRaw: string;
    frontmatter: {
      title?: string;
      updatedAt?: string;
    };
  };
  prev?: { frontmatter: { title?: string }; displayName: string; urlPath: string } | null;
  next?: { frontmatter: { title?: string }; displayName: string; urlPath: string } | null;
}

function hasH1Title(content: string): boolean {
  const lines = content.split("\n");
  let contentStart = 0;
  
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        contentStart = i + 1;
        break;
      }
    }
  }
  
  const body = lines.slice(contentStart).join("\n").trim();
  return body.startsWith("# ");
}

export function DocLayout({ currentPath, sidebarItems, doc, prev, next }: DocLayoutProps) {
  const title = doc.frontmatter.title ?? doc.displayName;
  const moduleRootPath = `/${doc.locale}/${doc.moduleId}`;
  const moduleTitle = doc.moduleId.toUpperCase();
  const articleContainerId = "doc-article-content";
  const shouldShowTitle = !hasH1Title(doc.contentRaw);

  return (
    <div className="flex w-full">
      <Sidebar items={sidebarItems} currentPath={currentPath} />

      <main className="flex-1 min-w-0">
        <div className="max-w-[740px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] mb-5">
            <Link href={moduleRootPath} className="hover:text-[var(--accent-600)]">{moduleTitle}</Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[var(--text-primary)]">{title}</span>
            {doc.frontmatter.updatedAt && (
              <>
                <span className="text-[var(--border-strong)] mx-1">·</span>
                <span className="text-xs text-[var(--text-muted)]">更新于 {doc.frontmatter.updatedAt}</span>
              </>
            )}
          </nav>

          {shouldShowTitle ? (
            <div className="mb-8 flex items-start justify-between gap-4">
              <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">{title}</h1>
              <CopyMarkdownUrlButton markdownContent={doc.contentRaw} />
            </div>
          ) : (
            <div className="mb-6 flex justify-end">
              <CopyMarkdownUrlButton markdownContent={doc.contentRaw} />
            </div>
          )}

          <div id={articleContainerId}>
            <DocContent content={doc.contentRaw} basePath={moduleRootPath} />
          </div>

          <div className="mt-16 pt-8 border-t border-[var(--border-default)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prev && (
                <Link href={prev.urlPath} className="group flex flex-col p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-600)]">
                  <span className="text-xs text-[var(--text-muted)] mb-1">← 上一篇</span>
                  <span className="text-sm font-medium">{prev.frontmatter.title ?? prev.displayName}</span>
                </Link>
              )}
              {next && (
                <Link href={next.urlPath} className="group flex flex-col items-end text-right p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-600)]">
                  <span className="text-xs text-[var(--text-muted)] mb-1">下一篇 →</span>
                  <span className="text-sm font-medium">{next.frontmatter.title ?? next.displayName}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <DocToc containerId={articleContainerId} />
    </div>
  );
}
