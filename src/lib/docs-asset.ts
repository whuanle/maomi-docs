import fs from "node:fs/promises";
import path from "node:path";

/**
 * 文档静态资源（/docs/** → /api/docs/**）的统一解析与校验。
 *
 * 这是站点唯一直接读磁盘的入口，所有越权风险都收敛在这里：
 * - 路径穿越：段级拒绝 `..` / `.` / 分隔符 / NUL，解析后再做 realpath 前缀校验
 * - 越界读取：`startsWith(root)` 必须带分隔符边界，否则 docs-evil 这类同级目录会被放行
 * - 任意文件读取：扩展名白名单，避免 docs/.stats/stats.duckdb 等内部文件被下载
 * - 符号链接逃逸：realpath 之后重新校验前缀
 */

export const DOCS_ROOT = path.join(process.cwd(), "docs");

export const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".bmp",
  ".avif",
]);

// 音视频走流式 + Range 响应，避免整文件读进内存
export const MEDIA_EXTENSIONS = new Set([
  ".mp4",
  ".m4v",
  ".webm",
  ".mov",
  ".ogv",
  ".mp3",
  ".wav",
  ".m4a",
]);

// 文档里可被下载的附属文件类型。注意：.duckdb/.wal/.db 等数据库文件、无扩展名文件一律不放行，
// docs/.stats 下的统计库因此无法通过 HTTP 读取。
const DOCUMENT_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".csv",
  ".pdf",
  ".cs",
  ".sh",
  ".ps1",
  ".sql",
  ".xml",
  ".toml",
  ".conf",
  ".log",
]);

export const CACHEABLE_ASSET_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...MEDIA_EXTENSIONS,
]);

const ALLOWED_EXTENSIONS = new Set([
  ...CACHEABLE_ASSET_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
]);

// 非流式资源整读进内存，加个上限防止被超大文件拖垮
const MAX_BUFFERED_FILE_BYTES = 32 * 1024 * 1024;

const MAX_SEGMENT_LENGTH = 255;

export type DocAssetResolution =
  | { status: "ok"; filePath: string; ext: string; size: number; mtimeMs: number }
  | { status: "forbidden" }
  | { status: "not_found" };

function isSafeSegment(segment: string) {
  if (!segment || segment === "." || segment === "..") {
    return false;
  }

  if (segment.length > MAX_SEGMENT_LENGTH) {
    return false;
  }

  // 拒绝路径分隔符（含编码后被解码出来的）、NUL 与控制字符
  if (/[/\\\u0000-\u001f]/.test(segment)) {
    return false;
  }

  // 隐藏文件/目录：.stats、.env、.files 之类一律不对外
  if (segment.startsWith(".")) {
    return false;
  }

  // 首尾空格/结尾的点会被 Windows 文件系统静默剥掉（"a.md " 实际打开 "a.md"），
  // 是伪造文件名的绕过向量。文件名中间的空格是合法的，放行。
  if (segment.trim() !== segment) {
    return false;
  }

  return true;
}

function isInsideDocsRoot(filePath: string) {
  const normalizedRoot = path.resolve(DOCS_ROOT);
  const normalizedTarget = path.resolve(filePath);

  if (normalizedTarget === normalizedRoot) {
    return false;
  }

  // 必须带分隔符边界，否则 /app/docs-evil 会被误判为在 /app/docs 内
  return normalizedTarget.startsWith(normalizedRoot + path.sep);
}

/**
 * 真实路径里任何一段都不允许是隐藏目录/文件。
 *
 * URL 段的校验挡不住符号链接：仓库里若被放入 docs/link -> .files 这样的链接，
 * /docs/link/xxx.pdf 的段全部合法，只有解析 realpath 之后才能看到真实段。
 * 在 realpath 结果上再查一遍，链接借道下载隐藏内容这条路就断了。
 */
function hasHiddenSegment(filePath: string) {
  const normalizedRoot = path.resolve(DOCS_ROOT);
  const relative = filePath.slice(normalizedRoot.length + path.sep.length);

  return relative
    .split(path.sep)
    .some((segment) => segment.startsWith("."));
}

export async function resolveDocAsset(segments: string[]): Promise<DocAssetResolution> {
  if (segments.length === 0 || !segments.every(isSafeSegment)) {
    return { status: "forbidden" };
  }

  const candidate = path.resolve(DOCS_ROOT, ...segments);
  if (!isInsideDocsRoot(candidate)) {
    return { status: "forbidden" };
  }

  const ext = path.extname(candidate).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { status: "forbidden" };
  }

  let realPath: string;
  try {
    // 软链接解析后再校验一次：仓库里若被放入指向 /etc 的链接也不会越界
    realPath = await fs.realpath(candidate);
  } catch {
    return { status: "not_found" };
  }

  if (
    !isInsideDocsRoot(realPath) ||
    !ALLOWED_EXTENSIONS.has(path.extname(realPath).toLowerCase()) ||
    hasHiddenSegment(realPath)
  ) {
    return { status: "forbidden" };
  }

  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(realPath);
  } catch {
    return { status: "not_found" };
  }

  if (!stats.isFile()) {
    return { status: "not_found" };
  }

  if (!MEDIA_EXTENSIONS.has(ext) && stats.size > MAX_BUFFERED_FILE_BYTES) {
    return { status: "forbidden" };
  }

  return { status: "ok", filePath: realPath, ext, size: stats.size, mtimeMs: stats.mtimeMs };
}

export function isCrossOriginReadableAsset(ext: string) {
  // 只有图片/音视频/字体允许被外站直接引用（文档配图、嵌入播放器）。
  // 文本类资源（md/json/yml…）不给 ACAO，避免被任意站点跨域读取文档内容。
  return CACHEABLE_ASSET_EXTENSIONS.has(ext);
}
