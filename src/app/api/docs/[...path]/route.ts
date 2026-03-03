import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const docsRoot = path.join(process.cwd(), "docs");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filePath = path.join(docsRoot, ...pathSegments);
  
  // 安全检查：确保文件在 docs 目录内
  if (!filePath.startsWith(docsRoot)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  
  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // 根据文件扩展名设置 Content-Type
    const contentType = getContentType(ext);
    
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".md": "text/markdown",
    ".json": "application/json",
  };
  return types[ext] || "application/octet-stream";
}
