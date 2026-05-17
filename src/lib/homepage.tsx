import fs from "node:fs/promises";
import path from "node:path";
import { unstable_noStore } from "next/cache";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
const CONFIG_HOMEPAGE_MDX_PATH = path.join(process.cwd(), "config", "index.mdx");
const BUILTIN_HOMEPAGE_MDX_PATH = path.join(process.cwd(), "src", "content", "default-homepage.mdx");

export interface HomePageFrontmatter {
  title?: string;
  description?: string;
}

async function resolveHomePageSource() {
  try {
    const source = await fs.readFile(CONFIG_HOMEPAGE_MDX_PATH, "utf8");
    return source;
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT";

    if (!isNotFound) {
      throw error;
    }

    return fs.readFile(BUILTIN_HOMEPAGE_MDX_PATH, "utf8");
  }
}

export async function loadHomePageMdx() {
  unstable_noStore();

  const source = await resolveHomePageSource();

  const { content, frontmatter } = await compileMDX<HomePageFrontmatter>({
    source,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkBreaks, remarkMath],
        rehypePlugins: [rehypeKatex],
      },
    },
  });

  return {
    content,
    frontmatter,
  };
}
