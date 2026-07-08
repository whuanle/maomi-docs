import { unstable_noStore } from "next/cache";
import { getModuleContent, listModules, type DocItem, type ModuleMeta } from "@/lib/docs";

/**
 * 汇集所有模块及其文档，供 llms.txt / llms-full.txt / sitemap 共用。
 * 按模块 order 排序，模块内文档按既有 order 排序。
 */
export interface ModuleCatalog {
  module: ModuleMeta;
  docs: DocItem[];
}

export async function buildDocCatalog(): Promise<ModuleCatalog[]> {
  unstable_noStore();

  const modules = await listModules();
  const catalog: ModuleCatalog[] = [];

  for (const moduleMeta of modules) {
    const content = await getModuleContent(moduleMeta.id, "zh");
    if (!content || content.docs.length === 0) {
      continue;
    }
    catalog.push({ module: moduleMeta, docs: content.docs });
  }

  return catalog;
}
