# Quality Safeguards — Locked Specifications

> **Frozen baseline.** These parameters must not be altered without explicit review.
> All new feature expansions (Framer Motion layers, Playwright configs, etc.)
> must inherit these core values.

---

## 1. 100% Client-Side Privacy Baseline

| Tool | Data leaves browser? | Network calls | Rationale |
|------|---------------------|---------------|-----------|
| SSL Toolkit | No | Zero | Offline cert processing |
| Threat Inspector | No (IOC extraction) | Only VT hash/report lookups on user button click | Raw file content never uploaded |
| Port Checker | No | Only port probes from local API route | Config/scan data never leaves |
| PCAP Analyzer | No | Zero | Full offline packet triage |
| Running-Config Decoder | No | Zero | Regex-only Cisco config parser |
| QR Generator | No | Zero | Client-side QR rendering |
| Log Analyzer | No | Zero | Regex-only log parsing |
| Regex Studio | No | Zero | Client-side engine only |
| Core Encoder | No | Zero | Pure function pipeline |
| API Request Lab | Yes (by design) | User-initiated API calls | REST/GraphQL proxy |

**Rule:** Any new parser tool MUST be purely client-side unless the feature
is explicitly a networking tool (e.g., Port Checker, API Lab). Add the new
tool to this table.

---

## 2. Fluid `clamp()` Text Scaling Model

### Typography

| Context | Declaration | Fallback |
|---------|------------|----------|
| Page title (`toolsy-page-title`) | `clamp(2rem, 5vw, 4.25rem)` | 2rem |
| Section title (`toolsy-section-title`) | `clamp(0.72rem, 1.1vw, 0.9rem)` | 0.72rem |
| Description (`toolsy-description`) | `text-sm md:text-base` | 0.875rem |
| Label (`toolsy-label`) | `text-[11px]` | 11px |
| Meta (`toolsy-meta`) | `text-[10px]` | 10px |
| Kicker (`toolsy-kicker`) | `text-[10px]` | 10px |

### Spacing

| Token | Definition |
|-------|-----------|
| `--space-page-x` | `clamp(1rem, 3vw, 2.5rem)` |
| `--space-page-y` | `clamp(1.25rem, 4svh, 5rem)` |
| `--space-section` | `clamp(1rem, 2.5vw, 2rem)` |
| `--space-card` | `clamp(1rem, 2.2vw, 1.75rem)` |
| `--radius-card` | `clamp(1rem, 1.8vw, 1.5rem)` |
| `--home-footer-block` | `clamp(3.5rem, 9svh, 5.25rem)` |

**Rule:** New text or spacing values MUST use `clamp()` with `vw` or `svh` viewport
units. Avoid fixed pixel values for layout properties. All new spacing must draw
from the token set above — do not introduce ad-hoc spacing.

---

## 3. Unified Background System

- **Light mode:** `--background: #ffffff`, `--surface: #f8fafc`
- **Dark mode:** `--background: #020205`, `--surface: #020202`
- **Glass default:** `var(--glass-bg)` with `backdrop-filter: blur(var(--glass-blur)) saturate(180%)`
- **Every background is a CSS variable** — no hardcoded `bg-black`, `bg-white`, etc.,
  unless inside a dark-only/light-only context (e.g., `bg-black/40` overlay).

**Rule:** Never introduce a new color value outside the CSS variable system.
Always use `bg-background`, `bg-surface`, `var(--card-bg)`, etc. The sole
exception is semantic overlays (e.g., `bg-red-500/10` for error states).

---

## 4. Workspace IDE Layout

- Shell: `.workspace-shell` — `100dvh`, `overflow: hidden`, `flex row`
- Sidebar: animated width 64px (collapsed) ↔ 240px (expanded), Framer Motion spring
- Panel: `.workspace-panel` — `flex: 1`, `overflow-y: auto`
- Mobile: sidebar overlays as fixed position, hamburger toggle at `top-3 left-3`
- Focus trap: `useFocusTrap` hook traps Tab/Shift+Tab in mobile sidebar
- Focus return: hamburger button ref receives focus after sidebar closes

**Rule:** Any new tool page must use `ToolContainer` + `ToolHeader` from
`@/components/tools`. Never bypass the workspace layout system.

---

## 5. Shared Component Architecture

| Component | Import Path | Role |
|-----------|-------------|------|
| `ToolContainer` | `@/components/tools` | Page wrapper, sets `--category-accent` |
| `ToolHeader` | `@/components/tools` | Title, badge, breadcrumb, description |
| `ToolSection` | `@/components/tools` | Card-style content container |
| `ToolButton` | `@/components/tools` | Primary/secondary/ghost/danger buttons |
| `ToolTextarea` | `@/components/tools` | Styled textarea with label/hint/error |
| `GlassCard` | `@/components/ui` | Motion card with hover lift effect |

**Rule:** Do not duplicate these components. If a tool needs a variant, extend
via props or composition, not by copy-pasting.

---

## 6. Build & Test Pipeline

```
npm run build   → typecheck → lint → next build
npm run test    → vitest run (jsdom)
npm run dev     → next dev
```

- `eslint.ignoreDuringBuilds: false` — build fails on ANY lint or type error
- `distDir: ".next-build"` — separate from source
- Vitest: `lib/**/*.test.ts`, `jsdom` environment, `@/` alias

**Rule:** `npm run build` MUST pass with 0 errors and 0 warnings before
any feature branch is merged. `npm run test` MUST pass before commit.

---

## 7. Framer Motion Inheritance Requirements

Any new motion layers added to tool pages MUST:
1. Respect `prefers-reduced-motion: reduce` (already in globals.css)
2. Use spring physics (`type: "spring"`, `stiffness: 400-500`, `damping: 25-35`)
   for layout animations
3. Use cubic-bezier `[0.23, 1, 0.32, 1]` for enter/exit transitions
4. NOT interfere with `AnimatePresence mode="wait"` in `WorkspacePanel`

---

## 8. Spacing Standardization (Post-Refactor)

All 6 refactored tools + Core Encoder + Running-Config Decoder adhere to:

| Context | Value |
|---------|-------|
| Outer container gap | `gap-6` |
| Inner grid gap | `gap-5` |
| Footer margin-top | `mt-10` |
| Footer padding-top | `pt-8` |
| Empty state pattern | `border-2 border-dashed border-white/5 rounded-[32px]` |
| Empty state icon | Muted, with uppercase title + micro-copy subtitle |

**Rule:** All new tool UIs must follow this spacing scale exactly. Deviations
require explicit justification.

---

*Maintained by: `scripts/generate-manifest.js`*
*Last updated: per git commit*
