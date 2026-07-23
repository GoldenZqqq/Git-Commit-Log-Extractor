# 官网品牌 3D 场景与交互升级 - Implementation Plan

## Preconditions

- Active scope is the Astro website under `site/`; do not modify the React/Tauri application.
- User-approved scope is Hero-only 3D; existing workflow and demo sections retain their structure.
- Before editing implementation files, load `trellis-before-dev` and the relevant frontend spec.

## Ordered Checklist

### 1. Capture baseline

- [x] Build the current website from `site/` and record the baseline result.
- [x] Start the current website and capture 1440x900 and 390x844 Hero screenshots for comparison.
- [x] Record current Hero media requests and confirm the existing autoplay video behavior.

### 2. Build the Pulse Core asset in Blender

- [x] Add `site/assets-src/3d/build_pulse_core.py` with deterministic scene reset, geometry, named objects, materials, preview camera/light, save and export steps.
- [x] Execute the script through Blender MCP in small steps and inspect the viewport after geometry, materials and final composition.
- [x] Save `gitpulse-pulse-core.blend` and export `gitpulse-pulse-core.glb` plus `gitpulse-pulse-core.webp`.
- [x] Inspect object names/bounds and verify Ring, Waveform and three Git nodes are independently addressable.
- [x] Check GLB/WebP size; simplify geometry/materials until the GLB is within the 1–1.5 MB target or document a justified exception before integration.

Rollback point: asset generation is isolated under `site/assets-src/3d/` and can be regenerated without touching website runtime code.

### 3. Add website asset and dependency plumbing

- [x] Add Three.js to `site/package.json` using npm and update `site/package-lock.json`; add type declarations only if required by the installed version.
- [x] Extend `site/scripts/sync-assets.mjs` to validate/copy the GLB and WebP from `site/assets-src/3d/` into `site/public/assets/`.
- [x] Run the sync script/build once to prove GitHub Pages' base-path asset location is correct.

Rollback point: package and sync changes are independent of Hero markup until the next step.

### 4. Implement the Hero scene shell

- [x] Replace the Hero background video in `HomePage.astro` with poster, canvas and scene container markup using base-aware data URLs.
- [x] Keep all existing server-rendered copy, facts, CTA and semantic headings.
- [x] Set the lower demo video to `preload="none"` while preserving controls and poster.
- [x] Update Hero CSS for full-bleed scene layering, right-weighted model framing, stable canvas dimensions and poster-to-canvas transition.
- [x] Remove the decorative grid texture and obsolete video-specific responsive rules.
- [x] Adjust Hero typography/spacing only as required to prevent overlap and keep a hint of the next section visible.

### 5. Implement Three.js runtime and interaction

- [x] Add `site/src/scripts/hero-scene.ts` with capability checks, GLTF loading, named-object validation, responsive camera framing and first-frame readiness.
- [x] Add capped DPR, ResizeObserver, IntersectionObserver, visibility pause/resume and pagehide disposal.
- [x] Implement damped idle motion and pointer parallax within the defined limits.
- [x] Implement bounded drag without stealing vertical touch scrolling.
- [x] Implement node raycasting, hover material feedback and one coalesced click/tap pulse animation.
- [x] Preserve static fallback for reduced motion, save-data, WebGL failure, GLB failure and object-contract failure.
- [x] Remove the obsolete Hero video parallax from `site-motion.ts`; keep existing copy/facts/meter and story/demo animations intact.

### 6. Add focused website verification

- [x] Add or run a site-scoped Playwright check against the local Astro server for desktop and mobile viewports.
- [x] Assert Hero/canvas bounds, no horizontal overflow, visible title/CTA and visible next-section edge.
- [x] Perform canvas-pixel probes at desktop and mobile widths after the scene reaches `ready`.
- [x] Capture final screenshots at 1440x900, 1024x768, 390x844 and 320x900; visually inspect model framing, text overlap and asset rendering.
- [x] Emulate reduced motion and verify the poster path.
- [x] Simulate GLB/WebGL failure and verify copy/CTA/fallback remain intact.
- [x] Verify both `/GitPulse/zh-CN/` and `/GitPulse/en/` render correctly.

### 7. Final quality gate

- [x] Run `$ErrorActionPreference = 'Stop'; npm run build` from `site/`.
- [x] Run the focused Playwright/site smoke commands and record results.
- [x] Run `$ErrorActionPreference = 'Stop'; git diff --check` from the repository root.
- [x] Review all changed files for scope drift, accessibility, cleanup, base-path correctness and generated-asset provenance.
- [x] Update PRD acceptance checkboxes only with verification evidence.
- [x] Run `trellis-check` before reporting completion.

## Final Verification Record

- Blender source: `gitpulse-pulse-core.blend` 1,007,328 bytes.
- Web assets: GLB 387,500 bytes; WebP 15,994 bytes.
- Loading: static WebP paints first; Three.js loads through a dynamic import; the lower demo video uses `preload="none"`.
- Build: Node 22 `npm run build` passed; Five Astro routes generated. Vite reports the expected asynchronous Three.js chunk warning above 500 KB.
- E2E: `npm run test:e2e:hero` passed 9 tests; one mobile skip is the desktop-only mouse hover/drag case.
- Visual: 1440x900, 1024x768, 390x844 and 320x900 screenshots passed manual framing/overlap review and Canvas entropy/deviation checks.
- Fallbacks: reduced motion and failed GLB paths retained visible poster, heading and CTA.
- Static checks: `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities; `git diff --check` passed with line-ending warnings only.

## Expected Changed Files

- `site/assets-src/3d/build_pulse_core.py`
- `site/assets-src/3d/gitpulse-pulse-core.blend`
- `site/assets-src/3d/gitpulse-pulse-core.glb`
- `site/assets-src/3d/gitpulse-pulse-core.webp`
- `site/package.json`
- `site/package-lock.json`
- `site/scripts/sync-assets.mjs`
- `site/src/components/HomePage.astro`
- `site/src/scripts/hero-scene.ts`
- `site/src/scripts/site-motion.ts`
- `site/src/styles/home.css`
- `site/src/styles/motion.css`
- `site/src/styles/responsive.css`
- Optional focused site Playwright config/spec if existing tooling cannot target Astro directly.

## Do Not Change Without Replanning

- Desktop React/Tauri application files under `src/` or `src-tauri/`.
- Existing workflow/story DOM structure or its scroll-linked narrative.
- Shared product terminology, report behavior or release/update logic.
- GitHub Pages workflow, root build configuration, schema, persistence or backend APIs.
