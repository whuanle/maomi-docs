"use client";

import { Children, isValidElement, type ComponentPropsWithoutRef, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import { rehypeSanitizeHtml } from "@/lib/rehype-sanitize-html";
import Prism from "prismjs";
import path from "path";
import { stripFrontmatter } from "@/lib/markdown";
import { ZoomableImage } from "./zoomable-image";
import { MermaidDiagram } from "./mermaid-diagram";
import { CodeTabs } from "./doc-tabs";
import { remarkCodeTabs } from "@/lib/remark-code-tabs";

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
  currentPath?: string;
}

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: {
    start?: {
      line?: number;
    };
    end?: {
      line?: number;
    };
  };
}

const GAP_PRESERVING_PARENT_TYPES = new Set(["root", "blockquote", "listItem"]);

function createBreakNodes(count: number): MarkdownNode[] {
  if (count <= 0) {
    return [];
  }

  return Array.from({ length: count }, () => ({
    type: "html",
    value: "<br />",
  }));
}

function getExtraBlankLineCount(current: MarkdownNode, next: MarkdownNode): number {
  const endLine = current.position?.end?.line;
  const startLine = next.position?.start?.line;

  if (typeof endLine !== "number" || typeof startLine !== "number") {
    return 0;
  }

  return Math.max(0, startLine - endLine - 2);
}

function preserveBlankLines(node: MarkdownNode) {
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return;
  }

  const originalChildren = [...node.children];

  for (const child of originalChildren) {
    preserveBlankLines(child);
  }

  if (node.type === "list") {
    for (let index = 0; index < originalChildren.length - 1; index += 1) {
      const currentChild = originalChildren[index];
      const nextChild = originalChildren[index + 1];
      const extraBlankLines = getExtraBlankLineCount(currentChild, nextChild);

      if (extraBlankLines > 0 && Array.isArray(currentChild.children)) {
        currentChild.children = [
          ...currentChild.children,
          ...createBreakNodes(1),
        ];
      }
    }

    return;
  }

  if (!GAP_PRESERVING_PARENT_TYPES.has(node.type)) {
    return;
  }

  const nextChildren: MarkdownNode[] = [];

  for (let index = 0; index < originalChildren.length; index += 1) {
    const currentChild = originalChildren[index];
    const nextChild = originalChildren[index + 1];

    nextChildren.push(currentChild);

    if (!nextChild) {
      continue;
    }

    const extraBlankLines = getExtraBlankLineCount(currentChild, nextChild);

    if (extraBlankLines > 0) {
      nextChildren.push(...createBreakNodes(1));
    }
  }

  node.children = nextChildren;
}

function remarkPreserveBlankLines() {
  return (tree: MarkdownNode) => {
    preserveBlankLines(tree);
  };
}

function getDocBaseDir(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const docsMarker = "/docs/";
  const markerIndex = normalizedPath.lastIndexOf(docsMarker);

  let pathInDocs: string;
  if (markerIndex >= 0) {
    pathInDocs = normalizedPath.slice(markerIndex + docsMarker.length);
  } else if (normalizedPath.startsWith("docs/")) {
    pathInDocs = normalizedPath.slice("docs/".length);
  } else {
    pathInDocs = normalizedPath;
  }

  const docDir = path.posix.dirname(pathInDocs);
  if (!docDir || docDir === ".") {
    return "/docs";
  }

  return `/docs/${docDir}`;
}

function resolveAssetSrc(src: string, docBaseDir: string): string {
  const trimmed = src.trim();

  // 绝对 URL、协议相对 URL、根路径和锚点不处理
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(trimmed)) {
    return trimmed;
  }

  const normalizedSrc = trimmed.replace(/\\/g, "/");
  return path.posix.join(docBaseDir, normalizedSrc);
}

