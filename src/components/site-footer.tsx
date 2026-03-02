import Link from "next/link";

interface SiteFooterProps {
  siteTitle: string;
  links: Array<{ label: string; href: string }>;
}

export function SiteFooter({ siteTitle, links }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-tertiary)]">
            © {currentYear} {siteTitle}. All rights reserved.
          </p>

          <div className="flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--accent-600)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
