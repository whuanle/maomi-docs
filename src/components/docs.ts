import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const docsRoot = path.join(process.cwd(), "docs");
const mapJsonPath = path.join(docsRoot, "map.json");
const PREFIX_ORDER_RE = /^(\d+)\.(.+)$/;

const mapItemSchema = z.object({
    directory: z.string(),
    title: z.string(),
    language: z.string().optional(),
    order: z.number().optional(),
    icon: z.string().optional(),
    description: z.string().optional(),
    hidden: z.boolean().optional(),
});

const dirConfigSchema = z.object({
    order: z.array(z.string()).optional(),
    hidden: z.array(z.string()).optional(),
    titles: z.record(z.string(), z.string()).optional(),
    collapsed: z.array(z.string()).optional(),
    expanded: z.array(z.string()).optional(),
    links: z
        .array(
            z.object({
                label: z.string(),
                href: z.string(),
                order: z.number().optional(),
            }),
        )
        .optional(),
    separators: z
        .array(
            z.object({
                id: z.string(),
                label: z.string().optional(),
                order: z.number(),
            }),
        )
        .optional(),
    maxDepth: z.number().optional(),
});

const frontmatterSchema = z.object({
    title: z.string().optional(),
    sidebarTitle: z.string().optional(),
    description: z.string().optional(),
    order: z.number().optional(),
    slug: z.string().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional(),
    toc: z.boolean().optional(),
    updatedAt: z.string().optional(),
});

export interface ModuleMeta {
    id: string;
    order: number;
    hidden: boolean;
    title: string;
    description?: string;
    icon?: string;
    defaultDoc?: string;
}

export type SidebarNodeType = "doc" | "dir" | "link";

export interface SidebarNode {
    type: SidebarNodeType;
    name: string;
    displayName: string;
    sourceRelativePath: string;
    urlPath?: string;
    children?: SidebarNode[];
    isIndexDoc?: boolean;
    orderNumber?: number;
}

export interface DocFrontmatter {
    title?: string;
    sidebarTitle?: string;
    description?: string;
    order?: number;
    slug?: string;
    tags?: string[];
    draft?: boolean;
    toc?: boolean;
    updatedAt?: string;
}

export interface DocItem {
    moduleId: string;
    locale: string;

    sourceRelativePath: string;
    sourceAbsolutePath: string;
    urlPath: string;
    slugSegments: string[];
    fileName: string;
    displayName: string;
    contentRaw: string;
    frontmatter: DocFrontmatter;
}

export interface ModuleContent {
    moduleMeta: ModuleMeta;
    sidebarTree: SidebarNode[];
    docs: DocItem[];
}

type DirectoryListEntry = {
    itemName: string;
    itemAbsolutePath: string;
    itemRelativePath: string;
    isDirectory: boolean;
    sortNumber?: number;
    cleanName: string;
    frontmatter?: DocFrontmatter;
};

// 简化为单语言
const DEFAULT_LOCALE = "zh";

function stripExtension(fileName: string): string {
    return fileName.replace(/\.(md|mdx)$/i, "");
}

function parseOrderPrefix(name: string): { sortNumber?: number; cleanName: string } {
    const match = name.match(PREFIX_ORDER_RE);
    if (!match) {
        return { cleanName: name };
    }

    return {
        sortNumber: Number(match[1]),
        cleanName: match[2].trim(),
    };
}

function toKebabLikeSlug(input: string): string {
    const normalized = input
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[\\]/g, "-")
        .replace(/-{2,}/g, "-");

    return normalized;
}

function compareDirectoryEntries(a: DirectoryListEntry, b: DirectoryListEntry): number {
    const aOrder = a.sortNumber;
    const bOrder = b.sortNumber;

    if (typeof aOrder === "number" && typeof bOrder === "number") {
        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }
    } else if (typeof aOrder === "number") {
        return -1;
    } else if (typeof bOrder === "number") {
        return 1;
    }

    const aFrontOrder = a.frontmatter?.order;
    const bFrontOrder = b.frontmatter?.order;

    if (typeof aFrontOrder === "number" && typeof bFrontOrder === "number") {
        if (aFrontOrder !== bFrontOrder) {
            return aFrontOrder - bFrontOrder;
        }
    } else if (typeof aFrontOrder === "number") {
        return -1;
    } else if (typeof bFrontOrder === "number") {
        return 1;
    }

    if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
    }

    return a.cleanName.localeCompare(b.cleanName, "zh-Hans-CN", {
        sensitivity: "base",
        numeric: true,
    });
}

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function readJsonSafe<T>(filePath: string, schema: z.ZodSchema<T>): Promise<T | null> {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        return schema.parse(parsed);
    } catch {
        return null;
    }
}

