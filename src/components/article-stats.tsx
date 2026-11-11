"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, ThumbsUp } from "lucide-react";

interface ArticleStatsProps {
  docPath: string;
  initialViews: number;
  initialLikes: number;
  /**
   * 展示样式：
   * - "inline"：标题下方一行小字（阅读 · 点赞）
   * - "card"：侧边栏卡片块，纵向并列，放大显示
   */
  variant?: "inline" | "card";
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLikeStorageKey(docPath: string) {
  return `mmd_like:${docPath}:${getTodayKey()}`;
}

function hasLikedToday(docPath: string) {
  try {
    return localStorage.getItem(getLikeStorageKey(docPath)) === "1";
  } catch {
    return false;
  }
}

function markLikedToday(docPath: string) {
  try {
    localStorage.setItem(getLikeStorageKey(docPath), "1");
  } catch {
    // localStorage 不可用时忽略
  }
}

const VISITOR_ID_KEY = "mmd_visitor_id";

/**
 * 稳定的匿名访客标识，仅用于统计去重（服务端只存它的哈希）。
 * 不承载任何身份信息，清空 localStorage 即换新身份。
 */
function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 32);

    localStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}

export function ArticleStats({
  docPath,
  initialViews,
  initialLikes,
  variant = "inline",
}: ArticleStatsProps) {
  const [views, setViews] = useState(initialViews);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 首屏后：上报一次阅读（总阅读量，每次访问 +1）并读取本地点赞状态。
  // 统计由客户端唯一上报，服务端只读取，避免一次访问被计两次。
  useEffect(() => {
    let cancelled = false;
    const visitorId = getVisitorId();

    fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", path: docPath, visitorId }),
      keepalive: true,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.view === "number") setViews(data.view);
        if (typeof data.like === "number") setLikes(data.like);
      })
      .catch(() => {});

    setLiked(hasLikedToday(docPath));

    return () => {
      cancelled = true;
    };
  }, [docPath]);

  const handleLike = useCallback(async () => {
    if (liked || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "like", path: docPath, visitorId: getVisitorId() }),
      });
      if (!res.ok) {
        // 限流/服务异常时不标记已赞，否则用户当天再也点不了
        return;
      }

      const data = await res.json();
      markLikedToday(docPath);
      setLiked(true);
      setLikes((prev) => prev + 1);
      if (data && typeof data.like === "number") {
        setLikes(data.like);
      }
    } catch {
      // 网络失败不阻塞 UI，但本次不计入
    } finally {
      setSubmitting(false);
    }
  }, [docPath, liked, submitting]);

  if (variant === "card") {
    return (
      <div className="flex items-center gap-5 px-3">
        {/* 阅读量 */}
        <span className="flex items-center gap-1.5 select-none">
          <Eye className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="text-base font-semibold text-[var(--text-primary)]">{views}</span>
          <span className="text-sm text-[var(--text-muted)]">阅读</span>
        </span>

        {/* 点赞按钮 */}
        <button
          type="button"
          onClick={handleLike}
          disabled={liked || submitting}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 transition-colors select-none ${
            liked ? "text-[var(--accent-600)] cursor-default" : "text-[var(--text-muted)] hover:text-[var(--accent-600)] cursor-pointer"
          }`}
          title={liked ? "今天已点赞" : "点赞"}
        >
          <ThumbsUp
            className={`w-4 h-4 ${liked ? "fill-current" : ""}`}
            aria-hidden="true"
          />
          <span className="text-base font-semibold text-[var(--text-primary)]">{likes}</span>
          <span className={`text-sm ${liked ? "text-[var(--accent-600)]" : "text-[var(--text-muted)]"}`}>
            {liked ? "已赞" : "点赞"}
          </span>
        </button>
      </div>
    );
  }

  // inline：标题下方一行
  return (
    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
      <span className="flex items-center gap-1.5 select-none">
        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
        <span>阅读 {views}</span>
      </span>
      <button
        type="button"
        onClick={handleLike}
        disabled={liked || submitting}
        aria-pressed={liked}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border transition-colors select-none ${
          liked
            ? "border-[var(--accent-600)] text-[var(--accent-600)] bg-[var(--accent-50)] cursor-default"
            : "border-[var(--border-default)] hover:border-[var(--accent-600)] hover:text-[var(--accent-600)] cursor-pointer"
        }`}
        title={liked ? "今天已点赞" : "点赞"}
      >
        <ThumbsUp className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} aria-hidden="true" />
        <span>点赞 {likes}</span>
      </button>
    </div>
  );
}
