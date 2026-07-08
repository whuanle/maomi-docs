/**
 * 文档摘要提取。
 *
 * 用于 SEO meta description、llms.txt 索引、OpenGraph 描述等。
 * 保留可读性，仅做轻度清洗（去 frontmatter、代码块、markdown 符号），
 * 与 search.ts 的 normalizeSearchText 思路一致但更克制。
 */

const DEFAULT_SUMMARY_LIMIT = 120;

/**
 * 从 markdown 原文（含 frontmatter）提取一段纯文本摘要。
 *
 * 跳过标题行（# / ## / ### 等）、作者/日期声明行，取首个实质性段落。
 */
export function extractDocSummary(
  contentRaw: string,
  limit = DEFAULT_SUMMARY_LIMIT,
): string {
  if (!contentRaw) {
    return "";
  }

  const body = stripFrontmatter(contentRaw);
  // 在清洗前去标题行，便于准确识别 ATX 标题（# 前缀）
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // 跳过 ATX 标题行（# 标题、## 标题 ...）与 Setext 标题下划线
    .filter((line) => !/^#{1,6}\s/.test(line))
    .filter((line) => !/^(=+|-{2,})$/.test(line))
    // 跳过纯作者/日期等元信息声明（中文文档常见）
    .filter((line) => !/^(作者|来源|日期|更新时间|created|updated)\s*[:：]/i.test(line));

  const candidate = lines.find((line) => !isBlankOrNoise(line)) ?? "";
  const summary = cleanMarkdownLine(candidate).replace(/\s+/g, " ").trim();

  if (summary.length <= limit) {
    return summary;
  }

  const truncated = summary.slice(0, limit).trim();
  return truncated.endsWith("。") || truncated.endsWith(".") || truncated.endsWith("…")
    ? truncated
    : `${truncated}…`;
}

/**
 * 提取首段用于 llms.txt 的简短描述（约 80 字）。
 */
export function extractShortSummary(contentRaw: string): string {
  return extractDocSummary(contentRaw, 80);
}

/**
 * 去除 frontmatter（--- ... ---），返回 markdown 正文。
 */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\s*/, "");
}

/** 判断一行是否为空或纯噪声（HTML 标签、分隔线、图片等）。 */
function isBlankOrNoise(line: string): boolean {
  if (!line) return true;
  // 纯 HTML 标签（<img>、<center>、<br> 等）
  if (/^<[^>]+>\s*$/.test(line)) return true;
  // 纯分隔线
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) return true;
  return false;
}

function cleanMarkdownLine(line: string): string {
  return line
    // 去代码围栏行
    .replace(/^\s*```.*$/g, "")
    // 去图片
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // 链接保留文本
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // 去行首强调/引用符号
    .replace(/^\s{0,3}(>\s*)?/, "")
    // 去行内强调符号
    .replace(/[*_`~]/g, "");
}
