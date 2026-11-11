import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * 图片白名单：文档正文里的外链图片会被 CSP 拦下，新增图床时在这里追加域名，
 * 或用 IMG_SRC_ALLOWLIST 环境变量（逗号分隔，构建期生效）扩展。
 */
const DEFAULT_IMG_SOURCES = ["https://images.cnblogs.com", "http://1.12.70.39:36006"];

function getExtraImgSources() {
  return (process.env.IMG_SRC_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Content-Security-Policy。
 *
 * 说明：
 * - script-src 必须带 'unsafe-inline'：Next 的 hydration 引导脚本和 config/custom-head.html
 *   里的 GA/Clarity 统计代码都是内联的。真正的 XSS 防线在 lib/rehype-sanitize-html.ts，
 *   CSP 在这里负责第二层——限制脚本外连和数据外带（connect-src / img-src 都是白名单）。
 * - frame-src 保留 https:，文档里嵌了 B 站播放器。
 * - 不加 upgrade-insecure-requests：会打断文档里少数 http 外链图片。
 */
function buildContentSecurityPolicy() {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://www.googletagmanager.com",
    "https://www.clarity.ms",
  ];

  const connectSrc = [
    "'self'",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://*.clarity.ms",
    ...(isDev ? ["ws:", "wss:"] : []),
  ];

  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    ...DEFAULT_IMG_SOURCES,
    ...getExtraImgSources(),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function buildSecurityHeaders() {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
    // 已被 frame-ancestors 覆盖，保留给不认 CSP 的老浏览器
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    // HSTS 只在生产下发：本地 http 调试不受影响；不带 includeSubDomains，避免误伤未上 https 的子域
    ...(isDev
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
  ];
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // DuckDB 是带原生绑定的模块，不能交给 webpack 打包：
  // 其绑定加载代码会动态 require 各平台的可选包，打包阶段会解析失败。
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // standalone 输出需要带上原生绑定（docker 构建另有显式 COPY 兜底）
  outputFileTracingIncludes: {
    "/api/stats": ["./node_modules/@duckdb/**/*"],
    "/[locale]/[moduleId]": ["./node_modules/@duckdb/**/*"],
    "/[locale]/[moduleId]/[...slug]": ["./node_modules/@duckdb/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
      {
        // 文件名带内容指纹，可以安全地长缓存
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, s-maxage=31536000, immutable",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/docs/:path*",
        destination: "/api/docs/:path*",
      },
    ];
  },
};

export default nextConfig;
