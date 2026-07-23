import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";


const NODE_NAMES = ["GitNodeTop", "GitNodeLeft", "GitNodeBottom"] as const;
const BASE_ROTATION = new THREE.Euler(-Math.PI / 2 + 0.16, -0.18, -0.045);
const POINTER_LIMIT = THREE.MathUtils.degToRad(6);
const DRAG_LIMIT_X = THREE.MathUtils.degToRad(11);
const DRAG_LIMIT_Y = THREE.MathUtils.degToRad(22);

type PulseMaterial = THREE.MeshStandardMaterial & { userData: { baseEmissive?: number } };

type DragState = {
  active: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  startPitch: number;
  startYaw: number;
};

class HeroScene {
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(4, 4);
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private readonly drag: DragState = {
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startPitch: 0,
    startYaw: 0,
  };

  private model: THREE.Group | null = null;
  private waveform: PulseMaterial | null = null;
  private nodes: THREE.Mesh[] = [];
  private hoveredNode: THREE.Mesh | null = null;
  private frameId = 0;
  private visible = true;
  private disposed = false;
  private pulseStartedAt = 0;
  private targetPitch = 0;
  private targetYaw = 0;
  private currentPitch = 0;
  private currentYaw = 0;
  private lastFrameAt = 0;

  constructor(host: HTMLElement, canvas: HTMLCanvasElement) {
    this.host = host;
    this.canvas = canvas;
    this.renderer = this.createRenderer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.visibilityObserver = new IntersectionObserver(([entry]) => this.setVisible(entry?.isIntersecting ?? false), { threshold: 0.05 });
  }

  async initialize(modelUrl: string): Promise<void> {
    this.configureScene();
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    this.bindModel(gltf.scene);
    this.bindEvents();
    this.resizeObserver.observe(this.host);
    this.visibilityObserver.observe(this.host);
    this.resize();
    this.renderFrame();
    this.host.dataset.sceneState = "ready";
    this.host.dataset.interactionState = "idle";
    this.start();
  }

  fail(): void {
    this.host.dataset.sceneState = "fallback";
    this.dispose();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const antialias = !window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    return renderer;
  }

  private configureScene(): void {
    this.camera.position.set(0, 0, 7.2);
    this.scene.add(new THREE.HemisphereLight(0xdff7f6, 0x07100c, 1.9));
    const key = new THREE.DirectionalLight(0xf2fbff, 3.6);
    key.position.set(4, -3, 6);
    this.scene.add(key);
    const cyan = new THREE.PointLight(0x01a3b0, 16, 12, 2);
    cyan.position.set(-4, 2.2, 3.6);
    this.scene.add(cyan);
    const orange = new THREE.PointLight(0xfd7319, 11, 10, 2);
    orange.position.set(3.4, 2.4, 2.6);
    this.scene.add(orange);
  }

  private bindModel(scene: THREE.Group): void {
    const waveform = requireMesh(scene, "Waveform");
    const nodes = NODE_NAMES.map((name) => requireMesh(scene, name));
    normalizeModel(scene);
    const pivot = new THREE.Group();
    pivot.name = "PulseCorePivot";
    pivot.add(scene);
    this.model = pivot;
    this.waveform = clonePulseMaterial(waveform);
    this.nodes = nodes;
    nodes.forEach((node) => clonePulseMaterial(node));
    this.scene.add(pivot);
    this.applyResponsiveLayout();
  }

  private bindEvents(): void {
    this.host.addEventListener("pointermove", this.handlePointerMove);
    this.host.addEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pagehide", this.dispose, { once: true });
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const bounds = this.host.getBoundingClientRect();
    const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const normalizedY = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    this.pointer.set(normalizedX, normalizedY);
    if (this.drag.active) this.updateDrag(event);
    else this.updateParallax(normalizedX, normalizedY);
    this.updateHoveredNode();
  };