function getDocRouteBasePath(filePath: string, currentPath: string): string | null {
  const currentSegments = currentPath.split("/").filter(Boolean);
  if (currentSegments.length < 2) {
    return null;
  }

  const locale = currentSegments[0];
  const normalizedPath = filePath.replace(/\\/g, "/");
  const docsMarker = "/docs/";
  const markerIndex = normalizedPath.lastIndexOf(docsMarker);

  let pathInDocs: string;
  if (markerIndex >= 0) {
    pathInDocs = normalizedPath.slice(markerIndex + docsMarker.length);
  } else if (normalizedPath.startsWith("docs/")) {
    pathInDocs = normalizedPath.slice("docs/".length);
  } else {
    pathInDocs = normalizedPath;
  }

  const pathSegments = pathInDocs.split("/").filter(Boolean);
  if (pathSegments.length === 0) {
    return null;
  }

  const moduleId = pathSegments[0] || currentSegments[1];
  const docDirSegments = pathSegments.slice(1, -1);
  return `/${[locale, moduleId, ...docDirSegments].join("/")}`;
}

function resolveDocHref(href: string, docRouteBasePath: string): string {
  const trimmed = href.trim();

  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(trimmed)) {
    return trimmed;
  }

  const normalizedHref = trimmed.replace(/\\/g, "/");
  const match = normalizedHref.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const relativePath = match?.[1] ?? normalizedHref;
  const search = match?.[2] ?? "";
  const hash = match?.[3] ?? "";

  if (!/\.mdx?$/i.test(relativePath)) {
    return trimmed;
  }

  const resolvedPath = path.posix.normalize(path.posix.join(docRouteBasePath, relativePath));
  return `${resolvedPath}${search}${hash}`;
}

// 非 md 的相对链接指向文档库里的附属文件（如 docker-compose.yml），
// 重写到 /docs 静态路由（由 next.config rewrites 转发到 /api/docs）供下载
function resolveDocAssetHref(href: string, docBaseDir: string): string | null {
  const trimmed = href.trim();

  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(trimmed)) {
    return null;
  }

  const match = trimmed.replace(/\\/g, "/").match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const relativePath = match?.[1] ?? trimmed;
  if (!relativePath || /\.mdx?$/i.test(relativePath)) {
    return null;
  }

  return path.posix.normalize(path.posix.join(docBaseDir, relativePath));
}

