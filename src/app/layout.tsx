import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { getSiteConfig } from "@/lib/site-config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getSiteConfig();

  return {
    title: siteConfig.title,
    description: siteConfig.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = await getSiteConfig();

  return (
    <html lang="zh" suppressHydrationWarning>
      <head
        dangerouslySetInnerHTML={
          siteConfig.customHeadHtml
            ? { __html: siteConfig.customHeadHtml }
            : undefined
        }
      />
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
