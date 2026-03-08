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
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            © {currentYear} {siteTitle}. All rights reserved.
          </p>

          {footerLinks.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {footerLinks.map((link) => (
                <SiteLinkItem
                  key={`${link.label}-${link.href}`}
                  link={link}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-600)] transition-colors"
                />
              ))}
            </div>
          )}
        </div>

        {hasBeian && (
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 border-t border-[var(--border-default)] pt-4 text-sm text-[var(--text-muted)]">
            {beian.icp && (beian.icp.href ? (
              <SiteLinkItem
                link={{ label: beian.icp.text, href: beian.icp.href }}
                className="hover:text-[var(--accent-600)] transition-colors"
              />
            ) : (
              <span>{beian.icp.text}</span>
            ))}

            {beian.police && (beian.police.href ? (
              <SiteLinkItem
                link={{ label: beian.police.text, href: beian.police.href }}
                className="hover:text-[var(--accent-600)] transition-colors"
              />
            ) : (
              <span>{beian.police.text}</span>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
