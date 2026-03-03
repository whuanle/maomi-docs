"use client";

import { useState } from "react";
import { Check, FileText } from "lucide-react";

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
      className={`group flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
        copied 
          ? "text-green-600 bg-green-50 border-green-200" 
          : "text-[var(--text-muted)] bg-[var(--bg-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--accent-400)]"
      }`}
      title="复制 Markdown 源码"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>已复制</span>
        </>
      ) : (
        <>
          <FileText className="w-3.5 h-3.5" />
          <span>复制 Markdown</span>
        </>
      )}
    </button>
  );
}
