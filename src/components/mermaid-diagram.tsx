"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const diagramId = useId().replace(/:/g, "");
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  const mermaidTheme = resolvedTheme === "dark" ? "dark" : "neutral";
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: mermaidTheme,
          themeVariables: {
            fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
            fontSize: "15px",
            primaryColor: isDark ? "#1f2937" : "#f8fafc",
            primaryTextColor: isDark ? "#e5e7eb" : "#111827",
            primaryBorderColor: isDark ? "#4b5563" : "#cbd5e1",
            lineColor: isDark ? "#9ca3af" : "#64748b",
            secondaryColor: isDark ? "#111827" : "#eff6ff",
            tertiaryColor: isDark ? "#0f172a" : "#ffffff",
            background: "transparent",
            mainBkg: isDark ? "#1f2937" : "#f8fafc",
            secondBkg: isDark ? "#111827" : "#eff6ff",
            tertiaryBkg: isDark ? "#0b1220" : "#ffffff",
            clusterBkg: isDark ? "#111827" : "#f8fafc",
            clusterBorder: isDark ? "#4b5563" : "#cbd5e1",
            edgeLabelBackground: isDark ? "#111827" : "#ffffff",
          },
        });

        const { svg: renderedSvg } = await mermaid.render(`mermaid-${diagramId}`, chart);

        if (!cancelled) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg("");
          setError(renderError instanceof Error ? renderError.message : "Mermaid render failed");
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId, isDark, mermaidTheme]);

  if (error) {
    return (
      <div className="mermaid-diagram my-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-medium">Mermaid 渲染失败</div>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-red-200 bg-white/80 p-3 text-xs text-red-700">
          {error}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="mermaid-diagram my-6 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
        正在渲染 Mermaid 图表...
      </div>
    );
  }

  return (
    <div
      className={`mermaid-diagram my-6 overflow-x-auto rounded-lg border p-4 md:p-5 ${
        isDark
          ? "border-slate-700 bg-slate-950/40 text-slate-100"
          : "border-slate-200 bg-slate-50/80 text-slate-900"
      }`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}