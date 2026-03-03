"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SidebarNode } from "@/lib/docs";
import { ChevronRight } from "lucide-react";

interface SidebarProps {
  items: SidebarNode[];
  currentPath: string;
}

function SidebarItem({ 
  item, 
  currentPath, 
  level = 0 
}: { 
  item: SidebarNode; 
  currentPath: string; 
  level?: number;
}) {
  const isActive = item.urlPath === currentPath;
  const hasActiveChild = item.children?.some(child => 
    child.urlPath === currentPath || child.children?.some(c => c.urlPath === currentPath)
  );
  const [isExpanded, setIsExpanded] = useState(hasActiveChild || level < 1);

  if (item.type === "group" && item.children) {
    return (
      <li className="mt-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md transition-colors"
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <span>{item.displayName}</span>
          <ChevronRight 
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`} 
          />
        </button>
        {isExpanded && (
          <ul className="mt-0.5">
            {item.children.map((child, idx) => (
              <SidebarItem 
                key={idx} 
                item={child} 
                currentPath={currentPath} 
                level={level + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  if (item.type === "doc" && item.urlPath) {
    return (
      <li className="mt-0.5">
        <Link
          href={item.urlPath}
          className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
            isActive
              ? "text-[var(--accent-600)] bg-[var(--accent-50)] font-medium"
              : "text-[var(--accent-600)] hover:bg-[var(--bg-hover)]"
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {item.displayName}
        </Link>
      </li>
    );
  }

  return null;
}

function filterNodes(nodes: SidebarNode[], keyword: string): SidebarNode[] {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return nodes;

  return nodes.filter((node) => {
    const selfMatched = node.displayName.toLowerCase().includes(normalizedKeyword);
    const childrenMatched = node.children?.some(child => 
      child.displayName.toLowerCase().includes(normalizedKeyword)
    );
    return selfMatched || childrenMatched;
  });
}

export function Sidebar({ items, currentPath }: SidebarProps) {
  const [query, setQuery] = useState("");
  const filteredItems = useMemo(() => filterNodes(items, query), [items, query]);

  const pathSegments = currentPath.split("/").filter(Boolean);
  const moduleRootPath = pathSegments.length >= 2 ? `/${pathSegments[0]}/${pathSegments[1]}` : undefined;

  return (
    <aside className="hidden lg:block w-[260px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-sidebar)]">
      <div className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto py-4">
        <div className="px-4">
          {moduleRootPath && (
            <Link
              href={moduleRootPath}
              className="flex items-center gap-2 px-3 py-2 mb-3 text-sm text-[var(--accent-600)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              返回模块首页
            </Link>
          )}

          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索文档..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-600)]"
            />
          </div>

          <nav>
            <ul className="space-y-0.5">
              {filteredItems.map((item, idx) => (
                <SidebarItem 
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
