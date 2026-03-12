import { NextRequest, NextResponse } from "next/server";
import { listModules, getModuleContent } from "@/lib/docs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() || "";
  const locale = searchParams.get("locale") || "zh";

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const modules = await listModules();
    const results: Array<{
      title: string;
      path: string;
      module: string;
    }> = [];

    for (const moduleItem of modules) {
      const content = await getModuleContent(moduleItem.id, locale);
      if (!content) continue;

      for (const doc of content.docs) {
        const title = doc.frontmatter.title || doc.displayName;
        const docContent = doc.contentRaw.toLowerCase();

        if (
          title.toLowerCase().includes(query) ||
          docContent.includes(query)
        ) {
          results.push({
            title,
            path: doc.urlPath,
            module: moduleItem.title,
          });
        }
      }
    }

    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (error) {
    console.error("搜索错误:", error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
