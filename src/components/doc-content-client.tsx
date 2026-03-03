"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import Prism from "prismjs";
import path from "path";

// 导入 PrismJS 语言支持
import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-nginx";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-shell-session";

interface DocContentClientProps {
  content: string;
  filePath?: string;
}

export function DocContentClient({ content, filePath }: DocContentClientProps) {
  const articleRef = useRef<HTMLDivElement>(null);

  // 预处理 content
  let processedContent = content;
  
  // 1. 移除 frontmatter
  if (processedContent.startsWith("---")) {
    const endIndex = processedContent.indexOf("---", 3);
    if (endIndex !== -1) {
      processedContent = processedContent.slice(endIndex + 3).trim();
    }
  }
  
  // 2. 检测并移除重复的 h1（如果 frontmatter 有 title）
  const lines = processedContent.split("\n");
  if (lines[0]?.startsWith("# ")) {
    lines.shift();
    processedContent = lines.join("\n");
  }

  // 3. 处理图片路径
  if (filePath) {
    // 获取文件所在目录，例如: docs/istio/ -> /docs/istio/
    const dir = path.dirname(filePath);
    const relativeDir = dir.replace(process.cwd(), "").replace(/\\/g, "/");
    
    // 处理 markdown 图片路径 ![alt](src)
    processedContent = processedContent.replace(
      /!\[([^\]]*)\]\((?!http|\/)([^)]+)\)/g,
      (match, alt, src) => {
        return `![${alt}](${relativeDir}/${src})`;
      }
    );
    
    // 处理 HTML img 标签的 src
    processedContent = processedContent.replace(
      /<img\s+([^\u003e]*)src=["'](?!http|\/)([^"']+)["']([^\u003e]*)\u003e/g,
      (match, before, src, after) => {
        return `<img ${before}src="${relativeDir}/${src}"${after}>`;
      }
    );
  }

  // 高亮代码 - 延迟执行确保 ReactMarkdown 渲染完成
  useEffect(() => {
    const timer = setTimeout(() => {
      if (articleRef.current) {
        Prism.highlightAllUnder(articleRef.current);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [processedContent]);

  return (
    <div ref={articleRef} className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeRaw]}
        components={{
          // 自定义 pre 标签（代码块容器）
          pre({ children }: any) {
            return (
              <pre className="bg-[var(--code-bg)] border border-[var(--code-border)] rounded-md p-4 my-4 overflow-x-auto">
                {children}
              </pre>
            );
          },
          // 自定义 code 标签
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            
            // 如果是代码块（有 className），只返回 code 标签，因为 pre 已经由上面的组件处理了
            if (className) {
              return (
                <code className={language ? `language-${language}` : ""} {...props}>
                  {children}
                </code>
              );
            }
            
            // 行内代码
            return (
              <code className="px-1.5 py-0.5 bg-[var(--code-bg)] text-[var(--accent-600)] rounded text-sm font-mono">
                {children}
              </code>
            );
          },
          // 自定义图片
          img({ src, alt }: any) {
            return (
              <img 
                src={src} 
                alt={alt} 
                className="max-w-full rounded-md my-6 cursor-zoom-in border border-[var(--border-default)]"
              />
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
