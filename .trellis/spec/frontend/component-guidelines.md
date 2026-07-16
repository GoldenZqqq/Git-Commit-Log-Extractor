# Component Guidelines

> How React components are built in GitPulse.

---

## Overview

Components are plain React function components with explicit `Props` types. The UI should feel like a product-grade desktop workbench: dense, predictable, local-first, and careful with status feedback.

---

## Component Structure

- Keep top-level exported components focused on a surface, then define small private helper components below the main export when they are only used in that file.
- Prefer typed callback props from `App.tsx` over local command invocation inside child components.
- Keep business decisions and persistence in `App.tsx`/`model.ts`; components should present state and emit user intent.
- Use `lucide-react` icons for action buttons and tab labels, as shown in `Workbench.tsx`.

---

## Props Conventions

- Define `type Props = { ... }` for exported components.
- Name callbacks by user intent: `onGenerateMonthly`, `onPreviewChange`, `onOpenSettings`, `onToggleRepo`.
- Pass stable domain values instead of loosely shaped objects when a component only needs a few fields.
- For local helper components, inline prop types are acceptable when the shape is small and not reused.

---

## Styling Patterns

- Use the existing global CSS files under `src/styles/`; do not introduce CSS-in-JS or Tailwind for this app.
- Reuse tokens from `tokens.css` and existing class families before adding new visual language.
- Preserve the quiet desktop tool feel from `PRODUCT.md`: visible controls, restrained density, clear feedback, no marketing-page hero treatment inside the app.
- Keep light and dark theme behavior intact.

---

## Accessibility

- Buttons with icon-only meaning need `aria-label` and usually `title`.
- Tabs and mode switches should expose pressed/selected state with `aria-pressed`, `aria-selected`, or `role="tab"` where appropriate.
- Dialog-like popovers should set a meaningful `role`/`aria-label`.
- Inputs must have labels or `aria-label`; do not rely on placeholder-only labels.

---

## Common Mistakes

- Hiding the active report period, author scope, branch scope, or export status away from the workbench.
- Letting AI polishing controls imply that AI is required to generate a useful report.
- Adding decorative cards or oversized landing-page patterns to the app shell.
- Moving local filesystem or Git behavior into frontend code instead of Rust commands.

## Experimental Provider Disclosure

- Mark an experimental provider in the protocol option itself so users see the status before selecting it.
- Before login or first use, state the eligible account, data destination, likely failure mode, and recommended stable alternatives.
- Keep the experimental marker in the configuration label and connected status; do not let a successful login imply production stability.
- Stable-provider fallback actions must switch configuration without logging out the experimental provider or clearing another provider's secure credentials.
- Playwright should assert the pre-selection label, pre-login disclosure, fallback values, retained API key input, and absence of credential-clear/logout commands.