  private handlePointerLeave = (): void => {
    if (!this.drag.active) {
      this.targetPitch = 0;
      this.targetYaw = 0;
    }
    this.pointer.set(4, 4);
    this.setHoveredNode(null);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    this.drag.active = true;
    this.drag.moved = false;
    this.drag.startX = event.clientX;
    this.drag.startY = event.clientY;
    this.drag.startPitch = this.targetPitch;
    this.drag.startYaw = this.targetYaw;
    this.host.dataset.interactionState = "dragging";
    this.canvas.setPointerCapture(event.pointerId);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const shouldPulse = !this.drag.active || !this.drag.moved;
    this.finishDrag(event.pointerId);
    if (shouldPulse) this.triggerPulse();
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    this.finishDrag(event.pointerId);
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private updateParallax(x: number, y: number): void {
    this.targetYaw = THREE.MathUtils.clamp(x * POINTER_LIMIT, -POINTER_LIMIT, POINTER_LIMIT);
    this.targetPitch = THREE.MathUtils.clamp(-y * POINTER_LIMIT * 0.65, -POINTER_LIMIT, POINTER_LIMIT);
  }

  private updateDrag(event: PointerEvent): void {
    const deltaX = event.clientX - this.drag.startX;
    const deltaY = event.clientY - this.drag.startY;
    this.drag.moved ||= Math.hypot(deltaX, deltaY) > 6;
    this.targetYaw = THREE.MathUtils.clamp(this.drag.startYaw + deltaX * 0.005, -DRAG_LIMIT_Y, DRAG_LIMIT_Y);
    this.targetPitch = THREE.MathUtils.clamp(this.drag.startPitch + deltaY * 0.004, -DRAG_LIMIT_X, DRAG_LIMIT_X);
  }

  private finishDrag(pointerId: number): void {
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    this.drag.active = false;
    this.host.dataset.interactionState = this.hoveredNode ? "hover" : "idle";
  }

  private updateHoveredNode(): void {
    if (!this.model || this.drag.active) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.nodes, true)[0]?.object ?? null;
    const node = hit ? findNodeOwner(hit, this.nodes) : null;
    this.setHoveredNode(node);
  }

  private setHoveredNode(node: THREE.Mesh | null): void {
    if (this.hoveredNode === node) return;
    if (this.hoveredNode) setMeshIntensity(this.hoveredNode, baseIntensity(this.hoveredNode));
    this.hoveredNode = node;
    if (node) setMeshIntensity(node, baseIntensity(node) + 0.85);
    this.canvas.classList.toggle("is-node-hovered", Boolean(node));
    if (!this.drag.active && !this.pulseStartedAt) this.host.dataset.interactionState = node ? "hover" : "idle";
  }

