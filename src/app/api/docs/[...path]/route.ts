import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import crypto from "node:crypto";

const docsRoot = path.join(process.cwd(), "docs");
const IMAGE_ASSET_EXTENSIONS = new Set([
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
const MEDIA_EXTENSIONS = new Set([
  ".mp4",
  ".m4v",
  ".webm",
  ".mov",
  ".ogv",
  ".mp3",
  ".wav",
  ".m4a",
]);
const CACHEABLE_ASSET_EXTENSIONS = new Set([
  ...IMAGE_ASSET_EXTENSIONS,
  ...MEDIA_EXTENSIONS,
]);
const VERSIONED_ASSET_CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";
const REVALIDATED_CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const safeSegments = pathSegments.map((segment) => path.normalize(segment));
  const filePath = path.resolve(docsRoot, ...safeSegments);
  
  // 安全检查：确保文件在 docs 目录内
  if (!filePath.startsWith(docsRoot)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  
  try {
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // 根据文件扩展名设置 Content-Type
    const contentType = getContentType(ext);
    const cacheControl = getCacheControl(ext);
    const lastModified = stats.mtime.toUTCString();
    const etag = createEtag(stats.size, stats.mtimeMs);
    const headers = buildBaseHeaders(ext);

    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", cacheControl);
    headers.set("Last-Modified", lastModified);
    headers.set("ETag", etag);

    if (isConditionalRequestMatched(_request, etag, stats.mtimeMs)) {
      return new NextResponse(null, {
        status: 304,
        headers,
      });
    }

    if (MEDIA_EXTENSIONS.has(ext)) {
      return serveMediaFile(_request, filePath, stats.size, headers);
    }

    const file = await fs.readFile(filePath);
    return new NextResponse(file, {
      headers,
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}

export async function OPTIONS(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const safeSegments = pathSegments.map((segment) => path.normalize(segment));
  const filePath = path.resolve(docsRoot, ...safeSegments);

  if (!filePath.startsWith(docsRoot)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const ext = path.extname(filePath).toLowerCase();
  return new NextResponse(null, {
    status: 204,
    headers: buildBaseHeaders(ext),
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

  headers.set("Vary", "If-None-Match, If-Modified-Since");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set(
    "Cross-Origin-Resource-Policy",
    CACHEABLE_ASSET_EXTENSIONS.has(ext) ? "cross-origin" : "same-origin",
  );

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
  if (CACHEABLE_ASSET_EXTENSIONS.has(ext)) {
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
    ".md": "text/markdown",
    ".json": "application/json",
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
