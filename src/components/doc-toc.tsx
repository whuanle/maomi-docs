"use client";

import { useEffect, useMemo, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocTocProps {
  containerId: string;
}

export function DocToc({ containerId }: DocTocProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const headings = container.querySelectorAll("h2, h3");
    const tocItems: TocItem[] = [];
    
    headings.forEach((heading, index) => {
      const text = heading.textContent?.trim() ?? "";
      if (!text) return;
      
      let id = heading.id;
      if (!id) {
        id = `section-${index}`;
        heading.id = id;
      }
      
      tocItems.push({
        id,
        text,
        level: heading.tagName === "H2" ? 2 : 3,
      });
    });

    setItems(tocItems);
    setActiveId(tocItems[0]?.id ?? "");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -70%" }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [containerId]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden xl:block w-[240px] shrink-0">
      <div className="sticky top-20 py-4">
        <div className="pl-4 border-l border-[var(--border-default)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 px-2">
            本页目录
          </h2>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`block py-1 text-sm transition-all duration-200 border-l-2 -ml-[17px] ${
                    activeId === item.id
                      ? "text-[var(--accent-600)] border-[var(--accent-600)] font-medium"
                      : "text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]"
                  }`}
                  style={{ paddingLeft: item.level === 3 ? "28px" : "16px" }}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-6 flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--accent-600)] transition-colors px-2"
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
