---
name: cinematic-ui
description: >
  Design and build websites with film-inspired visual systems, director-driven
  art direction, storyboard-first layout planning, and cinematic motion.
  Use when the user asks for a cinematic site, movie-style landing page,
  director-inspired UI, film-noir, sci-fi, romance, thriller, action,
  animation, or a movie-like website aesthetic.
  Do not use for generic web design unless the user explicitly wants a film or
  director reference.
source: https://github.com/akseolabs-seo/cinematic-ui
category: ui
invoke: /cinematic-ui
---

Design the site like a film production, not like a generic landing page.
Treat this as a research-and-translation skill plus a design-library skill.
Its job is to study film references, extract usable cinematic signals, then
turn those signals into page narrative, section structure, motion direction,
and implementable web specs.

The core mechanism is fixed: use a director and a specific film to determine
the site's emotional language, then translate that language into web structure
and implementation. Do not replace this with generic premium-brand logic.

## Start Questionnaire
Run on every invocation before Phase 1 begins:
1. How to start?
   - `Screenshot` — reverse-engineer from an image or URL
   - `Step-by-step` — user chooses genre, director, and film
   - `Surprise me` — pick a fresh combination differing from prior work
2. Should the design include image placeholders?
3. What is the site's niche and page list?

## Operating Model — Four Strict Phases
1. **Phase 1: decisions** → write `decisions.md`
2. **Phase 2: storyboard** → write `storyboard.md`
3. **Phase 3: compiled spec** → write `compiled-spec.md`
4. **Phase 4: build and verify** → implement from spec

Do not skip phases. Do not jump from user request directly to HTML.

## Demo Uniqueness Protocol
When the same user has prior outputs:
- Inspect previous outputs and record a `Previous-work audit` in `decisions.md`
- Write a `Shell-ban list` — layout traits explicitly forbidden in the new project
- Write a `Primary composition family` (e.g. full-bleed stage, corridor, archive wall)
- The new project must choose a different composition family from the most recent output

## Phase Detail

### Phase 1: Decisions
- Research chosen director and film before finalizing (required when web access available)
- Record uniqueness audit, shell-ban list, and primary composition family
- Write `decisions.md`

### Phase 2: Storyboard
- Define site-wide cinematic grammar first (page-shell, nav posture, framing, density)
- Build a director brief: visual thesis, 3 signature techniques, color tokens, typography, motion rules
- Define one irreplaceable signature composition per page
- Map each page to a narrative arc instead of defaulting to Hero → Features → Stats → CTA
- Write `storyboard.md`

### Phase 3: Compiled Spec
- Lock each page's signature composition before deriving shared layout primitives
- Enforce interaction budget: max 1 heavy interaction per page, max 2 attention-seeking reveals
- Extract complete CSS for layout, entrances, and interactions
- Include complete JS when selected interaction requires it
- Write `compiled-spec.md` as single source of truth for implementation

### Phase 4: Build and Verify
- Build from `compiled-spec.md` without improvising new layout logic
- Add reduced-motion handling and responsive behavior
- Verify output against storyboard and compiled spec

## Hard Rules
- Preserve the chosen director and film language through color, type, spacing, composition, and motion
- Keep director names, film titles, chapter markers inside working files — never in the user-facing UI
- Use at least 4 distinct entrance patterns per page
- Every major page role needs one signature composition that cannot be replaced by a generic grid

## Anti-Patterns
- Do not output a generic gradient hero with centered copy unless the source film supports it
- Do not reuse the same hover, reveal, or card pattern in every section
- Do not let the page become a motion demo or effect sampler
- Do not jump from user request directly to HTML without the three planning files
