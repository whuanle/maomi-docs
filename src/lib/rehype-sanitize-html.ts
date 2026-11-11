/**
 * Markdown 原始 HTML 清洗（rehype 插件）。
 *
 * 站点用 rehype-raw 渲染文档里的 HTML，等价于把 docs/*.md 的内容当成可信 HTML 插入页面。
 * 一旦文档来源不再完全可信（外部投稿、PR、CMS 导入），这就是存储型 XSS：
 * `<img src=x onerror=fetch('/api/...')>`、`<script>`、`<iframe srcdoc>` 都能直接执行。
 *
 * 这里做的是"删执行面、留结构"的黑名单清洗，而不是全量白名单：
 * 文档里确实用到了 iframe（B 站播放器）、details、table 等标签，全量白名单会静默吞掉内容。
 * 因此只移除能执行脚本的标签与属性，其余结构保持不变。
 */

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

// 这些标签要么直接执行脚本，要么能改写文档基准/加载外部资源
const DANGEROUS_TAGS = new Set([
  "script",
  "noscript",
  "object",
  "embed",
  "applet",
  "base",
  "meta",
  "link",
  "frame",
  "frameset",
  "param",
  "noembed",
  "noframes",
]);

// 承载 URL 的属性，逐个校验协议
const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "poster",
  "cite",
  "background",
  "longdesc",
  "usemap",
  "ping",
  "manifest",
  "xlinkhref",
]);

// 即使协议合法也不该出现的属性
const DROPPED_ATTRIBUTES = new Set(["srcdoc", "formaction"]);

const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i;

function sanitizeUrlAttribute(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return "";
  }

  // 先压掉空白与控制字符，否则 "java\nscript:"、"java\tscript:" 能绕过前缀匹配
  const compact = raw.replace(/[\u0000-\u0020\u007f]+/g, "");

  if (/^(?:javascript|vbscript|livescript|mocha):/i.test(compact)) {
    return null;
  }

  if (/^data:/i.test(compact)) {
    // data:image/svg+xml 可内嵌脚本，只放行位图
    return SAFE_DATA_IMAGE.test(compact) ? raw : null;
  }

  if (/^file:/i.test(compact)) {
    return null;
  }

  return raw;
}

function sanitizeStyleAttribute(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.replace(/[\u0000-\u001f]/g, " ");

  // url() 可用于 CSS 数据外带，expression()/behavior 是老 IE 的脚本执行面
  if (/expression\s*\(|javascript:|vbscript:|-moz-binding|behavior\s*:|url\s*\(|@import/i.test(compact)) {
    return null;
  }

  return value;
}

function sanitizeElement(node: HastNode) {
  const tagName = node.tagName?.toLowerCase();
  const properties = node.properties;

  if (!properties) {
    if (tagName === "iframe") {
      node.properties = { loading: "lazy", referrerPolicy: "no-referrer" };
    }
    return;
  }

  for (const key of Object.keys(properties)) {
    const lowerKey = key.toLowerCase();

    // 所有内联事件处理器
    if (lowerKey.startsWith("on")) {
      delete properties[key];
      continue;
    }

    if (DROPPED_ATTRIBUTES.has(lowerKey)) {
      delete properties[key];
      continue;
    }

    if (URL_ATTRIBUTES.has(lowerKey)) {
      const sanitized = sanitizeUrlAttribute(properties[key]);
      if (sanitized === null) {
        delete properties[key];
      } else {
        properties[key] = sanitized;
      }
      continue;
    }

    if (lowerKey === "style") {
      const sanitized = sanitizeStyleAttribute(properties[key]);
      if (sanitized === null) {
        delete properties[key];
      } else {
        properties[key] = sanitized;
      }
    }
  }

  if (tagName === "iframe") {
    // 外链播放器统一不给父页 referrer，也避免被用来做 srcdoc 注入
    delete properties.srcdoc;
    properties.loading = properties.loading ?? "lazy";
    properties.referrerPolicy = properties.referrerPolicy ?? "no-referrer";
  }

  if (tagName === "a" && properties.target === "_blank") {
    properties.rel = "noopener noreferrer";
  }
}

function walk(node: HastNode) {
  if (!Array.isArray(node.children)) {
    return;
  }

  const kept: HastNode[] = [];

  for (const child of node.children) {
    const tagName = child.type === "element" ? child.tagName?.toLowerCase() : undefined;

    if (tagName && DANGEROUS_TAGS.has(tagName)) {
      continue;
    }

    if (child.type === "element") {
      sanitizeElement(child);
    }

    walk(child);
    kept.push(child);
  }

  node.children = kept;
}

export function rehypeSanitizeHtml() {
  return (tree: unknown) => {
    walk(tree as HastNode);
  };
}