async function readFrontmatter(filePath: string): Promise<DocFrontmatter> {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);
    return frontmatterSchema.parse(parsed.data ?? {});
}

async function resolveDirectoryConfig(dirAbsolutePath: string) {
    const configPath = path.join(dirAbsolutePath, "_dir.json");
    return readJsonSafe(configPath, dirConfigSchema);
}

async function readMapJson(): Promise<Array<z.infer<typeof mapItemSchema>>> {
    try {
        const raw = await fs.readFile(mapJsonPath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => mapItemSchema.parse(item));
        }
    } catch {
        // 如果 map.json 不存在或格式错误，返回空数组
    }
    return [];
}

export async function listModules(): Promise<ModuleMeta[]> {
    const mapItems = await readMapJson();

    if (mapItems.length === 0) {
        // 如果 map.json 不存在，扫描目录
        const entries = await fs.readdir(docsRoot, { withFileTypes: true });
        const moduleDirs = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'images');

        const modules: ModuleMeta[] = [];
        for (const moduleDir of moduleDirs) {
            modules.push({
                id: moduleDir.name,
                order: 9999,
                hidden: false,
                title: moduleDir.name,
            });
        }
        return modules;
    }

    // 使用 map.json 的配置
    const modules: ModuleMeta[] = [];
    for (const item of mapItems) {
        const modulePath = path.join(docsRoot, item.directory);
        if (!(await pathExists(modulePath))) {
            continue;
        }

        modules.push({
            id: item.directory,
            order: item.order ?? 9999,
            hidden: item.hidden ?? false,
            title: item.title,
            description: item.description,
            icon: item.icon,
        });
    }

    modules.sort((a, b) => {
        if (a.order !== b.order) {
            return a.order - b.order;
        }
        return a.id.localeCompare(b.id);
    });

    return modules;
}

async function getDirectoryEntries(
    moduleId: string,
    currentDirAbsolutePath: string,
    currentRelativePath: string,
): Promise<DirectoryListEntry[]> {
    const entries = await fs.readdir(currentDirAbsolutePath, { withFileTypes: true });
    const allowedFile = (name: string) => /\.(md|mdx)$/i.test(name);
    const filtered = entries.filter((entry) => {
        if (entry.name === "_dir.json") {
            return false;
        }

        if (entry.isDirectory()) {
            return true;
        }

        return allowedFile(entry.name);
    });

    const results: DirectoryListEntry[] = [];

    for (const entry of filtered) {
        const itemName = entry.name;
        const itemAbsolutePath = path.join(currentDirAbsolutePath, itemName);
        const itemRelativePath = path.posix.join(currentRelativePath, itemName).replace(/\\/g, "/");
        const baseName = entry.isDirectory() ? itemName : stripExtension(itemName);
        const { sortNumber, cleanName } = parseOrderPrefix(baseName);
        const entryResult: DirectoryListEntry = {
            itemName,
            itemAbsolutePath,
            itemRelativePath,
            isDirectory: entry.isDirectory(),
            sortNumber,
            cleanName,
        };

        if (!entry.isDirectory()) {
            const frontmatter = await readFrontmatter(itemAbsolutePath);
            entryResult.frontmatter = frontmatter;
        }

        results.push(entryResult);
    }

    const dirConfig = await resolveDirectoryConfig(currentDirAbsolutePath);

    if (!dirConfig?.order?.length) {
        results.sort(compareDirectoryEntries);
        return results;
    }

    const orderMap = new Map<string, number>();
    dirConfig.order.forEach((key, index) => orderMap.set(key, index));

    results.sort((a, b) => {
        const aExplicit = orderMap.get(a.itemName);
        const bExplicit = orderMap.get(b.itemName);

        if (typeof aExplicit === "number" && typeof bExplicit === "number") {
            return aExplicit - bExplicit;
        }
        if (typeof aExplicit === "number") {
            return -1;
        }
        if (typeof bExplicit === "number") {
            return 1;
        }

        return compareDirectoryEntries(a, b);
    });

    if (dirConfig.hidden?.length) {
        return results.filter((entry) => !dirConfig.hidden?.includes(entry.itemName));
    }

    return results;
}

