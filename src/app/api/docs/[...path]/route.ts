import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const docsRoot = path.join(process.cwd(), "docs");
const CACHEABLE_ASSET_EXTENSIONS = new Set([
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
    const [file, stats] = await Promise.all([
      fs.readFile(filePath),
      fs.stat(filePath),
    ]);
    
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
  };
  return types[ext] || "application/octet-stream";
}
