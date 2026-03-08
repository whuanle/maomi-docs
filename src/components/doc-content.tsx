import { DocContentClient } from "./doc-content-client";

interface DocContentProps {
  content: string;
  filePath?: string;
  currentPath?: string;
}

export function DocContent({ content, filePath, currentPath }: DocContentProps) {
  return <DocContentClient content={content} filePath={filePath} currentPath={currentPath} />;
}
