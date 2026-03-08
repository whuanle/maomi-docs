import Link from "next/link";
import type { ReactNode } from "react";
import type { SiteLink } from "@/lib/site-config";

function isExternalHref(href: string) {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

interface SiteLinkItemProps {
  link: SiteLink;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}

export function SiteLinkItem({
  link,
  className,
  children,
  onClick,
}: SiteLinkItemProps) {
  const content = children ?? link.label;
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
