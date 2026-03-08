export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) {
    return content;
  }

  const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---/);

  if (!frontmatterMatch) {
    return content;
  }

  return content.slice(frontmatterMatch[0].length).replace(/^\r?\n/, "");
}

export function getFirstNonEmptyMarkdownLine(content: string): string | null {
  const lines = stripFrontmatter(content).split(/\r?\n/);

  for (const line of lines) {
    if (line.trim() !== "") {
      return line.trimStart();
    }
  }

  return null;
}

export function startsWithMarkdownHeading(content: string): boolean {
  const firstLine = getFirstNonEmptyMarkdownLine(content);

  return firstLine !== null && /^#{1,6}\s+\S/.test(firstLine);
}
