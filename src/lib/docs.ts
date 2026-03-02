import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const docsRoot = path.join(process.cwd(), "docs");
const mapJsonPath = path.join(docsRoot, "map.json");

export interface DocItem {
  moduleId: string;
  locale: string;
  displayName: string;
  urlPath: string;
  contentRaw: string;
  frontmatter: {
    title?: string;
    updatedAt?: string;
  };
}

export async function listModules() {
  try {
    const raw = await fs.readFile(mapJsonPath, "utf8");
    const items = JSON.parse(raw);
    return items.map((item: { directory: string; title: string }) => ({
      id: item.directory,
      title: item.title,
      hidden: false,
      order: 0,
    }));
  } catch {
    return [];
  }
}

export async function getModuleContent(moduleId: string, locale: string) {
  const modulePath = path.join(docsRoot, moduleId);
  
  try {
    const entries = await fs.readdir(modulePath, { withFileTypes: true });
    const docs: DocItem[] = [];
    const sidebarTree: Array<{
      type: string;
      name: string;
      displayName: string;
      urlPath?: string;
    }> = [];
    
    // 读取 map.json 获取文件顺序
    let fileOrder: string[] = [];
    try {
      const mapContent = await fs.readFile(path.join(modulePath, "map.json"), "utf8");
      const mapData = JSON.parse(mapContent);
      fileOrder = mapData.map((item: { file: string }) => item.file);
    } catch {
      // 如果没有 map.json，使用目录顺序
    }
    
    for (const entry of entries) {
      if (!entry.isDirectory() && entry.name.endsWith(".md")) {
        const filePath = path.join(modulePath, entry.name);
        const content = await fs.readFile(filePath, "utf8");
        const parsed = matter(content);
        
        const slug = entry.name.replace(/\.md$/, "");
        const urlPath = `/${locale}/${moduleId}/${slug}`;
        
        const doc: DocItem = {
          moduleId,
          locale,
          displayName: parsed.data.title ?? slug,
          urlPath,
          contentRaw: content,
          frontmatter: parsed.data,
        };
        
        docs.push(doc);
        sidebarTree.push({
          type: "doc",
          name: entry.name,
          displayName: parsed.data.title ?? slug,
          urlPath,
        });
      }
    }
    
    // 按 map.json 排序
    if (fileOrder.length > 0) {
      docs.sort((a, b) => {
        const aIndex = fileOrder.findIndex((f) => a.contentRaw.includes(f));
        const bIndex = fileOrder.findIndex((f) => b.contentRaw.includes(f));
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    }
    
    return {
      moduleMeta: { id: moduleId, title: moduleId },
      sidebarTree,
      docs,
    };
  } catch {
    return null;
  }
}

export async function getDocBySlug(locale: string, moduleId: string, slug: string[]) {
  const content = await getModuleContent(moduleId, locale);
  if (!content) return null;
  
  const normalizedSlug = slug.join("/");
  return content.docs.find((doc) => doc.urlPath === `/${locale}/${moduleId}/${normalizedSlug}`) ?? null;
}
