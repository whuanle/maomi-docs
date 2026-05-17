"use client";

import { useEffect, useState } from "react";
import { CopyMarkdownUrlButton } from "./copy-markdown-url-button";

interface TocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

interface DocTocProps {
  containerId: string;
  markdownContent?: string;
}

const DEFAULT_HEADER_OFFSET = 65;

function getHeaderOffset() {
  const rawValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--site-header-height")
    .trim();
  const parsedValue = Number.parseFloat(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : DEFAULT_HEADER_OFFSET;
}

export function DocToc({ containerId, markdownContent }: DocTocProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    let animationFrameId = 0;
    let observer: IntersectionObserver | null = null;

    animationFrameId = window.requestAnimationFrame(() => {
      const root = document.getElementById(containerId);
      if (!root) {
        setItems([]);
        return;
      }

      const headings = Array.from(
        root.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4, h5, h6")
      );
      const tocItems: TocItem[] = headings.map((heading, index) => {
        const text = heading.textContent?.trim() ?? "";
        let id = heading.id?.trim();
        if (!id) {
          id = `heading-${index}`;
          heading.id = id;
        }
        return {
          id,
          text,
          level: Number(heading.tagName.replace("H", "")) as TocItem["level"],
        };
      });

      setItems(tocItems);

      const headerOffset = getHeaderOffset();

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id);
            }
          });
        },
        { rootMargin: `-${headerOffset}px 0px -60% 0px` }
      );

      headings.forEach((h) => observer?.observe(h));
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer?.disconnect();
    };
  }, [containerId]);

  const hasTocItems = items.length > 0;

  if (!hasTocItems && !markdownContent) return null;

  return (
    <aside className="hidden xl:block w-[300px] shrink-0">
      <div className="sticky top-[calc(var(--site-header-height)+16px)] py-4">
        {markdownContent ? (
          <div className="mb-5 px-3">
            <CopyMarkdownUrlButton markdownContent={markdownContent} />
          </div>
        ) : null}

        {hasTocItems ? (
          <>
            <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3 px-3">
              本页目录
            </h3>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(item.id);
                      if (el) {
                        const headerOffset = getHeaderOffset();
                        window.scrollTo({
                          top: el.offsetTop - headerOffset,
                          behavior: "smooth",
                        });
                      }
                    }}
                    className={`block px-3 py-1 text-sm transition-colors ${
                      activeId === item.id
                        ? "text-[var(--accent-600)] font-medium"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                    style={{ paddingLeft: `${12 + (item.level - 1) * 12}px` }}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-1.5 mt-6 px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              回到顶部
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
