export async function getSiteConfig() {
  return {
    title: "技术文档",
    footerLinks: [],
  };
}

export async function isSupportedLocale(locale: string) {
  return locale === "zh";
}

export async function getLocaleTitle(locale: string) {
  return "技术文档";
}
