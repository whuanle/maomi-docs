"use client";

import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import type { ImgHTMLAttributes } from "react";

interface ZoomableImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  basePath: string;
}

export function ZoomableImage({ src, alt, basePath, ...rest }: ZoomableImageProps) {
  let processedSrc = typeof src === "string" ? src : "";
  
  if (processedSrc && !processedSrc.startsWith("http") && !processedSrc.startsWith("/")) {
    processedSrc = processedSrc.replace(/^\.\//, "");
    const moduleId = basePath.split("/").pop() || "";
    processedSrc = `/docs/${moduleId}/${processedSrc}`;
  }
  
  return (
    <Zoom>
      <img
        src={processedSrc}
        alt={alt || "文档图片"}
        className="max-w-full rounded-lg border border-[var(--border-default)] shadow-sm my-6 cursor-zoom-in"
        {...rest}
      />
    </Zoom>
  );
}
