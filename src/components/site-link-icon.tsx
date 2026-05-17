"use client";

import {
  BookOpen,
  ExternalLink,
  Github,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const builtinIcons: Record<string, LucideIcon> = {
  github: Github,
  githubicon: Github,
  "book-open": BookOpen,
  bookopen: BookOpen,
  sparkles: Sparkles,
  externallink: ExternalLink,
  "external-link": ExternalLink,
};

function isImageIcon(icon: string) {
  return (
    /^(https?:)?\/\//.test(icon) ||
    icon.startsWith("/") ||
    icon.startsWith("./") ||
    icon.startsWith("../") ||
    icon.startsWith("data:image/")
  );
}

function normalizeLucideIconName(icon: string): string | null {
  const trimmed = icon.trim();

  if (!trimmed) {
    return null;
  }

  const compactLower = trimmed.replace(/[\s_-]+/g, "").toLowerCase();
  const kebabLower = trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

  const candidates = [trimmed, trimmed.toLowerCase(), compactLower, kebabLower];

  for (const candidate of candidates) {
    if (builtinIcons[candidate]) {
      return candidate;
    }
  }

  return null;
}

interface SiteLinkIconProps {
  icon: string;
  className?: string;
}

export function SiteLinkIcon({ icon, className }: SiteLinkIconProps) {
  if (isImageIcon(icon)) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block bg-center bg-no-repeat bg-contain ${className ?? ""}`}
        style={{ backgroundImage: `url(${icon})` }}
      />
    );
  }

  const iconName = normalizeLucideIconName(icon);
  const IconComponent = iconName ? builtinIcons[iconName] : null;

  if (!IconComponent) {
    return null;
  }

  return <IconComponent className={className} aria-hidden="true" />;
}
