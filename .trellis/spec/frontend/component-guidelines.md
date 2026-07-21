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

## Report Workbench Disclosure Contract

The report workbench is organized as a progressive flow: choose report type and period, confirm scope, generate, then act on the generated result. The component tree must keep the current stage obvious without showing actions that cannot work yet.

### Scope / Trigger

- Applies to `Workbench`, `ReportCanvas`, `WorkbenchAssistRail`, and `RepositoryPanel` changes that affect the home screen.
- This is a presentation contract only; report generation, repository scanning, and persistence remain in existing callbacks and Rust commands.

### Contracts

- The empty report state renders one filled primary generation action. Batch generation and blank-day completion remain reachable through secondary controls or the zero-commit suggestion path.
- Copy, AI polish, and export actions render only when a report exists. Copy is the result-stage primary action; polish and export are secondary actions.
- The persistent right rail represents the current report scope. It keeps repository search and selection visible; filtering, batch enable/disable, directory addition, and rescanning belong under repository management controls.
- Repository selection and mapping editing are separate controls. Editing a mapping must not toggle the repository selection.
- Scope summaries expose period, author, repositories, and branch as the default four items. Risk or empty-state notices are conditional.

### Keyboard Navigation

- Main workbench tabs and repository/sidebar tabs use `role="tablist"` and `role="tab"` semantics with a roving `tabIndex`.
- Arrow keys move focus and selection within the tab list; `Home` selects the first tab and `End` selects the last tab. The active tab exposes `aria-selected="true"`.
- The tab contract is covered by Playwright keyboard assertions, not only click assertions.

### Good / Base / Bad Cases

- Good: no report means one obvious generation action; a generated report exposes copy first and optional result actions second.
- Base: a report can be generated with zero commits and shows the existing blank-day suggestion without adding a second competing primary action.
- Bad: rendering export or AI actions before a report exists, or placing repository management controls beside every repository row.

### Test Requirements

- Assert the empty-state primary-action count and result-action conditional rendering.
- Assert the persistent scope rail, independent repository mapping edit control, and repository-management disclosure.
- Assert arrow/Home/End behavior and selected state for both tab groups at desktop and narrow viewport sizes.

### Wrong vs Correct

```tsx
// Wrong: result actions are always visible and compete with generation.
<button onClick={onExport}>导出</button>
<button onClick={onGenerate}>生成报告</button>

// Correct: result actions are content-dependent and ordered by the current stage.
{report ? (
  <ResultActions onCopy={onCopy} onPolish={onPolish} onExport={onExport} />
) : (
  <PrimaryGenerateAction onClick={onGenerate} />
)}
```

### Design Decision: Persistent Scope Rail

The right rail stays visible as “本次范围” so users can verify what will be included without opening a management surface. Management operations are intentionally secondary because they change the workspace rather than the current report intent.

## Experimental Provider Disclosure

- Mark an experimental provider in the protocol option itself so users see the status before selecting it.
- Before login or first use, state the eligible account, data destination, likely failure mode, and recommended stable alternatives.
- Keep the experimental marker in the configuration label and connected status; do not let a successful login imply production stability.
- Stable-provider fallback actions must switch configuration without logging out the experimental provider or clearing another provider's secure credentials.
- Playwright should assert the pre-selection label, pre-login disclosure, fallback values, retained API key input, and absence of credential-clear/logout commands.
