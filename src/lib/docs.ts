import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const docsRoot = path.join(process.cwd(), "docs");
const rootMapJsonPath = path.join(docsRoot, "map.json");

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
  fileName: string;
  order: number;
  filePath: string;
}

export interface SidebarNode {
  type: "doc" | "group";
  name: string;
  displayName: string;
  urlPath?: string;
  order?: number;
  children?: SidebarNode[];
}

export interface ModuleMeta {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
}

export async function listModules(): Promise<ModuleMeta[]> {
  try {
    const raw = await fs.readFile(rootMapJsonPath, "utf8");
    const items = JSON.parse(raw);
    return items.map((item: { 
      directory: string; 
      title: string; 
      order?: number;
      description?: string;
      icon?: string;
    }) => ({
      id: item.directory,
      title: item.title,
      description: item.description,
      icon: item.icon,
      order: item.order ?? 0,
    }));
  } catch {
    return [];
  }
}

// 读取 map.json
async function readMapJson(mapPath: string): Promise<Array<{ file: string; title: string; order: number }> | null> {
  try {
    const content = await fs.readFile(mapPath, "utf8");
    const data = JSON.parse(content);
    return data.map((item: { file: string; title: string; order?: number }) => ({
      file: item.file,
      title: item.title,
      order: item.order ?? 999,
    }));
  } catch {
    return null;
  }
}

// 严格按 map.json 读取模块内容 - 只读取 map.json 中列出的文件
export async function getModuleContent(moduleId: string, locale: string) {
  const modulePath = path.join(docsRoot, moduleId);
  const moduleMapPath = path.join(modulePath, "map.json");
  
  try {
    const moduleMeta = (await listModules()).find(m => m.id === moduleId);
    const mapData = await readMapJson(moduleMapPath);
    
    if (!mapData) {
      console.error(`No map.json found for module: ${moduleId}`);
      return null;
    }
    
    const docs: DocItem[] = [];
    const sidebarTree: SidebarNode[] = [];
    
    for (const mapItem of mapData) {
      const filePath = path.join(modulePath, mapItem.file);
      
      try {
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          // 是目录，读取子目录的 map.json
          const subMapPath = path.join(filePath, "map.json");
          const subMapData = await readMapJson(subMapPath);
          
          if (subMapData) {
            const children: SidebarNode[] = [];
            
            for (const subItem of subMapData) {
              const subFilePath = path.join(filePath, subItem.file);
              try {
                const content = await fs.readFile(subFilePath, "utf8");
                const parsed = matter(content);
                const slug = `${mapItem.file}/${subItem.file.replace(/\.md$/, "")}`;
                const urlPath = `/${locale}/${moduleId}/${slug}`;
                
                const doc: DocItem = {
                  moduleId,
                  locale,
                  displayName: subItem.title,
                  urlPath,
                  contentRaw: content,
                  frontmatter: parsed.data,
                  fileName: subItem.file,
                  order: mapItem.order * 100 + subItem.order,
                  filePath: subFilePath,
                };
                
                docs.push(doc);
                children.push({
                  type: "doc",
                  name: subItem.file,
                  displayName: subItem.title,
                  urlPath,
                  order: subItem.order,
                });
              } catch {
                // 文件不存在，跳过
              }
            }
            
            if (children.length > 0) {
              sidebarTree.push({
                type: "group",
                name: mapItem.file,
                displayName: mapItem.title,
                order: mapItem.order,
                children: children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
              });
            }
          }
        } else {
          // 是普通文件
          const content = await fs.readFile(filePath, "utf8");
          const parsed = matter(content);
          const slug = mapItem.file.replace(/\.md$/, "");
          const urlPath = `/${locale}/${moduleId}/${slug}`;
          
          const doc: DocItem = {
            moduleId,
            locale,
            displayName: mapItem.title,
            urlPath,
            contentRaw: content,
            frontmatter: parsed.data,
            fileName: mapItem.file,
            order: mapItem.order,
            filePath,
          };
          
          docs.push(doc);
          sidebarTree.push({
            type: "doc",
            name: mapItem.file,
            displayName: mapItem.title,
            urlPath,
            order: mapItem.order,
          });
        }
      } catch {
        // 文件或目录不存在，跳过
        console.warn(`File not found: ${filePath}`);
      }
    }
    
    // 排序
    docs.sort((a, b) => a.order - b.order);
    sidebarTree.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    return {
      moduleMeta: moduleMeta ?? { id: moduleId, title: moduleId, order: 0 },
      sidebarTree,
      docs,
    };
  } catch (error) {
    console.error("Error loading module:", error);
    return null;
  }
}

export async function getDocBySlug(locale: string, moduleId: string, slug: string[]) {
  const content = await getModuleContent(moduleId, locale);
  if (!content) return null;
  
  const normalizedSlug = slug.join("/");
  return content.docs.find((doc) => doc.urlPath === `/${locale}/${moduleId}/${normalizedSlug}`) ?? null;
}

// 获取 README.md 或第一个文档
export async function getReadmeDoc(moduleId: string, locale: string): Promise<DocItem | null> {
  const content = await getModuleContent(moduleId, locale);
  if (!content) return null;
  
  // 优先找 README.md
  let readme = content.docs.find(doc => 
    doc.fileName.toLowerCase() === "readme.md"
  );
  
  // 如果没有 README.md，找第一个文件
  if (!readme && content.docs.length > 0) {
    readme = content.docs[0];
  }
  
  return readme ?? null;
}
