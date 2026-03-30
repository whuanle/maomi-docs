---
session: ses_2f44
updated: 2026-03-20T14:43:26.863Z
---

# Session Summary

## Goal
Provide a concise, non-technical explanation of the project’s purpose and core working approach based on README and key app/components/lib files.

## Constraints & Preferences
- Summaries must be concise and understandable by non-technical users.
- Follow the user’s request to focus on README, app/layout, app/page, components, lib.
- Use exact file paths and function names.

## Progress
### Done
- [x] Reviewed `README.md` for project purpose, configuration via `config/site.json`, docs via `docs/`, and Docker usage/mounting expectations.
- [x] Inspected main app routing/layout files (`src/app/layout.tsx`, `src/app/page.tsx`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/[moduleId]/page.tsx`, `src/app/[locale]/[moduleId]/[...slug]/page.tsx`) to understand page flow and routing.
- [x] Read core UI components that drive layout and interactions: `doc-layout`, `doc-content-client`, `sidebar`, `site-header`, `global-search`, `custom-head-elements`.
- [x] Read data/config logic in `src/lib/site-config.ts`, `src/lib/docs.ts`, and `src/lib/markdown.ts`.
- [x] Read search API route `src/app/api/search/route.ts` to understand global search behavior.

### In Progress
- [ ] Summarizing the project purpose and core workflow for a non-technical audience (no summary response produced yet).

### Blocked
- (none)

## Key Decisions
- **Focus on runtime file-driven content**: The system reads `config/site.json` and `docs/` at runtime to control site settings and documentation content, enabling Docker volume mounts without rebuilding images.

## Next Steps
1. Write the requested concise, non-technical explanation of the project’s purpose and how it works, referencing insights from README and the inspected app/components/lib files.
2. Emphasize that the homepage lists modules from `docs/`, docs are rendered from Markdown/MDX, and site settings come from `config/site.json`.
3. Mention key user-facing features: navigation, sidebar, search, theme toggle, table of contents, markdown rendering with code/mermaid/math.

## Critical Context
- The site is a Next.js documentation platform that reads **site config** from `config/site.json` and **docs content** from the `docs/` folder at runtime (Docker-friendly).
- Root route redirects to `/zh` (`src/app/page.tsx`), supported locale is only `zh` (`isSupportedLocale`).
- Homepage (`src/app/[locale]/page.tsx`) lists documentation modules from `listModules()` with card links.
- Module page (`src/app/[locale]/[moduleId]/page.tsx`) renders module README or first doc using `getReadmeDoc`.
- Doc page (`src/app/[locale]/[moduleId]/[...slug]/page.tsx`) uses `DocLayout` with sidebar, prev/next links, TOC.
- `DocContentClient` renders Markdown with GFM, math (KaTeX), Mermaid diagrams, code highlighting, image zoom, and relative asset/link resolution.
- Global search (`GlobalSearch` + `/api/search`) searches titles and content and returns top results.

## File Operations
### Read
- `E:\workspace\maomi_doc\README.md`
- `E:\workspace\maomi_doc\src\app\[locale]\[moduleId]\[...slug]\page.tsx`
- `E:\workspace\maomi_doc\src\app\[locale]\[moduleId]\page.tsx`
- `E:\workspace\maomi_doc\src\app\[locale]\layout.tsx`
- `E:\workspace\maomi_doc\src\app\[locale]\page.tsx`
- `E:\workspace\maomi_doc\src\app\api\search\route.ts`
- `E:\workspace\maomi_doc\src\app\layout.tsx`
- `E:\workspace\maomi_doc\src\app\page.tsx`
- `E:\workspace\maomi_doc\src\components\custom-head-elements.tsx`
- `E:\workspace\maomi_doc\src\components\doc-content-client.tsx`
- `E:\workspace\maomi_doc\src\components\doc-layout.tsx`
- `E:\workspace\maomi_doc\src\components\global-search.tsx`
- `E:\workspace\maomi_doc\src\components\sidebar.tsx`
- `E:\workspace\maomi_doc\src\components\site-header.tsx`
- `E:\workspace\maomi_doc\src\lib\docs.ts`
- `E:\workspace\maomi_doc\src\lib\markdown.ts`
- `E:\workspace\maomi_doc\src\lib\site-config.ts`

### Modified
- (none)
