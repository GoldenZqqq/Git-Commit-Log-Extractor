# 官网品牌 3D 场景与交互升级 - Technical Design

## Decision Summary

首期仅替换官网 Hero 的全屏自动播放视频，以一个全屏、无边框的 Three.js 品牌场景承载 Pulse Core 模型。现有工作流、功能、隐私、下载、FAQ 和演示视频章节保持原有结构；演示视频调整为非首屏抢占式加载。

3D 模型采用 Blender Python 可重复建模，而不是图片转 3D。模型只使用简单 PBR 材质和几何体，不使用大纹理、环境贴图或高密度粒子系统。Web 端负责灯光、相机、交互和运行时降级。

## Visual Model Contract

### Pulse Core geometry

- `PulseRoot`: 整体模型根节点，前视轮廓保持接近 LOGO。
- `Ring`: 约 280 度的开口圆环，陶瓷白/浅金属材质，具有可见倒角和适度厚度。
- `GitRails`: 三段青色连接轨道，表达 Git 分支，不追求电路板或赛博朋克细节。
- `GitNodeTop` / `GitNodeLeft` / `GitNodeBottom`: 三个可被 Web 端射线检测的独立节点。
- `Waveform`: 橙色脉冲波形，以倒角曲线构建，横向穿过圆环。
- 所有交互对象使用稳定、语义化对象名；网页不依赖 Blender 自动生成的序号名称。

### Materials

- Ring: 低金属度、偏陶瓷的浅色材质，避免镜面高光遮挡轮廓。
- Nodes/Rails: 品牌青色 `#01A3B0` 附近，节点拥有可动画的 emissive 强度。
- Waveform: 品牌橙色 `#FD7319` 附近，使用有限发光而非泛滥 bloom。
- Scene: 石墨黑透明背景，由 Hero CSS 提供最终底色和文字对比。

### Asset outputs

- `site/assets-src/3d/build_pulse_core.py`: 可重复生成模型、材质、相机、预览和导出物。
- `site/assets-src/3d/gitpulse-pulse-core.blend`: 可继续编辑的 Blender 源文件。
- `site/assets-src/3d/gitpulse-pulse-core.glb`: Web 运行时资产，目标不超过 1–1.5 MB。
- `site/assets-src/3d/gitpulse-pulse-core.webp`: 透明或深色背景静态回退图。
- `site/scripts/sync-assets.mjs` 将 GLB/WebP 同步到被忽略的 `site/public/assets/`。

## Page Composition

Hero 仍是首屏的单一全宽场景，不创建模型卡片：

```text
fixed header
┌────────────────────────────────────────────────────────────┐
│  GitPulse copy + CTA          full-bleed 3D Pulse Core     │
│  facts remain readable        (off-center right)           │
│                                         subtle scene cue    │
└────────────────────────────────────────────────────────────┘
next workflow section remains visible at viewport edge
```

Layer order:

1. Hero graphite background and static poster.
2. Three.js canvas, full inset, `aria-hidden="true"`.
3. Directional scrim for copy contrast; no decorative grid texture.
4. Existing Hero content, CTA, facts and progress meter.
5. Fixed site header.

Desktop camera places the model in the right 45–50% of the viewport. Tablet camera reduces scale and shifts farther right. Mobile keeps the canvas active at lower quality when WebGL is available, moves the model upward/right, and uses a stronger bottom scrim so copy remains readable.

## Runtime Architecture

### Files and boundaries

- `HomePage.astro`: emits the scene container/canvas/poster and data attributes containing base-aware model URLs.
- `hero-scene.ts`: owns Three.js setup, loading, render loop, input, raycasting, responsive camera, pause/resume, disposal and fallback state.
- `site-motion.ts`: continues to own GSAP page/scroll animation and removes only the obsolete Hero video transform.
- `home.css` / `motion.css` / `responsive.css`: own scene layering, ready/fallback transitions, stable canvas dimensions and responsive positioning.
- `content.ts`: unchanged unless accessible fallback text requires a localized string; the canvas itself remains decorative.

### Initialization flow

```text
HTML + poster visible
  -> capability check (WebGL, reduced motion, save-data)
  -> import/init Three.js scene
  -> load GLB from data-model-url
  -> validate required named objects
  -> render first frame
  -> set data-scene-state="ready" and crossfade canvas over poster
  -> run loop only while Hero is visible and document is active
```

