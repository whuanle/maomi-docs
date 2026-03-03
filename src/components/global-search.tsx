"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface SearchResult {
  title: string;
  path: string;
  module: string;
}

export function GlobalSearch({ locale }: { locale: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&locale=${locale}`);
      const data = await response.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-muted)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg border border-[var(--border-default)] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>搜索</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded text-[var(--text-muted)]">
          ⌘K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-xl bg-[var(--bg-primary)] rounded-lg shadow-xl border border-[var(--border-default)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)]">
              <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索文档..."
                className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                autoFocus
              />
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-[var(--text-muted)]">搜索中...</div>
              ) : results.length > 0 ? (
                <ul className="py-2">
                  {results.map((result, idx) => (
                    <li key={idx}>
                      <Link
                        href={result.path}
                        onClick={() => setIsOpen(false)}
                        className="flex flex-col px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        <span className="font-medium text-[var(--text-primary)]">{result.title}</span>
                        <span className="text-sm text-[var(--text-muted)]">{result.module}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : query ? (
                <div className="p-8 text-center text-[var(--text-muted)]">未找到相关文档</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