  private triggerPulse(): void {
    this.pulseStartedAt = performance.now();
    this.host.dataset.interactionState = "pulse";
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const narrow = width < 700 || window.matchMedia("(pointer: coarse)").matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow ? 1 : 1.5));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyResponsiveLayout();
    this.renderFrame();
  }

  private applyResponsiveLayout(): void {
    if (!this.model) return;
    const width = this.host.clientWidth;
    if (width < 620) this.setModelTransform(0.75, 1.78, 0.32);
    else if (width < 921) this.setModelTransform(0.98, 0.72, 0.58);
    else if (width < 1180) this.setModelTransform(2.5, 0.08, 0.52);
    else this.setModelTransform(1.95, 0.05, 0.72);
  }

  private setModelTransform(x: number, y: number, scale: number): void {
    if (!this.model) return;
    this.model.position.set(x, y, 0);
    this.model.scale.setScalar(scale);
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.start();
    else this.stop();
  }

  private start(): void {
    if (this.frameId || !this.visible || document.hidden || this.disposed || !this.model) return;
    this.lastFrameAt = performance.now();
    this.frameId = requestAnimationFrame(this.animate);
  }

  private stop(): void {
    if (!this.frameId) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  private animate = (time: number): void => {
    this.frameId = 0;
    if (!this.model || this.disposed) return;
    const delta = Math.min((time - this.lastFrameAt) / 1000, 0.05);
    this.lastFrameAt = time;
    this.currentPitch = THREE.MathUtils.damp(this.currentPitch, this.targetPitch, 6, delta);
    this.currentYaw = THREE.MathUtils.damp(this.currentYaw, this.targetYaw, 6, delta);
    const idle = Math.sin(time * 0.00045) * 0.018;
    this.model.rotation.set(BASE_ROTATION.x + this.currentPitch + idle, BASE_ROTATION.y + this.currentYaw, BASE_ROTATION.z + idle * 0.35);
    this.updatePulse(time);
    this.renderFrame();
    this.start();
  };

  private updatePulse(time: number): void {
    if (!this.pulseStartedAt || !this.waveform) return;
    const elapsed = time - this.pulseStartedAt;
    const progress = elapsed / 1450;
    const waveLift = Math.sin(Math.min(progress, 1) * Math.PI) * 2.1;
    this.waveform.emissiveIntensity = (this.waveform.userData.baseEmissive ?? 1) + waveLift;
    this.nodes.forEach((node, index) => this.updateNodePulse(node, elapsed - 260 - index * 190));
    if (progress < 1) return;
    this.pulseStartedAt = 0;
    this.waveform.emissiveIntensity = this.waveform.userData.baseEmissive ?? 1;
    this.nodes.forEach((node) => setMeshIntensity(node, baseIntensity(node) + (node === this.hoveredNode ? 0.85 : 0)));
    this.host.dataset.interactionState = this.hoveredNode ? "hover" : "idle";
  }

  private updateNodePulse(node: THREE.Mesh, elapsed: number): void {
    if (elapsed <= 0 || elapsed >= 520 || node === this.hoveredNode) return;
    const lift = Math.sin((elapsed / 520) * Math.PI) * 1.8;
    setMeshIntensity(node, baseIntensity(node) + lift);
    if (elapsed > 500) setMeshIntensity(node, baseIntensity(node));
  }

  private renderFrame(): void {
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
  }

  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.host.removeEventListener("pointermove", this.handlePointerMove);
    this.host.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    disposeScene(this.scene);
    this.renderer.dispose();
  };
}

function requireMesh(scene: THREE.Object3D, name: string): THREE.Mesh {
  const object = scene.getObjectByName(name);
  if (!(object instanceof THREE.Mesh)) throw new Error(`Pulse Core is missing mesh: ${name}`);
  return object;
}

function normalizeModel(model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
}

function clonePulseMaterial(mesh: THREE.Mesh): PulseMaterial {
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error(`Pulse Core mesh has unsupported material: ${mesh.name}`);
  const material = source.clone() as PulseMaterial;
  material.userData.baseEmissive = material.emissiveIntensity;
  mesh.material = material;
  return material;
}

function findNodeOwner(object: THREE.Object3D, nodes: THREE.Mesh[]): THREE.Mesh | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const match = nodes.find((node) => node === current);
    if (match) return match;
    current = current.parent;
  }
  return null;
}

function getPulseMaterial(mesh: THREE.Mesh): PulseMaterial | null {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return material instanceof THREE.MeshStandardMaterial ? material as PulseMaterial : null;
}

function baseIntensity(mesh: THREE.Mesh): number {
  return getPulseMaterial(mesh)?.userData.baseEmissive ?? 1;
}

function setMeshIntensity(mesh: THREE.Mesh, intensity: number): void {
  const material = getPulseMaterial(mesh);
  if (material) material.emissiveIntensity = intensity;
}

function disposeScene(scene: THREE.Scene): void {
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  materials.forEach((material) => material.dispose());
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function prefersStaticScene(): boolean {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return reduced || connection?.saveData === true || !supportsWebGl();
}

async function mountHeroScene(): Promise<void> {
  const host = document.querySelector<HTMLElement>("[data-hero-scene]");
  const canvas = host?.querySelector<HTMLCanvasElement>("[data-hero-canvas]");
  const modelUrl = host?.dataset.modelUrl;
  if (!host || !canvas || !modelUrl) return;
  if (prefersStaticScene()) {
    host.dataset.sceneState = "fallback";
    return;
  }
  let heroScene: HeroScene | null = null;
  try {
    heroScene = new HeroScene(host, canvas);
    await heroScene.initialize(modelUrl);
  } catch (error) {
    console.warn("GitPulse Hero scene fallback:", error);
    if (heroScene) heroScene.fail();
    else host.dataset.sceneState = "fallback";
  }
}

void mountHeroScene();
