import Link from "next/link";
import type { ReactNode } from "react";
import type { SiteLink } from "@/lib/site-config";
import { SiteLinkIcon } from "./site-link-icon";

function isExternalHref(href: string) {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
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
        <SiteLinkIcon
          icon={link.icon}
          className={iconClassName ?? "h-4 w-4 shrink-0 object-contain"}
        />
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
