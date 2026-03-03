import { DocContentClient } from "./doc-content-client";

interface DocContentProps {
  content: string;
  filePath?: string;
}

export function DocContent({ content, filePath }: DocContentProps) {
  return <DocContentClient content={content} filePath={filePath} />;
}
