import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, ExternalLink, Github, Sparkles, type LucideIcon } from "lucide-react";
import type { SiteLink } from "@/lib/site-config";

function isExternalHref(href: string) {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

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

function renderSiteLinkIcon(icon: string, className?: string) {
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

interface SiteLinkItemProps {
  link: SiteLink;
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
  onClick?: () => void;
}

export function SiteLinkItem({
  link,
  className,
  iconClassName,
  children,
  onClick,
}: SiteLinkItemProps) {
  const content = children ?? (
    <span className="inline-flex items-center gap-1.5">
      {link.icon && (
        renderSiteLinkIcon(link.icon, iconClassName ?? "h-4 w-4 shrink-0 object-contain")
      )}
      <span>{link.label}</span>
    </span>
  );
  const openInNewTab = link.newTab ?? isExternalHref(link.href);

  if (isExternalHref(link.href)) {
    return (
      <a
        href={link.href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        className={className}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className} onClick={onClick}>
      {content}
    </Link>
  );
}
