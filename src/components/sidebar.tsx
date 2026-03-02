"use client";

import Link from "next/link";
import { useState } from "react";

interface SidebarItem {
  type: string;
  name: string;
  displayName: string;
  urlPath?: string;
  children?: SidebarItem[];
}

interface SidebarProps {
  items: SidebarItem[];
  currentPath: string;
}

function SidebarItemComponent({ 
  item, 
  currentPath, 
  level = 0 
}: { 
  item: SidebarItem; 
  currentPath: string; 
  level?: number;
}) {
  const isActive = item.urlPath === currentPath;
  const hasChildren = item.children && item.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(true);

  // 外部链接
  if (item.type === "link" && item.urlPath) {
    return (
      <li>
        <a
          href={item.urlPath}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {item.displayName}
        </a>
      </li>
    );
  }

  // 文档链接
  if (item.type === "doc" && item.urlPath) {
    return (
      <li>
        <Link
          href={item.urlPath}
          className={`block px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
            isActive
              ? "bg-[var(--accent-50)] text-[var(--accent-600)] font-medium"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {item.displayName}
        </Link>
      </li>
    );
  }

  // 分组/文件夹
  return (
    <li>
      {hasChildren ? (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            style={{ paddingLeft: `${12 + level * 16}px` }}
          >
            <span className="font-medium">{item.displayName}</span>
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {isExpanded && (
            <ul className="mt-0.5 space-y-0.5">
              {item.children!.map((child, idx) => (
                <SidebarItemComponent 
                  key={idx} 
                  item={child} 
                  currentPath={currentPath} 
                  level={level + 1} 
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <span 
          className="block px-3 py-2 text-sm text-[var(--text-secondary)]"
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {item.displayName}
        </span>
      )}
    </li>
  );
}

export function Sidebar({ items, currentPath }: SidebarProps) {
  const [query, setQuery] = useState("");
  
  // 过滤功能
  const filteredItems = items.filter((item) => {
    if (!query) return true;
    return item.displayName.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <aside className="hidden lg:block w-[280px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
        <div className="p-4">
          {/* 搜索框 */}
          <div className="relative mb-4">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索文档..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-600)] focus:ring-2 focus:ring-[var(--accent-100)] transition-all"
            />
          </div>

          {/* 文档导航 */}
          <nav>
            <ul className="space-y-0.5">
              {filteredItems.map((item, idx) => (
                <SidebarItemComponent 
                  key={idx} 
                  item={item} 
                  currentPath={currentPath} 
                />
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
}
