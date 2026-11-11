/**
 * 图片/音视频防盗链（Referer / Origin 校验）。
 *
 * 行为约定（与 README 中 ALLOWED_HOTLINK_ORIGINS 的说明一致）：
 * - 请求既没有 Origin 也没有 Referer → 放行。地址栏直接打开、curl、部分老客户端都属此类，
 *   一刀切会误伤正常访问。
 * - 带 Origin（跨站 fetch / 沙箱 iframe）→ 域名必须同源或在白名单，否则拦截。
 *   特别地 `Origin: null`（沙箱 iframe、data: 页面）视为不可信，拦截。
 * - 带 Referer（`<img>` 嵌入是主要场景，浏览器不发 Origin 只发 Referer）→ 同上。
 * - 只作用于图片/音视频这类缓存型资源；文本资源已有 CORP same-origin + 不下发 ACAO 挡跨站读取。
 */
import { isCrossOriginReadableAsset } from "@/lib/docs-asset";

/** 白名单条目统一归一化为 host(:port) 形态，写 https://host 或裸 host 都可以。 */
const ALLOWED_REFERRER_HOSTS = new Set(
  (process.env.ALLOWED_HOTLINK_ORIGINS ?? "")
    .split(",")
    .map((item) =>
      item
        .trim()
        .toLowerCase()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
        .split("/")[0],
    )
    .filter(Boolean),
);

export function isHotlinkBlocked(headers: Headers, ext: string) {
  if (!isCrossOriginReadableAsset(ext)) {
    return false;
  }

  const origin = headers.get("origin");
  if (origin !== null) {
    const normalized = origin.trim().toLowerCase();
    // 沙箱 iframe 会发 `Origin: null`，与"没有 Origin"要区分开：前者明确不可信
    if (normalized === "null") {
      return true;
    }

    return !isAllowedRefererHost(parseUrlHost(normalized), headers);
  }

  const referer = headers.get("referer");
  if (referer !== null) {
    const host = parseUrlHost(referer.trim().toLowerCase());
    // 格式非法的 Referer 一律按不可信处理
    if (host === null) {
      return true;
    }

    return !isAllowedRefererHost(host, headers);
  }

  // 两个头都没有：允许直接访问
  return false;
}

function parseUrlHost(value: string) {
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

function isAllowedRefererHost(host: string | null, requestHeaders: Headers) {
  if (!host) {
    return false;
  }

  if (ALLOWED_REFERRER_HOSTS.has(host)) {
    return true;
  }

  // 同源放行：与请求 Host（反代场景优先 X-Forwarded-Host）比对。
  // TRUSTED_PROXY_HOPS=0 表示前面没有可信代理，X-Forwarded-* 是客户端可伪造的，不采信。
  const trustForwarded = process.env.TRUSTED_PROXY_HOPS !== "0";
  const requestHost = trustForwarded
    ? firstHeaderHost(requestHeaders, "x-forwarded-host") ??
      firstHeaderHost(requestHeaders, "host")
    : firstHeaderHost(requestHeaders, "host");

  return requestHost !== null && host === requestHost;
}

function firstHeaderHost(headers: Headers, name: string) {
  const value = headers.get(name);
  if (!value) {
    return null;
  }

  // X-Forwarded-Host 可能带逗号串联的多个值，只取第一个（由最近的代理写入）
  return value.split(",")[0].trim().toLowerCase() || null;
}
