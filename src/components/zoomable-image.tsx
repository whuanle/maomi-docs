"use client";
/* eslint-disable @next/next/no-img-element */

import type { CSSProperties, ImgHTMLAttributes } from "react";
import { useState } from "react";
import { X } from "lucide-react";

interface ZoomableImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string;
  basePath?: string;
}

export function ZoomableImage({
  src,
  alt,
  basePath,
  className,
  style,
  ...imgProps
}: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  if (!src) return null;

  // 处理相对路径
  let imageSrc = src;
  if (!src.startsWith("http") && !src.startsWith("/") && basePath) {
    const parts = basePath.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const moduleId = parts[1];
      const remainingPath = parts.slice(2).join("/");
      if (remainingPath) {
        imageSrc = `/docs/${moduleId}/${remainingPath}/${src}`;
      } else {
        imageSrc = `/docs/${moduleId}/${src}`;
      }
    }
  }

  return (
    <>
      <img
        src={imageSrc}
        alt={alt || "图片"}
        className={className ?? "max-w-full rounded-md my-6 cursor-zoom-in border border-[var(--border-default)]"}
        style={style as CSSProperties | undefined}
        {...imgProps}
        onClick={() => setIsZoomed(true)}
      />

      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(false);
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={imageSrc}
            alt={alt || "图片"}
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