export function DocContentClient({ content, filePath, currentPath }: DocContentClientProps) {
  const articleRef = useRef<HTMLDivElement>(null);

  // 预处理 content
  let processedContent = content;

  // 1. 移除 frontmatter
  processedContent = stripFrontmatter(processedContent);

  const docBaseDir = filePath ? getDocBaseDir(filePath) : null;

  // 2. 处理图片/视频路径
  if (docBaseDir) {
    // markdown 视频语法 ![alt](demo.mp4) 转为 <video> 播放器
    processedContent = processedContent.replace(
      /!\[([^\]]*)\]\(([^)]+\.(?:mp4|m4v|webm|mov|ogv))\)/gi,
      (match, alt, src) => {
        return `<video controls preload="metadata" src="${resolveAssetSrc(src, docBaseDir)}"></video>`;
      }
    );

    // 处理 markdown 图片路径 ![alt](src)
    processedContent = processedContent.replace(
      /!\[([^\]]*)\]\((?!http|\/)([^)]+)\)/g,
      (match, alt, src) => {
        return `![${alt}](${resolveAssetSrc(src, docBaseDir)})`;
      }
    );

    // 处理 HTML img 标签的 src
    processedContent = processedContent.replace(
      /<img\s+([^\u003e]*)src=["'](?!http|\/)([^"']+)["']([^\u003e]*)\u003e/g,
      (match, before, src, after) => {
        return `<img ${before}src="${resolveAssetSrc(src, docBaseDir)}"${after}>`;
      }
    );

    // 处理 HTML video / source 标签的 src
    processedContent = processedContent.replace(
      /(<video\b[^\u003e]*?\bsrc=["'])(?!http|\/)([^"']+)(["'])/gi,
      (match, prefix, src, quote) => `${prefix}${resolveAssetSrc(src, docBaseDir)}${quote}`
    );

    processedContent = processedContent.replace(
      /(<source\b[^\u003e]*?\bsrc=["'])(?!http|\/)([^"']+)(["'])/gi,
      (match, prefix, src, quote) => `${prefix}${resolveAssetSrc(src, docBaseDir)}${quote}`
    );
  }

  const docRouteBasePath = filePath && currentPath ? getDocRouteBasePath(filePath, currentPath) : null;

  // 高亮代码 - 延迟执行确保 ReactMarkdown 渲染完成
  useEffect(() => {
    const timer = setTimeout(() => {
      if (articleRef.current) {
        Prism.highlightAllUnder(articleRef.current);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [processedContent]);

  const markdownComponents = {
    // div 拦截：把 remark-code-tabs 产出的 <div class="codetabs"> 交给 CodeTabs 渲染
    div({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
      if (typeof className === "string" && className.includes("codetabs")) {
        return <CodeTabs>{children}</CodeTabs>;
      }
      return (
        <div className={className} {...props}>
          {children}
        </div>
      );
    },
    // 自定义 pre 标签（代码块容器）
    pre({ children }: ComponentPropsWithoutRef<"pre">) {
      const firstChild = Children.count(children) > 0 ? Children.toArray(children)[0] : null;

      if (
        isValidElement<{ className?: string }>(firstChild) &&
        typeof firstChild.props.className === "string" &&
        firstChild.props.className.includes("language-mermaid")
      ) {
        return <>{children}</>;
      }

      return (
        <pre tabIndex={0} className="bg-[var(--code-bg)] border border-[var(--code-border)] rounded-md p-4 my-4 overflow-x-auto">
          {children}
        </pre>
      );
    },
    // 自定义 code 标签
    code({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";

      if (language.toLowerCase() === "mermaid") {
        const chart = String(children).trim();
        return <MermaidDiagram chart={chart} />;
      }

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
    img({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) {
      const imageSrc = typeof src === "string" ? src : undefined;

      return (
        <ZoomableImage
          src={imageSrc}
          alt={alt}
          className="block max-w-full mx-auto rounded-md my-6 cursor-zoom-in border border-[var(--border-default)]"
          {...props}
        />
      );
    },
    // 自定义视频：统一宽度样式，默认可控制播放
    video({ className, children, node: _node, ...props }: ComponentPropsWithoutRef<"video"> & { node?: unknown }) {
      return (
        <video
          className={className ?? "block max-w-full mx-auto rounded-md my-6 border border-[var(--border-default)]"}
          {...props}
          controls
          preload="metadata"
        >
          {children}
        </video>
      );
    },
    a({ href, children, node: _node, ...props }: ComponentPropsWithoutRef<"a"> & { node?: unknown }) {
      const resolvedHref = href && docRouteBasePath ? resolveDocHref(href, docRouteBasePath) : href;

      // 附属文件链接：走 /docs 静态路由并以下载方式打开，避免浏览器当成页面路由 404
      const assetHref = resolvedHref && docBaseDir ? resolveDocAssetHref(resolvedHref, docBaseDir) : null;
      if (assetHref) {
        return (
          <a href={assetHref} download {...props}>
            {children}
          </a>
        );
      }

      if (resolvedHref && resolvedHref.startsWith("/")) {
        return (
          <Link href={resolvedHref} {...props}>
            {children}
          </Link>
        );
      }

      return (
        <a href={resolvedHref} {...props}>
          {children}
        </a>
      );
    },
  } as Components;

  return (
    <div ref={articleRef} className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, remarkCodeTabs, remarkPreserveBlankLines]}
        rehypePlugins={[rehypeSlug, rehypeRaw, rehypeSanitizeHtml, rehypeKatex]}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

