import { Children, Fragment, isValidElement, type ReactNode } from "react";
import styles from "./homepage-mdx-renderer.module.css";

function flattenChildren(children: ReactNode): ReactNode[] {
  const result: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      result.push(...flattenChildren(child.props.children));
      return;
    }

    result.push(child);
  });

  return result;
}

export function HomepageMdxRenderer({ children }: { children: ReactNode }) {
  const nodes = flattenChildren(children);
  const tableCount = nodes.filter(
    (node) => isValidElement(node) && node.type === "table",
  ).length;
  const sectionCount = nodes.filter(
    (node) => isValidElement(node) && node.type === "h2",
  ).length;
  const splitLayout = tableCount >= 2 && sectionCount >= 2;

  return (
    <div className={`${styles.root} ${splitLayout ? styles.splitLayout : ""}`}>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
