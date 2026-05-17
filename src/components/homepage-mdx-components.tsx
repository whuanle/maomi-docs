import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import styles from "./homepage-mdx-components.module.css";

export function HomePage({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}

interface HeroProps {
  kicker?: string;
  title: string;
  children?: ReactNode;
}

export function Hero({ kicker, title, children }: HeroProps) {
  return (
    <section className={styles.hero}>
      {kicker ? <p className={styles.heroKicker}>{kicker}</p> : null}
      <h1 className={styles.heroTitle}>{title}</h1>
      {children ? <div className={styles.heroBody}>{children}</div> : null}
    </section>
  );
}

interface TagListProps {
  children: ReactNode;
  label?: string;
}

export function TagList({ children, label }: TagListProps) {
  return (
    <ul className={styles.tagList} aria-label={label}>
      {children}
    </ul>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <li className={styles.tag}>{children}</li>;
}

interface SectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        {eyebrow ? <p className={styles.sectionEyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Columns({ children }: { children: ReactNode }) {
  return <div className={styles.columns}>{children}</div>;
}

interface CardProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  as?: "article" | "aside" | "div" | "section";
  children?: ReactNode;
}

export function Card({ eyebrow, title, subtitle, as, children }: CardProps) {
  const Component = (as ?? "article") as ElementType;

  return (
    <Component className={styles.card}>
      {eyebrow ? <p className={styles.cardEyebrow}>{eyebrow}</p> : null}
      {title ? <h3 className={styles.cardTitle}>{title}</h3> : null}
      {subtitle ? <p className={styles.cardSubtitle}>{subtitle}</p> : null}
      {children ? <div className={styles.cardBody}>{children}</div> : null}
    </Component>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.cardGrid}>{children}</div>;
}

interface LinkCardProps {
  href: string;
  eyebrow?: string;
  title: string;
  cta?: string;
  children?: ReactNode;
}

export function LinkCard({
  href,
  eyebrow,
  title,
  cta = "进入专栏",
  children,
}: LinkCardProps) {
  return (
    <Link href={href} className={styles.linkCard}>
      {eyebrow ? <span className={styles.linkCardEyebrow}>{eyebrow}</span> : null}
      <strong className={styles.linkCardTitle}>{title}</strong>
      {children ? <div className={styles.linkCardBody}>{children}</div> : null}
      <span className={styles.linkCardCta}>{cta}</span>
    </Link>
  );
}

export const homepageMdxComponents = {
  HomePage,
  Hero,
  TagList,
  Tag,
  Section,
  Columns,
  Card,
  CardGrid,
  LinkCard,
};
