import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import {
  MEDIA_EXTENSIONS,
  isCrossOriginReadableAsset,
  resolveDocAsset,
} from "@/lib/docs-asset";
import { isHotlinkBlocked } from "@/lib/hotlink";

const VERSIONED_ASSET_CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";
const REVALIDATED_CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const asset = await resolveDocAsset(pathSegments);

  if (asset.status === "forbidden") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (asset.status === "not_found") {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 防盗链：图片/音视频被外站 `<img>` / 播放器嵌入时，Referer/Origin 必须同源或在
  // ALLOWED_HOTLINK_ORIGINS 白名单内。地址栏直接打开（无 Referer）不受影响。
  // 拦截响应禁用缓存，避免 CDN 把 403 缓存给正常用户。
  if (isHotlinkBlocked(request.headers, asset.ext)) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { filePath, ext, size, mtimeMs } = asset;
  const contentType = getContentType(ext);
  const headers = buildBaseHeaders(ext);
  const etag = createEtag(size, mtimeMs);

  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", getCacheControl(ext));
  headers.set("Last-Modified", new Date(mtimeMs).toUTCString());
  headers.set("ETag", etag);

  if (isConditionalRequestMatched(request, etag, mtimeMs)) {
    return new NextResponse(null, { status: 304, headers });
  }

  if (MEDIA_EXTENSIONS.has(ext)) {
    return serveMediaFile(request, filePath, size, headers);
  }

  let file: Buffer;
  try {
    file = await fs.readFile(filePath);
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file), { headers });
}

export async function OPTIONS(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const asset = await resolveDocAsset(pathSegments);

  if (asset.status !== "ok") {
    return new NextResponse(null, { status: asset.status === "forbidden" ? 403 : 404 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildBaseHeaders(asset.ext),
  });
}

type ByteRange = { start: number; end: number };

function parseRange(
  header: string | null,
  size: number,
): ByteRange | "invalid" | null {
  if (!header) {
    return null;
  }

  const match = header.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) {
    return "invalid";
  }

  const [, startText, endText] = match;

  // bytes=-N：取最后 N 字节
  if (startText === "") {
    const suffixLength = Number(endText);
    if (suffixLength === 0) {
      return "invalid";
    }
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(startText);
  if (start >= size) {
    return "invalid";
  }

  const end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);
  if (start > end) {
    return "invalid";
  }

  return { start, end };
}

function isIfRangeMatched(request: NextRequest, etag: string) {
  const ifRange = request.headers.get("if-range");
  if (!ifRange) {
    return true;
  }

  return ifRange.trim() === etag;
}

function serveMediaFile(
  request: NextRequest,
  filePath: string,
  size: number,
  headers: Headers,
) {
  headers.set("Accept-Ranges", "bytes");

  let range = parseRange(request.headers.get("range"), size);
  if (range && range !== "invalid" && !isIfRangeMatched(request, headers.get("ETag") ?? "")) {
    // If-Range 不匹配说明文件已变更，回退为完整响应
    range = null;
  }

  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new NextResponse(null, { status: 416, headers });
  }

  let start = 0;
  let end = size - 1;
  if (range) {
    start = range.start;
    end = range.end;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  if (start > end) {
    // 空文件
    return new NextResponse(null, { status: 200, headers });
  }

  headers.set("Content-Length", String(end - start + 1));
  const body = Readable.toWeb(
    createReadStream(filePath, { start, end }),
  ) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(body, { status: range ? 206 : 200, headers });
}

function buildBaseHeaders(ext: string) {
  const headers = new Headers();

  headers.set("Vary", "If-None-Match, If-Modified-Since, Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Cross-Origin-Resource-Policy",
    isCrossOriginReadableAsset(ext) ? "cross-origin" : "same-origin",
  );

  // 仅图片/音视频允许跨域读取；文本类资源不下发 ACAO，防止被任意站点 fetch 走文档正文
  if (isCrossOriginReadableAsset(ext)) {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Range, If-None-Match, If-Modified-Since");
    headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, ETag");
  }

  // 下载型资源强制 attachment，避免浏览器在同一源下把未知类型当页面渲染
  if (!MEDIA_EXTENSIONS.has(ext) && !isCrossOriginReadableAsset(ext)) {
    headers.set("Content-Disposition", "inline");
  }

  return headers;
}

function createEtag(size: number, mtimeMs: number) {
  return `W/\"${crypto
    .createHash("sha1")
    .update(`${size}:${Math.trunc(mtimeMs)}`)
    .digest("hex")}\"`;
}

function isConditionalRequestMatched(
  request: NextRequest,
  etag: string,
  mtimeMs: number,
) {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    const candidates = ifNoneMatch.split(",").map((item) => item.trim());
    if (candidates.includes(etag) || candidates.includes("*")) {
      return true;
    }
  }

  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) {
    return false;
  }

  const modifiedSince = Date.parse(ifModifiedSince);
  if (Number.isNaN(modifiedSince)) {
    return false;
  }

  return Math.trunc(mtimeMs) <= modifiedSince;
}

function getCacheControl(ext: string) {
  if (isCrossOriginReadableAsset(ext)) {
    return VERSIONED_ASSET_CACHE_CONTROL;
  }

  return REVALIDATED_CACHE_CONTROL;
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".md": "text/markdown; charset=utf-8",
    ".mdx": "text/markdown; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".sql": "text/plain; charset=utf-8",
    ".cs": "text/plain; charset=utf-8",
    ".sh": "text/plain; charset=utf-8",
    ".ps1": "text/plain; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".toml": "text/plain; charset=utf-8",
    ".conf": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".ogv": "video/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
  };
  return types[ext] || "application/octet-stream";
}
