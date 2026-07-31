# Prism — DuBois Rebuild & Rename — Design Spec

**Date:** 2026-07-31
**Branch:** `feature/apex-theming` (the real trunk — 146 commits ahead of stale `main`)
**Status:** Approved (design), ready for phased implementation plans
**Supersedes:** the hand-built DuBois adoption effort — see memory `apex-design-system-adoption`
(halted, not reverted). Related: memory `apex-dubois-starter-kit`, `apex-modular-components`,
`config-driven-agent-ready`.

## What we're building

Re-found the **Prism** frontend (formerly "APEX" / repo `advito-ai-bi`) on the **canonical
DuBois design system** taken from the Databricks starter kit (`github.com/gioa/db-starter-kit`,
cloned to `/tmp/db-starter-kit`), while keeping the FastAPI backend + Firefly SP-auth hosting
untouched. Rename the product to **Prism**; "APEX" becomes Advito's white-label brand
override (client #1). All customization stays config-driven, disciplined to **accent + logo +
name only**.

## Why

We spent days hand-reverse-engineering DuBois from Lakewatch screenshots, with a lot of
back-and-forth. The starter kit IS the canonical source of truth we were approximating —
same stack family (Tailwind v4 `@theme` + shadcn/ui), primary `#2272b4` (our exact accent),
a working shell, 457 real Databricks icons, ~50 DuBois-overridden components, and a
`DESIGN.md`/`CLAUDE.md` spec. Adopting it directly ends the guesswork and gives us a
maintainable, on-brand foundation. Renaming to Prism makes the product ours and unique;
white-label means Advito still gets "APEX" via config.

## Architecture

- **Backend + hosting:** UNCHANGED. `app.py` (FastAPI, 41 py files) serves `frontend/dist`
  with SPA fallback; SP token minting, tenant resolver/isolation, Genie MCP proxy, Lakebase
  persistence, session auth, UC row filters all intact. `/api/*` is the fixed contract. This
  is a **frontend-only** re-foundation.
- **Token layer:** replace our three-layer `index.css` model with the kit's canonical
  `globals.css` — DuBois primitive palettes (blue/neutral/grey/red/green/yellow + 11 tag
  hues), `@theme inline` semantic mappings, and `:root` / `.dark` semantic values verbatim
  (warm neutrals, `--radius` 4px + 8px container, `--primary #2272b4`, `--secondary #f7f7f7`,
  tag tokens, `--action-*` interaction tints, `--table-row-*`, AI gradient
  `135deg #4299E0→#CA42E0→#FF5F46`).
- **Config seam (the hard requirement, reconciled):** `brand.config.json` slims to brand
  essentials. `ThemeProvider` reads it and writes ONLY these as inline overrides on top of
  the canonical DuBois defaults:
  - accent → `--primary`, `--primary-foreground`, `--primary-hover`, `--primary-press`,
    `--ring`, `--sidebar-primary` (all derived from one accent color)
  - identity → logo / mark / favicon, app name / tagline
  Everything else (neutrals, radii, typography, tag palette, AI gradient) is canonical
  DuBois, **not** overridable. A rebrand = one color + a logo. Default accent `#2272b4` = our
  current look, so the default IS on-brand.
- **Token naming:** standardize on canonical DuBois names (`--primary`, `--secondary`,
  `--background`, `--foreground`, `--muted-foreground`, `--border`, tag palette, `--action-*`).
  Our names (`--surface`, `--fg`, `--accent`, `--n0..--n12`) become temporary ALIASES pointing
  at DuBois values during migration so the app never breaks; components migrate off the
  aliases; then the aliases are DELETED → 100% canonical end state, no permanent dual vocab.
- **Dark mode:** adopt `next-themes` (class-based `.dark` on `<html>`, works in Vite),
  replacing our custom `useTheme` hook, so kit components theme verbatim.
- **Components + icons:** VENDOR the ~50 DuBois `ui/*` components, the shell, and 457 icons
  INTO `frontend/src` (ours to own/edit — not an npm dep on the kit; matches the shadcn/starter
  model). Add the Radix deps the kit requires (`radix-ui` umbrella + a few singletons,
  `class-variance-authority`, `tailwind-merge`, `clsx`, `next-themes`, `cmdk`, `vaul`, `sonner`).

## What we keep vs. replace

**Keep:** FastAPI + all backend; ALL working feature logic/hooks/API calls (Genie MCP
polling, dashboard iframe embed + header crop, filter state + persistence, admin CRUD, SP
auth flows); the config-driven brand seam (reshaped, not removed); `next-themes`.

**Replace:** hand-built tokens (`index.css`), hand-built primitives (our tokenized
Button/Badge/Tabs/Popover/Avatar/ScrollArea), hand-built shell (full-width top bar,
BrandBlock, modular shell components), and the in-flight light-shell re-tune
(`plans/2026-07-30-light-shell-retune.md`, Task 1 @ c19371a) — **halted, not reverted**;
superseded by the canonical shell.

## Canonical corrections our hand-built work got wrong (DESIGN.md is source of truth)

1. Shell chrome = `secondary` `#f7f7f7` warm-grey; TopBar + Sidebar share the SAME bg with
   NO dividing borders; only the content card is white + bordered + `rounded-md`. (Our
   fully-light-shell pivot was right; the dark-L-shape was wrong.)
2. Light neutrals are WARM grey (no blue cast); the blue-tinted grey ramp is the DARK-mode
   palette. (We had tuned "cooler" — reconcile to warm.)
3. Radii = 4px interactive / 8px container; NO `rounded-lg` on buttons/inputs. (We drifted.)
4. AI gradient ends orange-red `#FF5F46`, not coral. (Ours diverged.)
5. 13px base; `font-semibold` (600) never `font-bold` (700); system SF Pro, never Inter.
6. Active nav = `bg-primary/10 text-primary font-semibold` + blue icon.
7. Button variants: DuBois `default` = filled blue primary; `default` (bordered) is the
   renamed old shadcn `outline`. Watch the rename at every callsite.

## Migration phases (each PR-sized, its own plan + subagent-driven run + review, ends green)

1. **Rename → Prism.** Repo/remote name, `package.json` name, `brand.config.json` `appName`
   default → "Prism", `<title>`, docs/memory references. Advito's config keeps
   `appName: "APEX"`. No backend/logic change.
2. **Token foundation.** Vendor `globals.css` canonical tokens behind the slimmed config seam;
   adopt `next-themes`; add our-name→DuBois aliases so the existing app keeps working and
   re-colors to canonical DuBois. Green build + live check both themes.
3. **Icons + UI primitives.** Vendor 457 icons + `ui/*`; migrate our components off aliases
   onto canonical primitives + names. Handle the Button-variant rename.
4. **Shell.** Vendor `AppShell`/`TopBar`/`Sidebar`/`PageHeader`; feed nav from our
   registry/routes (make the hardcoded `NAV_SECTIONS` a prop); swap `DatabricksLogo` → our
   `BrandLogo`; drop `NewButton` (Prism has no create-menu); retire our hand-built shell +
   the full-width top bar.
5. **Pages, reskinned.** Rebuild each page group (Home, Ask APEX / Genie chat + rail,
   dashboards + toolbar + filters, admin, preferences, login) on DuBois primitives — KEEP all
   feature logic, swap presentation only. Reskin our ConversationRail/Ask APEX into the
   `GenieCodePanel` pattern.
6. **Cleanup.** Delete alias tokens + dead hand-built components; fold the kit's `CLAUDE.md`
   DuBois rules into our repo guidance.

## Testing & safety

- Continue on `feature/apex-theming`. Each phase = its own spec-derived plan, subagent-driven
  execution, task + final review; `cd frontend && npm test && npm run build` green per task.
- Live Chrome check per phase in BOTH light + dark.
- Frontend-only: the `/api/*` contract is the fixed interface; no backend edits.
- Push cadence per Rohit (push to `feature/apex-theming`, no PRs, batch phases).

## Out of scope

- Any backend / SP-auth / hosting change.
- A genuinely new git repo or framework switch to Next.js (explicitly rejected — keep Vite +
  React Router + FastAPI).
- Making neutrals/radii/type/tags/gradient client-overridable (locked to accent + logo + name).

## Reference

- Starter kit clone: `/tmp/db-starter-kit` (ephemeral — re-clone `github.com/gioa/db-starter-kit`
  if gone). Key files: `DESIGN.md`, `src/app/globals.css`, `CLAUDE.md`,
  `src/components/{ui,shell,icons}`.
- Memory: `apex-dubois-starter-kit` (full decision log), `apex-design-system-adoption`
  (the superseded hand-built effort).
