import { SiteLinkItem } from "./site-link-item";
import type { SiteBeian, SiteLink } from "@/lib/site-config";

interface SiteFooterProps {
  siteTitle: string;
  footerLinks: SiteLink[];
  beian: SiteBeian;
}

export function SiteFooter({ siteTitle, footerLinks, beian }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();
  const hasBeian = Boolean(beian.icp || beian.police);

  return (
    <footer className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col items-center gap-5 text-center">
          <p className="text-base text-[var(--text-muted)]">
            © {currentYear} {siteTitle}. All rights reserved.
          </p>

          {footerLinks.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
              {footerLinks.map((link) => (
                <SiteLinkItem
                  key={`${link.label}-${link.href}`}
                  link={link}
                  className="inline-flex items-center rounded-full px-4 py-2 text-base text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-600)] transition-colors"
                  iconClassName="h-5 w-5 shrink-0 object-contain"
                />
              ))}
            </div>
          )}

          {hasBeian && (
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-[var(--border-default)] pt-5 text-base text-[var(--text-muted)]">
              {beian.icp && (beian.icp.href ? (
                <SiteLinkItem
                  link={{ label: beian.icp.text, href: beian.icp.href }}
                  className="inline-flex items-center justify-center hover:text-[var(--accent-600)] transition-colors"
                />
              ) : (
                <span>{beian.icp.text}</span>
              ))}

              {beian.police && (beian.police.href ? (
                <SiteLinkItem
                  link={{ label: beian.police.text, href: beian.police.href }}
                  className="inline-flex items-center justify-center hover:text-[var(--accent-600)] transition-colors"
                />
              ) : (
                <span>{beian.police.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
