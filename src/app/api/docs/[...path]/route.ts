import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const docsRoot = path.join(process.cwd(), "docs");
const ALLOWED_HOTLINK_ORIGINS = parseAllowedHotlinkOrigins(
  process.env.ALLOWED_HOTLINK_ORIGINS,
);
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
  request: NextRequest,
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
    const hotlinkCheckResult = validateHotlink(request, ext);

    if (hotlinkCheckResult === "forbidden") {
      return new NextResponse("Forbidden", {
        status: 403,
        headers: buildBaseHeaders(ext),
      });
    }

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

    if (isConditionalRequestMatched(request, etag, stats.mtimeMs)) {
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

function parseAllowedHotlinkOrigins(value?: string) {
  if (!value) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getFirstHeaderValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const [first] = value.split(",");
  const normalized = first?.trim().toLowerCase();
  return normalized || null;
}

function normalizeOrigin(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeHostFromUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeHostnameFromUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeHostHeader(value?: string | null) {
  const normalized = getFirstHeaderValue(value);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(`http://${normalized}`).host.toLowerCase();
  } catch {
    return normalized;
  }
}

function normalizeHostnameHeader(value?: string | null) {
  const normalized = getFirstHeaderValue(value);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(`http://${normalized}`).hostname.toLowerCase();
  } catch {
    return normalized.replace(/:\d+$/, "");
  }
}

function collectAllowedHotlinkSources(request: NextRequest) {
  const origins = new Set<string>();
  const hosts = new Set<string>();
  const hostnames = new Set<string>();

  const addOrigin = (value?: string | null) => {
    const origin = normalizeOrigin(value);
    if (!origin) {
      return;
    }

    origins.add(origin);
    const host = normalizeHostFromUrl(origin);
    if (host) {
      hosts.add(host);
    }

    const hostname = normalizeHostnameFromUrl(origin);
    if (hostname) {
      hostnames.add(hostname);
    }
  };

  addOrigin(request.nextUrl.origin);

  for (const origin of ALLOWED_HOTLINK_ORIGINS) {
    addOrigin(origin);
  }

  const siteHost =
    normalizeHostHeader(request.headers.get("x-forwarded-host")) ??
    normalizeHostHeader(request.headers.get("host")) ??
    request.nextUrl.host.toLowerCase();
  const siteHostname =
    normalizeHostnameHeader(request.headers.get("x-forwarded-host")) ??
    normalizeHostnameHeader(request.headers.get("host")) ??
    request.nextUrl.hostname.toLowerCase();

  if (siteHost) {
    hosts.add(siteHost);
    // 兼容反向代理未透传协议时的 http/https 错位，避免同站请求被误判为盗链。
    origins.add(`http://${siteHost}`);
    origins.add(`https://${siteHost}`);
  }

  if (siteHostname) {
    hostnames.add(siteHostname);
    origins.add(`http://${siteHostname}`);
    origins.add(`https://${siteHostname}`);
  }

  return { origins, hosts, hostnames };
}

function isAllowedHotlinkSource(
  value: string,
  allowedSources: ReturnType<typeof collectAllowedHotlinkSources>,
) {
  const origin = normalizeOrigin(value);
  if (!origin) {
    return false;
  }

  if (allowedSources.origins.has(origin)) {
    return true;
  }

  const host = normalizeHostFromUrl(value);
  if (host && allowedSources.hosts.has(host)) {
    return true;
  }

  const hostname = normalizeHostnameFromUrl(value);
  return hostname ? allowedSources.hostnames.has(hostname) : false;
}

function validateHotlink(request: NextRequest, ext: string) {
  if (!CACHEABLE_ASSET_EXTENSIONS.has(ext)) {
    return "allowed";
  }

  const allowedSources = collectAllowedHotlinkSources(request);
  const requestOrigin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (requestOrigin) {
    if (!isAllowedHotlinkSource(requestOrigin, allowedSources)) {
      return "forbidden";
    }
  }

  if (referer) {
    if (!isAllowedHotlinkSource(referer, allowedSources)) {
      return "forbidden";
    }
  }

  if (!requestOrigin && !referer && secFetchSite === "cross-site") {
    return "forbidden";
  }

  return "allowed";
}

function buildBaseHeaders(ext: string) {
  const headers = new Headers();

  headers.set("Vary", "Origin, Referer, Sec-Fetch-Site, If-None-Match, If-Modified-Since");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Cross-Origin-Resource-Policy",
    CACHEABLE_ASSET_EXTENSIONS.has(ext) ? "same-site" : "same-origin",
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
