"use client";

import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";

const lucideIconNameSet = new Set<string>(iconNames);

function isImageIcon(icon: string) {
  return (
    /^(https?:)?\/\//.test(icon) ||
    icon.startsWith("/") ||
    icon.startsWith("./") ||
    icon.startsWith("../") ||
    icon.startsWith("data:image/")
  );
}

function normalizeLucideIconName(icon: string): IconName | null {
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
    if (lucideIconNameSet.has(candidate)) {
      return candidate as IconName;
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

  if (!iconName) {
    return null;
  }

  return <DynamicIcon name={iconName} className={className} aria-hidden="true" />;
}
