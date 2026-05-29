# Migrate Frontend Styling from Bootstrap 4 to Tailwind v4 + shadcn-style Components

## Status

Accepted — **supersedes** `adr-005-bootstrap-vs-tailwind` (archived 2026-05-29 in `docs-archived-2026-05-29/adrs/`).

## Date

2026-05-29 (documenting a migration completed ~2026-05-18).

## Context and Problem Statement

`adr-005` (Jan 2023) chose **Bootstrap 4** via `react-bootstrap` and deferred any Tailwind
migration "to v3.0, pending evaluation". In the ~2026-05-18 frontend rework ("rework all
pages") that deferral was resolved in code: the storefront and admin screens were rebuilt on
**Tailwind v4** with a shadcn/Radix-style component layer under
`frontend/src/components/good-shop/`, governed by the design tokens in `DESIGN.md`. The code
now contradicts `adr-005`. This ADR records the decision that the code already reflects so the
ADR set matches reality (the audit's one hard-superseded record).

## Considered Options

1. **Keep Bootstrap 4** (status quo of adr-005) — familiar, but `react-bootstrap` 1.x is aging,
   utility-first workflows had become the team default, and the redesign needed design-token control.
2. **Tailwind v4 + shadcn-style components** (chosen) — utility-first CSS, `@theme` HSL tokens,
   headless Radix primitives wrapped locally in `good-shop/`, full control over the visual system.
3. **CSS-in-JS (styled-components / Emotion)** — rejected: heavier runtime, less alignment with the
   token-driven direction in `DESIGN.md`.

## Decision

Adopt **Tailwind v4** as the styling system and a local shadcn/Radix-style component library
(`frontend/src/components/good-shop/`). Design tokens and visual direction are owned by
[`../design/DESIGN.md`](../design/DESIGN.md). `react-bootstrap` and the Bootstrap CSS are removed
from the rendered UI.

## Consequences

- **Positive:** consistent token-driven design system; modern utility workflow; headless
  accessible primitives; matches `DESIGN.md` and the `anti-slop-supplement` guard-rails.
- **Negative / follow-ups:** much existing prose docs (page docs, feature docs, both
  `architecture.md` files) still describe the Bootstrap-era UI — flagged with
  `TODO(audit-2026-05-29)` markers during this audit rather than rewritten wholesale.
- **Tooling:** frontend build moved toward Vite; see `../runbooks/local-setup.md` (Node ≥18).

## Related

- Supersedes: `adr-005-bootstrap-vs-tailwind` (archived).
- Primary source: `../design/DESIGN.md`.
- Unaffected canonical ADRs: `0001` (JWT), `0002` (PayPal verification), `0003` (no migrations).
