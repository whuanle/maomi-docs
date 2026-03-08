import { createElement } from "react";

interface ParsedHeadElement {
  tagName: string;
  attributes: Record<string, string | boolean>;
  innerHtml?: string;
}

const HEAD_ELEMENT_PATTERN =
  /<!--[\s\S]*?-->|<(script|style|noscript)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<(meta|link|base)\b([^>]*?)\/?>/gi;

const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  acceptcharset: "acceptCharset",
  charset: "charSet",
  class: "className",
  crossorigin: "crossOrigin",
  enctype: "encType",
  for: "htmlFor",
  httpequiv: "httpEquiv",
  nomodule: "noModule",
  referrerpolicy: "referrerPolicy",
  tabindex: "tabIndex",
};

function normalizeAttributeName(name: string) {
  const lowerName = name.toLowerCase();

  if (lowerName.startsWith("data-") || lowerName.startsWith("aria-")) {
    return lowerName;
  }

  return ATTRIBUTE_NAME_MAP[lowerName] ?? lowerName;
}

function parseAttributes(input: string) {
  const attributes: Record<string, string | boolean> = {};
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match = attributePattern.exec(input);

  while (match) {
    const [, rawName, doubleQuoted, singleQuoted, unquoted] = match;
    const attributeName = normalizeAttributeName(rawName);
    const attributeValue = doubleQuoted ?? singleQuoted ?? unquoted;

    attributes[attributeName] =
      attributeValue === undefined ? true : attributeValue;

    match = attributePattern.exec(input);
  }

  return attributes;
}

function parseCustomHeadHtml(html: string) {
  const elements: ParsedHeadElement[] = [];
  const trimmedHtml = html.trim();

  if (!trimmedHtml) {
    return elements;
  }

  HEAD_ELEMENT_PATTERN.lastIndex = 0;

  let match = HEAD_ELEMENT_PATTERN.exec(trimmedHtml);

  while (match) {
    if (match[0].startsWith("<!--")) {
      match = HEAD_ELEMENT_PATTERN.exec(trimmedHtml);
      continue;
    }

    if (match[1]) {
      const [, rawTagName, rawAttributes, rawInnerHtml] = match;
      const innerHtml = rawInnerHtml.trim();

      elements.push({
        tagName: rawTagName.toLowerCase(),
        attributes: parseAttributes(rawAttributes),
        innerHtml: innerHtml || undefined,
      });
    } else if (match[4]) {
      const [, , , , rawTagName, rawAttributes] = match;

      elements.push({
        tagName: rawTagName.toLowerCase(),
        attributes: parseAttributes(rawAttributes),
      });
    }

    match = HEAD_ELEMENT_PATTERN.exec(trimmedHtml);
  }

  return elements;
}

export function CustomHeadElements({ html }: { html?: string }) {
  if (!html) {
    return null;
  }

  const elements = parseCustomHeadHtml(html);

  if (elements.length === 0) {
    return null;
  }

  return (
    <>
      {elements.map((element, index) =>
        createElement(element.tagName, {
          key: `${element.tagName}-${index}`,
          ...element.attributes,
          ...(element.innerHtml
            ? { dangerouslySetInnerHTML: { __html: element.innerHtml } }
            : {}),
        }),
      )}
    </>
  );
}
