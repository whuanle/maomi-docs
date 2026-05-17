import { HomepageMdxRenderer } from "@/components/homepage-mdx-renderer";
import { loadHomePageMdx } from "@/lib/homepage";

export default async function HomePage() {
  const { content } = await loadHomePageMdx();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <HomepageMdxRenderer content={content} />
    </div>
  );
}
