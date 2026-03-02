"use client";

import { useState } from "react";

interface CopyMarkdownUrlButtonProps {
  markdownContent: string;
}

export function CopyMarkdownUrlButton({ markdownContent }: CopyMarkdownUrlButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (markdownContent) {
        await navigator.clipboard.writeText(markdownContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded-lg border border-[var(--border-default)] transition-all duration-200"
      title="复制 Markdown 源码"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        )}
      </svg>
      <span>{copied ? "已复制" : "复制"}</span>
    </button>
  );
}