type BuildTreeResult = {
    sidebarNodes: SidebarNode[];
    docs: DocItem[];
    urlCollisionSet: Set<string>;
};

async function buildTreeRecursively(params: {
    moduleId: string;
    currentDirAbsolutePath: string;
    currentRelativePath: string;
    currentUrlSegments: string[];
    urlCollisionSet: Set<string>;
}): Promise<BuildTreeResult> {
    const {
        moduleId,
        currentDirAbsolutePath,
        currentRelativePath,
        currentUrlSegments,
        urlCollisionSet,
    } = params;

    const dirConfig = await resolveDirectoryConfig(currentDirAbsolutePath);
    const entries = await getDirectoryEntries(
        moduleId,
        currentDirAbsolutePath,
        currentRelativePath,
    );

    const sidebarNodes: SidebarNode[] = [];
    const docs: DocItem[] = [];

    for (const entry of entries) {
        if (entry.isDirectory) {
            const dirDisplayName = dirConfig?.titles?.[entry.itemName] ?? entry.cleanName;
            const dirSlug = toKebabLikeSlug(entry.cleanName);
            const nextUrlSegments = [...currentUrlSegments, dirSlug];
            const nextRelativePath = path.posix.join(currentRelativePath, entry.itemName);

            const subTree = await buildTreeRecursively({
                moduleId,
                currentDirAbsolutePath: entry.itemAbsolutePath,
                currentRelativePath: nextRelativePath,
                currentUrlSegments: nextUrlSegments,
                urlCollisionSet,
            });

            const indexDoc = subTree.docs.find((item) => {
                const normalized = item.fileName.toLowerCase();
                return normalized === "index.md" || normalized === "index.mdx" || normalized === "readme.md";
            });

            sidebarNodes.push({
                type: "dir",
                name: entry.itemName,
                displayName: dirDisplayName,
                sourceRelativePath: nextRelativePath,
                children: subTree.sidebarNodes,
                urlPath: indexDoc?.urlPath,
                isIndexDoc: Boolean(indexDoc),
                orderNumber: entry.sortNumber,
            });

            docs.push(...subTree.docs);
            continue;
        }

        const frontmatter = entry.frontmatter ?? {};
        if (frontmatter.draft) {
            continue;
        }

        const baseName = stripExtension(entry.itemName);
        const displayName =
            dirConfig?.titles?.[entry.itemName] ??
            frontmatter.sidebarTitle ??
            frontmatter.title ??
            entry.cleanName;
        const rawSlug = frontmatter.slug?.trim() || parseOrderPrefix(baseName).cleanName;
        const docSlug = toKebabLikeSlug(rawSlug);
        const slugSegments = [...currentUrlSegments, docSlug];
        // 简化为单语言 URL：/moduleId/slug...
        const urlPath = `/${DEFAULT_LOCALE}/${moduleId}/${slugSegments.join("/")}`;

        if (urlCollisionSet.has(urlPath)) {
            throw new Error(
                `URL 冲突：${urlPath} 已存在。请调整文件名或 Frontmatter slug。冲突文件：${entry.itemRelativePath}`,
            );
        }
        urlCollisionSet.add(urlPath);

        const raw = await fs.readFile(entry.itemAbsolutePath, "utf8");

        const docItem: DocItem = {
            moduleId,
            locale: DEFAULT_LOCALE,
            sourceRelativePath: entry.itemRelativePath,
            sourceAbsolutePath: entry.itemAbsolutePath,
            urlPath,
            slugSegments,
            fileName: entry.itemName,
            displayName,
            contentRaw: raw,
            frontmatter,
        };

        docs.push(docItem);

        sidebarNodes.push({
            type: "doc",
            name: entry.itemName,
            displayName,
            sourceRelativePath: entry.itemRelativePath,
            urlPath,
            orderNumber: entry.sortNumber,
        });
    }

    if (dirConfig?.links?.length) {
        const links = [...dirConfig.links].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        for (const link of links) {
            sidebarNodes.push({
                type: "link",
                name: link.label,
                displayName: link.label,
                sourceRelativePath: currentRelativePath,
                urlPath: link.href,
            });
        }
    }

    return {
        sidebarNodes,
        docs,
        urlCollisionSet,
    };
}

