# Mi — Free IT Tools

Free, fast and private IT tools in one place. A [Maker AI](https://maker-ai.tech) platform.

- **Live:** https://mi.maker-ai.tech
- **Company site:** https://maker-ai.tech

Most tools run entirely in the browser, so files and data stay on the user's device. No sign-up.

## Tools

| Category | Tools |
|---|---|
| Network & Security | SSL Toolkit, Threat Inspector, Port Checker, PCAP Analyzer, TopoMap |
| Data & Analytics | QR Generator, Log Analyzer, JsonLego (external) |
| Dev & Automation | Paste to Code, Regex Studio, API Request Lab, Core Encoder |

The full registry is in [`lib/tools.ts`](lib/tools.ts). The generated overview is in [`architecture/MANIFEST.md`](architecture/MANIFEST.md).

## Tech stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS 3 · Framer Motion · Lucide icons · Vitest

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck, lint, then `next build` (must pass with zero errors) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm test` | Vitest (`lib/**/*.test.ts(x)`) |
| `npm run manifest` | Regenerate `architecture/` manifest (also runs on every commit) |

### Environment variables

| Variable | Used by | Required |
|---|---|---|
| `VIRUSTOTAL_API_KEY` | Threat Inspector (`app/api/threat/*`) | Only for VirusTotal lookups |

Put local values in `.env.local` (git-ignored).

## Project structure

```
app/
  page.tsx                 Homepage (hero, search, tool grid)
  tools/                   Workspace: sidebar + tabs + tool pages
    [category]/[slug]/     Direct-URL route for each tool
    <tool-folder>/         One folder per tool (client-page.tsx + logic)
  api/                     Server routes (port check, API lab, VirusTotal)
components/
  layout/                  SiteHeader, SiteFooter
  home/                    ToolsExplorer, ThemeToggle
  workspace/               Sidebar, tab panel, quick switcher (Ctrl+K)
  tools/                   Shared tool UI (ToolContainer, ToolHeader, ...)
  ui/                      MiLogo, ToolIcon, GlassCard
lib/                       Tool registry and pure logic (+ tests)
public/brand/              Maker AI logo files
architecture/              Auto-generated manifest + quality safeguards
```

## Adding a tool

1. Create `app/tools/<category>/<tool-name>/client-page.tsx` (use `ToolContainer` + `ToolHeader`).
2. Add the tool to `lib/tools.ts`.
3. Register the component in `components/workspace/WorkspacePanel.tsx` (`TOOL_MODULES`) and `app/tools/[category]/[slug]/page.tsx` (`implementedTools`).
4. Add an icon in `components/ui/ToolIcon.tsx`.
5. Keep logic in `lib/` with tests, and add the tool to the privacy table in `architecture/QUALITY_SAFEGUARDS.md`.

## Deployment

Deployed on Vercel from `main`, served at `mi.maker-ai.tech`. The build output directory is `.next-build` locally and `.next` on Vercel (see `next.config.mjs`).

## Docs

- [`CLAUDE.md`](CLAUDE.md) — instructions for AI coding sessions
- [`Rules.md`](Rules.md) — development guidelines
- [`architecture/QUALITY_SAFEGUARDS.md`](architecture/QUALITY_SAFEGUARDS.md) — locked quality rules