Any failure sets `data-scene-state="fallback"`, leaves the poster visible, and must not reject globally or hide content.

### Renderer and camera

- `WebGLRenderer({ alpha: true, antialias: desktopOnly })` with transparent clear color.
- Pixel ratio capped at `1.5` desktop and `1` on narrow/coarse-pointer devices.
- Perspective camera with responsive position/FOV; model remains framed by measuring its bounding box after load.
- No post-processing pipeline in the first release. Lighting uses a hemisphere/key/rim setup created in JavaScript.
- `ResizeObserver` updates renderer size and camera aspect without resizing layout.

### Lifecycle and performance

- `IntersectionObserver` pauses `requestAnimationFrame` when Hero leaves the viewport.
- `visibilitychange` pauses background rendering in inactive tabs.
- `pagehide` disposes geometries, materials, textures and the WebGL renderer.
- Static poster remains the first painted visual; canvas never controls content visibility.
- Existing lower-page demo video changes from `preload="metadata"` to `preload="none"` so GLB has priority.

## Interaction Contract

- Idle: very small sine-based pitch/yaw drift, not continuous full rotation.
- Pointer parallax: target rotation limited to roughly ±6 degrees; damping prevents abrupt motion.
- Drag: pointer capture rotates within fixed yaw/pitch limits; vertical page scrolling remains available on touch devices.
- Hover: raycast only the three named node meshes and their child geometry; cursor change and local emissive lift indicate affordance.
- Click/tap: trigger a bounded pulse timeline that brightens Waveform, then nodes in sequence, and restores base emissive values.
- Repeated input restarts or coalesces the existing pulse; it must not accumulate timelines or material intensity.
- Keyboard: the scene is decorative, so it is not placed in the tab order and does not replace any command. CTA remain normal anchors above the canvas.

## Fallback and Accessibility

- `prefers-reduced-motion: reduce`: do not initialize continuous motion; show the static poster.
- `navigator.connection.saveData === true`: show poster to avoid downloading GLB.
- WebGL/context/model/object-contract failure: keep poster and copy, record state in a data attribute for diagnostics/tests.
- Hero content is server-rendered and visible before JavaScript; no loading gate or blank splash screen.
- Canvas has no accessible name and is `aria-hidden`; poster uses empty alt because it duplicates the visible GitPulse branding.
- Scrim and text colors must maintain WCAG contrast; hover is never the only way to access a user action.

## Compatibility and Deployment

- Asset URLs come from Astro's `BASE_URL` through the existing `asset()` helper/data attributes, preserving `/GitPulse/` deployment.
- Model sources live under `site/assets-src/`, so GitHub Pages' existing `site/**` path trigger covers future updates without changing CI.
- Add `three` to `site/package.json` and its lockfile. Add TypeScript types only if the selected Three.js release does not ship sufficient declarations.
- No changes to the React/Tauri desktop application or Rust layer.

## Verification Design

- Build: `npm run build` from `site/`.
- Visual: Playwright/Chromium screenshots for 1440x900, 1024x768, 390x844 and 320x900 in Chinese and at least one English desktop route.
- Canvas: draw the visible WebGL canvas into a small 2D probe canvas and verify nontransparent pixel count and luminance variance after `data-scene-state="ready"`.
- Framing: assert canvas/hero bounds, no horizontal overflow, CTA visible, model canvas nonblank, and next section edge visible.
- Motion: emulate reduced motion and verify fallback poster, no running scene state and visible CTA.
- Failure: block the GLB request or disable WebGL and verify `fallback` state and visible poster/copy.
- Assets: report tracked GLB/WebP sizes and confirm Hero no longer contains an autoplay video.

## Trade-offs

- Deterministic Blender geometry costs more initial setup than image-to-3D, but preserves brand fidelity and is easier to optimize.
- A custom interaction controller is narrower than OrbitControls and avoids unrestricted camera motion that could break composition.
- Skipping bloom/post-processing reduces spectacle slightly but materially improves mobile performance and avoids a generic neon aesthetic.
- Keeping 3D inside Hero limits narrative continuity but establishes a measurable, reversible first release.

## Rollback

Hero retains a complete poster and content path. If WebGL causes production issues, disable scene initialization and keep the new static composition without reverting the rest of the page. Full rollback is limited to the Hero markup/style/script import, Three.js dependency, synchronized 3D assets and obsolete video-specific GSAP code.
