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

interface MapJsonItem {
  file?: string;
  title: string;
  order: number;
  children?: MapJsonItem[];
}

interface BuildMapContext {
  moduleId: string;
  locale: string;
  currentDirPath: string;
  currentSlugSegments: string[];
  docs: DocItem[];
  sequence: { value: number };
}

function normalizeSlugForLookup(slug: string[]) {
  if (slug.length === 0) {
    return "";
  }

  const normalized = [...slug];
  const lastIndex = normalized.length - 1;
  normalized[lastIndex] = normalized[lastIndex].replace(/\.md$/i, "");
  return normalized.join("/");
}

export async function listModules(): Promise<ModuleMeta[]> {
  try {
    const raw = await fs.readFile(rootMapJsonPath, "utf8");
    const items = JSON.parse(raw);
    return items.map(
      (item: {
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
      })
    );
  } catch {
    return [];
  }
}

function normalizeMapJsonItem(item: unknown): MapJsonItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title : "";
  const file = typeof record.file === "string" ? record.file : undefined;
  const order = typeof record.order === "number" ? record.order : 999;
  const childrenInput = Array.isArray(record.children) ? record.children : undefined;
  const children = childrenInput
    ?.map((child) => normalizeMapJsonItem(child))
    .filter((child): child is MapJsonItem => child !== null);

  if (!title) {
    return null;
  }

  if (!file && !children?.length) {
    return null;
  }

  return {
    file,
    title,
    order,
    children: children?.length ? children : undefined,
  };
}

async function readMapJson(mapPath: string): Promise<MapJsonItem[] | null> {
  try {
    const content = await fs.readFile(mapPath, "utf8");
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      return null;
    }

    return data
      .map((item) => normalizeMapJsonItem(item))
      .filter((item): item is MapJsonItem => item !== null);
  } catch {
    return null;
  }
}

function createGroupName(item: MapJsonItem) {
  return item.file ?? `__group__${item.order}_${item.title}`;
}

async function buildSidebarNodesFromMap(
  items: MapJsonItem[],
  context: BuildMapContext
): Promise<SidebarNode[]> {
  const sidebarNodes: SidebarNode[] = [];
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  for (const item of sortedItems) {
    if (item.children?.length) {
      const children = await buildSidebarNodesFromMap(item.children, context);

      if (children.length > 0) {
        sidebarNodes.push({
          type: "group",
          name: createGroupName(item),
          displayName: item.title,
          order: item.order,
          children,
        });
      }

      continue;
    }

    if (!item.file) {
      continue;
    }

    const filePath = path.join(context.currentDirPath, item.file);

    try {
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        const subMapPath = path.join(filePath, "map.json");
        const subMapData = await readMapJson(subMapPath);

        if (!subMapData) {
          console.warn(`No map.json found for directory: ${filePath}`);
          continue;
        }

        const children = await buildSidebarNodesFromMap(subMapData, {
          ...context,
          currentDirPath: filePath,
          currentSlugSegments: [...context.currentSlugSegments, item.file],
        });

        if (children.length > 0) {
          sidebarNodes.push({
            type: "group",
            name: item.file,
            displayName: item.title,
            order: item.order,
            children,
          });
        }

        continue;
      }

      const content = await fs.readFile(filePath, "utf8");
      const parsed = matter(content);
      const slug = [...context.currentSlugSegments, item.file.replace(/\.md$/i, "")].join("/");
      const urlPath = `/${context.locale}/${context.moduleId}/${slug}`;

      context.sequence.value += 1;
      context.docs.push({
        moduleId: context.moduleId,
        locale: context.locale,
        displayName: item.title,
        urlPath,
        contentRaw: content,
        frontmatter: parsed.data,
        fileName: item.file,
        order: context.sequence.value,
        filePath,
      });

      sidebarNodes.push({
        type: "doc",
        name: item.file,
        displayName: item.title,
        urlPath,
        order: item.order,
      });
    } catch {
      console.warn(`File not found: ${filePath}`);
    }
  }

  return sidebarNodes;
}

export async function getModuleContent(moduleId: string, locale: string) {
  const modulePath = path.join(docsRoot, moduleId);
  const moduleMapPath = path.join(modulePath, "map.json");

  try {
    const moduleMeta = (await listModules()).find((m) => m.id === moduleId);
    const mapData = await readMapJson(moduleMapPath);

    if (!mapData) {
      console.error(`No map.json found for module: ${moduleId}`);
      return null;
    }

    const docs: DocItem[] = [];
    const sequence = { value: 0 };
    const sidebarTree = await buildSidebarNodesFromMap(mapData, {
      moduleId,
      locale,
      currentDirPath: modulePath,
      currentSlugSegments: [],
      docs,
      sequence,
    });

    docs.sort((a, b) => a.order - b.order);

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

  const normalizedSlug = normalizeSlugForLookup(slug);
  return content.docs.find((doc) => doc.urlPath === `/${locale}/${moduleId}/${normalizedSlug}`) ?? null;
}

// 获取 README.md 或第一个文档
export async function getReadmeDoc(moduleId: string, locale: string): Promise<DocItem | null> {
  const content = await getModuleContent(moduleId, locale);
  if (!content) return null;

  // 优先找 README.md
  let readme = content.docs.find((doc) => doc.fileName.toLowerCase() === "readme.md");

  // 如果没有 README.md，找第一个文件
  if (!readme && content.docs.length > 0) {
    readme = content.docs[0];
  }

  return readme ?? null;
}