export async function getModuleContent(moduleId: string, locale: string): Promise<ModuleContent | null> {
    // 忽略 locale 参数，直接使用模块目录
    const moduleRoot = path.join(docsRoot, moduleId);
    const exists = await pathExists(moduleRoot);

    if (!exists) {
        return null;
    }

    const modules = await listModules();
    const moduleMeta = modules.find((moduleItem) => moduleItem.id === moduleId);

    if (!moduleMeta || moduleMeta.hidden) {
        return null;
    }

    const built = await buildTreeRecursively({
        moduleId,
        currentDirAbsolutePath: moduleRoot,
        currentRelativePath: moduleId,
        currentUrlSegments: [],
        urlCollisionSet: new Set<string>(),
    });

    return {
        moduleMeta,
        sidebarTree: built.sidebarNodes,
        docs: built.docs,
    };
}

export async function getAllRouteParams(): Promise<Array<{ locale: string; moduleId: string; slug: string[] }>> {
    const modules = await listModules();
    const params: Array<{ locale: string; moduleId: string; slug: string[] }> = [];

    for (const moduleItem of modules) {
        if (moduleItem.hidden) {
            continue;
        }
        const content = await getModuleContent(moduleItem.id, DEFAULT_LOCALE);
        if (!content) {
            continue;
        }
        for (const doc of content.docs) {
            params.push({
                locale: DEFAULT_LOCALE,
                moduleId: moduleItem.id,
                slug: doc.slugSegments,
            });
        }
    }

    return params;
}

export async function getDocBySlug(locale: string, moduleId: string, slug: string[]): Promise<DocItem | null> {
    const content = await getModuleContent(moduleId, locale);
    if (!content) {
        return null;
    }

    const normalizedSlug = slug.join("/");
    const doc = content.docs.find((item) => item.slugSegments.join("/") === normalizedSlug);
    return doc ?? null;
}

export async function getNeighborDocs(locale: string, moduleId: string, slug: string[]) {
    const content = await getModuleContent(moduleId, locale);
    if (!content) {
        return { prev: null as DocItem | null, next: null as DocItem | null };
    }

    const docIndex = content.docs.findIndex((item) => item.slugSegments.join("/") === slug.join("/"));
    if (docIndex < 0) {
        return { prev: null as DocItem | null, next: null as DocItem | null };
    }

    return {
        prev: content.docs[docIndex - 1] ?? null,
        next: content.docs[docIndex + 1] ?? null,
    };
}

export async function getHomeHero(locale: string) {
    return {
        title: "文档中心",
        description: "探索技术文档和教程",
    };
}

export async function searchDocs(query: string, locale?: string, moduleId?: string): Promise<DocItem[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return [];
    }

    const modules = await listModules();
    const moduleList = moduleId
        ? modules.filter((moduleItem) => moduleItem.id === moduleId)
        : modules.filter((moduleItem) => !moduleItem.hidden);

    const collected: DocItem[] = [];

    for (const moduleItem of moduleList) {
        const content = await getModuleContent(moduleItem.id, DEFAULT_LOCALE);
        if (!content) {
            continue;
        }

        for (const doc of content.docs) {
            const matterResult = matter(doc.contentRaw);
            const plainContent = matterResult.content.toLowerCase();
            const title = (doc.frontmatter.title ?? doc.displayName).toLowerCase();
            if (title.includes(normalized) || plainContent.includes(normalized)) {
                collected.push(doc);
            }
        }
    }

    return collected.slice(0, 50);
}

export function flattenSidebar(nodes: SidebarNode[]): SidebarNode[] {
    const results: SidebarNode[] = [];
    const walk = (items: SidebarNode[]) => {
        for (const item of items) {
            results.push(item);
            if (item.children?.length) {
                walk(item.children);
            }
        }
    };
    walk(nodes);
    return results;
}