"use client";

import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

interface DocTocProps {
  containerId: string;
}

export function DocToc({ containerId }: DocTocProps) {
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

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id);
            }
          });
        },
        { rootMargin: "-80px 0px -60% 0px" }
      );

      headings.forEach((h) => observer?.observe(h));
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer?.disconnect();
    };
  }, [containerId]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden xl:block w-[300px] shrink-0">
      <div className="sticky top-20 py-4">
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
                    window.scrollTo({
                      top: el.offsetTop - 80,
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
      </div>
    </aside>
  );
}
