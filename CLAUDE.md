# Mi (repo: Toolsy)

Free, English-only IT tools website. Brand name is **Mi**. Built and owned by **Maker AI**, an IT services company (`maker-ai.tech`). Deployed at `mi.maker-ai.tech`. Read `README.md` for the overview, commands and structure.

The owner is an IT professional. Tools should be practical, fast and private (client-side by default).

## Commands

```bash
npm run dev          # dev server on :3000
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm test             # vitest run
npm run build        # typecheck + lint + next build
```

Before committing: `typecheck`, `lint` and `test` must all pass.

## Brand and design

- **Name:** "Mi". Footer text is "A Maker AI platform" linking to `https://maker-ai.tech`.
- **Language:** English only. No Arabic or other locales in the UI.
- **Colors come from the Maker AI logo:** teal `#0eb3ba` is the only accent. Do not add per-category colors (red, blue, purple). `toolCategories` in `lib/tools.ts` deliberately uses teal for all.
- **Theme:** dark by default, light as an option. Tokens live in `app/globals.css` (`:root` and `.dark`). Use tokens (`bg-background`, `bg-surface`, `text-muted`, `border-border`, `text-accent`, `var(--card-bg)`), never hardcoded hex.
- **Style:** clean and minimal. No starfields, globes, holographic or "sci-fi" copy ("Initialize Module", "Systems Nominal"). Plain labels.
- **Icons:** Lucide only. Tool icons come from `components/ui/ToolIcon.tsx`. The `icon` string field on `Tool` is legacy and should not be shown in the UI.
- **Logos:** `components/ui/MiLogo.tsx` (`MiIcon` = M with arrow, `MiLogo` = full Maker AI logo, both inline SVG using `currentColor`). Static files are in `public/brand/`, sources in `assets/logo/`.
- Primary buttons on teal use dark text (`text-[#04181a]`) for contrast.

## Architecture

- **Next.js 14 App Router**, TypeScript, Tailwind 3, Framer Motion 12.
- `app/page.tsx` is the homepage (server component) with `SiteHeader`, `ToolsExplorer`, `SiteFooter`.
- `app/tools/layout.tsx` wraps everything under `/tools` in the workspace shell (sidebar + tab bar + panel). Tools open as tabs without a full page reload; `WorkspaceContext` keeps state in sync with the URL.
- Each tool is its own folder under `app/tools/` with a `client-page.tsx`. Tool logic belongs in `lib/` (pure functions, with tests in `lib/__tests__/`).
- TopoMap (`running-config-decoder`) parses configs in `lib/netconfig/` (one parser per vendor into a shared `ParsedDevice` model, plus `map.ts` for the diagram data). Add new vendors there with a test in `lib/__tests__/netconfig.test.ts`.
- Server routes are in `app/api/` (port check, API lab, VirusTotal proxy). `lib/ssrf-utils.ts` guards outbound requests; do not bypass it.
- Tool pages use `ToolContainer` + `ToolHeader` + `ToolSection` from `@/components/tools`. Do not copy these components.

### Adding a tool (all four places are required)

1. `app/tools/<category>/<slug>/client-page.tsx`
2. Entry in `lib/tools.ts`
3. Component registered in `components/workspace/WorkspacePanel.tsx` (`TOOL_MODULES`) **and** `app/tools/[category]/[slug]/page.tsx` (`implementedTools`)
4. Icon in `components/ui/ToolIcon.tsx`

Then add it to the privacy table in `architecture/QUALITY_SAFEGUARDS.md`.

## Rules to respect

- Tools are independent and modular. Do not hardcode tool-specific logic globally.
- Privacy: new parser/utility tools must be 100% client-side. Only networking tools (Port Checker, API Lab) and the VirusTotal lookups may call the server.
- `architecture/QUALITY_SAFEGUARDS.md` and `Rules.md` hold the locked rules (spacing, motion, build pipeline). Where `QUALITY_SAFEGUARDS` describes the old "cinematic" home page, the design rules in this file win.
- Respect `prefers-reduced-motion` for any new animation.
- Keep dependencies minimal. Check `package.json` before adding a package.

## Gotchas

- **Windows + Git:** git may report `dubious ownership`. Use `git -c safe.directory=E:/CODE/Projects/Toolsy <cmd>` (do not change global config unless the user asks). `git status` with no path can fail because of stale entries in `.claude/worktrees`; limit it to paths, e.g. `git status --short -- app components lib`.
- **pre-commit hook** (local, in `.git/hooks`, not versioned) regenerates `architecture/manifest.json` and `MANIFEST.md` and adds them to the same commit. Do not hand-edit them. On a fresh clone the hook is missing; run `npm run manifest` and commit the result if the manifest is stale.
- **Git identity** is not configured on this machine. Use `-c user.name=maker -c user.email=alsani.mohd@gmail.com` per command, or ask.
- **GitHub push:** remote is `alsanimohd-ui/Toolsy`. A 403 naming a different user means the cached Windows/Git Credential Manager login is the wrong account; the user signs in themselves. Pushes that need a login popup work from the user's own terminal tab, not the sandbox shell.
- **Line endings:** files may show CRLF warnings. Do not mass-convert.
- **No Python** on this machine. Use Node for scripts.
- Build output dir is `.next-build` locally and `.next` on Vercel (`next.config.mjs`).
- `components/workspace/CommandPalette.tsx` (pins/recents) exists but is not mounted; `QuickSwitcher` owns Ctrl+K. `Dock.tsx` is unused and uncommitted.
- Env: `VIRUSTOTAL_API_KEY` in `.env.local` for Threat Inspector.

## Working across sessions

- Keep this file and `README.md` current when you change structure, commands or conventions.
- Commit in small, focused commits with clear messages. Do not push or force-push unless the user asks.
- Verify UI changes in the browser (dev server: `.claude/launch.json` entry `toolsy-dev`) in both dark and light themes, and at mobile width.

## Agent skills

### Issue tracker

Issues are tracked using GitHub issues. External PRs are not treated as a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default label mapping (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

The repository uses a single-context layout (one CONTEXT.md and docs/adr/ at the root). See `docs/agents/domain.md`.
