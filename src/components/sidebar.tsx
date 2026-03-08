"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarNode } from "@/lib/docs";
import { ChevronRight, Search } from "lucide-react";

interface SidebarProps {
  items: SidebarNode[];
  currentPath: string;
}

type ExpandedState = Record<string, boolean>;

function hasActivePath(node: SidebarNode, currentPath: string): boolean {
  if (node.urlPath === currentPath) {
    return true;
  }

  return node.children?.some((child) => hasActivePath(child, currentPath)) ?? false;
}

function buildSidebarItemKey(item: SidebarNode, parentKey: string) {
  return `${parentKey}/${item.name}`;
}

function collectExpandedState(
  nodes: SidebarNode[],
  currentPath: string,
  parentKey: string,
  level: number,
  strategy: "default" | "active"
): ExpandedState {
  const expandedState: ExpandedState = {};

  for (const node of nodes) {
    if (node.type !== "group" || !node.children) {
      continue;
    }

    const nodeKey = buildSidebarItemKey(node, parentKey);
    const hasActiveChild = node.children.some((child) => hasActivePath(child, currentPath));

    if (strategy === "default") {
      expandedState[nodeKey] = level < 1 || hasActiveChild;
    } else if (hasActiveChild) {
      expandedState[nodeKey] = true;
    }

    Object.assign(
      expandedState,
      collectExpandedState(node.children, currentPath, nodeKey, level + 1, strategy)
    );
  }

  return expandedState;
}

function SidebarItem({ 
  item, 
  currentPath, 
  level = 0,
  parentKey,
  expandedState,
  onToggle,
}: { 
  item: SidebarNode; 
  currentPath: string; 
  level?: number;
  parentKey: string;
  expandedState: ExpandedState;
  onToggle: (itemKey: string) => void;
}) {
  const isActive = item.urlPath === currentPath;
  const itemKey = buildSidebarItemKey(item, parentKey);
  const hasActiveChild = item.children?.some((child) => hasActivePath(child, currentPath));
  const isExpanded = expandedState[itemKey] ?? hasActiveChild ?? level < 1;

  if (item.type === "group" && item.children) {
    return (
      <li className="mt-1">
        <button
          onClick={() => onToggle(itemKey)}
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
                parentKey={itemKey}
                expandedState={expandedState}
                onToggle={onToggle}
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
          className={`block px-3 py-1.5 text-sm transition-colors ${
            isActive
              ? "text-[var(--accent-700)] font-medium"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          aria-current={isActive ? "page" : undefined}
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
  const [expandedState, setExpandedState] = useState<ExpandedState>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const filteredItems = useMemo(() => filterNodes(items, query), [items, query]);

  const pathSegments = currentPath.split("/").filter(Boolean);
  const moduleRootPath = pathSegments.length >= 2 ? `/${pathSegments[0]}/${pathSegments[1]}` : undefined;
  const scrollStorageKey = `sidebar-scroll:${moduleRootPath ?? "default"}`;
  const expandedStorageKey = `sidebar-expanded:${moduleRootPath ?? "default"}`;
  const defaultExpandedState = useMemo(
    () => collectExpandedState(items, currentPath, "root", 0, "default"),
    [items, currentPath]
  );
  const activeExpandedState = useMemo(
    () => collectExpandedState(items, currentPath, "root", 0, "active"),
    [items, currentPath]
  );

  useEffect(() => {
    let savedExpandedState: ExpandedState = {};

    try {
      const rawSavedExpandedState = window.sessionStorage.getItem(expandedStorageKey);
      if (rawSavedExpandedState) {
        savedExpandedState = JSON.parse(rawSavedExpandedState) as ExpandedState;
      }
    } catch {
      savedExpandedState = {};
    }

    setExpandedState({
      ...defaultExpandedState,
      ...savedExpandedState,
      ...activeExpandedState,
    });
  }, [expandedStorageKey, defaultExpandedState, activeExpandedState]);

  const handleToggleGroup = (itemKey: string) => {
    setExpandedState((previousState) => {
      const nextState = {
        ...previousState,
        [itemKey]: !(previousState[itemKey] ?? false),
      };

      window.sessionStorage.setItem(expandedStorageKey, JSON.stringify(nextState));
      return nextState;
    });
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const restoreScrollTop = () => {
      const savedScrollTop = window.sessionStorage.getItem(scrollStorageKey);
      if (!savedScrollTop) {
        return;
      }

      const parsedScrollTop = Number(savedScrollTop);
      if (!Number.isFinite(parsedScrollTop)) {
        return;
      }

      scrollContainer.scrollTop = parsedScrollTop;
    };

    restoreScrollTop();
    const animationFrameId = window.requestAnimationFrame(restoreScrollTop);

    const handleScroll = () => {
      window.sessionStorage.setItem(scrollStorageKey, String(scrollContainer.scrollTop));
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.sessionStorage.setItem(scrollStorageKey, String(scrollContainer.scrollTop));
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [scrollStorageKey]);

  return (
    <aside className="hidden lg:block w-[300px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div
        ref={scrollContainerRef}
        className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto py-6"
      >
        <div className="px-5">
          {moduleRootPath && (
            <Link
              href={moduleRootPath}
              className="flex items-center gap-2 px-3 py-2 mb-4 text-sm text-[var(--accent-600)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              返回模块首页
            </Link>
          )}

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索文档..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-600)] focus:ring-1 focus:ring-[var(--accent-600)] transition-all"
            />
          </div>

          <nav>
            <ul className="space-y-0.5">
              {filteredItems.map((item, idx) => (
                <SidebarItem 
                  key={idx} 
                  item={item} 
                  currentPath={currentPath} 
                  parentKey="root"
                  expandedState={expandedState}
                  onToggle={handleToggleGroup}
                />
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
}
