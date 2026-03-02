import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypePrism from "rehype-prism-plus";
import type { ImgHTMLAttributes } from "react";
import React from "react";
import { ZoomableImage } from "./zoomable-image";
import { CodeBlock } from "./code-block";

interface DocContentProps {
  content: string;
  basePath: string;
}

function preprocessMarkdown(content: string): string {
  content = content.replace(/\s+style=("[^"]*"|'[^']*')/gi, "");
  content = content.replace(/\s+width=("[^"]*"|'[^']*')/gi, "");
  content = content.replace(/\s+height=("[^"]*"|'[^']*')/gi, "");
  return content;
}

function extractBody(raw: string): string {
  const lines = raw.split("\n");
  if (!lines[0]?.trim().startsWith("---")) {
    return preprocessMarkdown(raw);
  }
  
  let separatorCount = 0;
  let endLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      separatorCount++;
      if (separatorCount === 2) {
        endLine = i;
        break;
      }
    }
  }
  
  if (separatorCount < 2) return preprocessMarkdown(raw);
  
  const frontmatter = lines.slice(0, endLine + 1).join("\n");
  const body = lines.slice(endLine + 1).join("\n");
  return frontmatter + "\n" + preprocessMarkdown(body);
}

export function DocContent({ content, basePath }: DocContentProps) {
  const body = extractBody(content);

  const mdxComponents = {
    img: (props: ImgHTMLAttributes<HTMLImageElement>) => (
      <ZoomableImage {...props} basePath={basePath} />
    ),
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => {
      const { children, ...rest } = props;
      const hasImage = React.Children.toArray(children).some(
        (child) => typeof child === "object" && child !== null && "type" in child
      );
      return hasImage ? <div className="my-6" {...rest}>{children}</div> : <p className="mb-4" {...rest}>{children}</p>;
    },
    pre: (props: React.HTMLAttributes<HTMLPreElement> & { children?: React.ReactNode }) => {
      const { children, className, ...rest } = props;
      // 如果是代码块（有 language- 类名），使用 CodeBlock 组件
      if (className?.includes("language-")) {
        return (
          <CodeBlock className={`rounded-lg border border-[var(--border-default)] bg-[var(--code-bg)] overflow-x-auto my-4 ${className}`}>
            {children}
          </CodeBlock>
        );
      }
      return <pre {...rest} className="rounded-lg border border-[var(--border-default)] bg-[var(--code-bg)] overflow-x-auto my-4 p-4" />;
    },
    code: (props: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
      const { className, children, ...rest } = props;
      if (className?.includes("language-")) {
        return <code className={className} {...rest}>{children}</code>;
      }
      return <code className="px-1.5 py-0.5 rounded bg-[var(--accent-50)] text-[var(--accent-700)] text-sm font-mono" {...rest}>{children}</code>;
    },
  };

  return (
    <article className="docs-prose">
      <MDXRemote
        source={body}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeSlug, [rehypePrism, { ignoreMissing: true }]],
          },
        }}
        components={mdxComponents}
      />
    </article>
  );
}
