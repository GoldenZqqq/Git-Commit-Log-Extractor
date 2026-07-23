import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

root.classList.add("motion-ready");

if (!prefersReducedMotion) {
  gsap.defaults({ ease: "power3.out", duration: 0.8 });

  const mm = gsap.matchMedia();

  setupHero();
  setupReveals();
  setupDemoFrame();

  mm.add(
    {
      isDesktop: "(min-width: 921px)",
      isMobile: "(max-width: 920px)",
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      if (context.conditions?.reduceMotion) return;
      setupStory(Boolean(context.conditions?.isDesktop));
    },
  );

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

function setupHero() {
  gsap.from(".site-header", { y: -24, autoAlpha: 0, duration: 0.7 });
  gsap.from("[data-hero-copy] > *", {
    y: 38,
    autoAlpha: 0,
    duration: 0.9,
    stagger: 0.08,
  });
  gsap.from("[data-hero-fact]", {
    y: 24,
    autoAlpha: 0,
    duration: 0.7,
    stagger: 0.08,
    delay: 0.35,
  });
  gsap.to("[data-hero-meter]", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: {
      trigger: "[data-hero]",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
}

function setupStory(pinStory: boolean) {
  const story = document.querySelector<HTMLElement>("[data-story]");
  const steps = gsap.utils.toArray<HTMLElement>("[data-story-step]");
  const nodes = gsap.utils.toArray<HTMLElement>("[data-repo-node]");
  const chips = gsap.utils.toArray<HTMLElement>("[data-commit-chip]");
  const lines = gsap.utils.toArray<HTMLElement>("[data-report-line]");

  if (!story || steps.length === 0) return;

  const setActiveStep = (progress: number) => {
    const activeIndex = Math.min(steps.length - 1, Math.floor(progress * steps.length));
    steps.forEach((step, index) => step.classList.toggle("is-active", index === activeIndex));
  };

  gsap.set(steps, { autoAlpha: 0.48, y: 18 });
  gsap.set(steps[0], { autoAlpha: 1, y: 0 });
  gsap.set(nodes, { scale: 0.86, autoAlpha: 0.75 });
  gsap.set(chips, { x: -80, autoAlpha: 0, scale: 0.82 });
  gsap.set(lines, { scaleX: 0 });
  setActiveStep(0);

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: story,
      start: "top top",
      end: pinStory ? "+=2600" : "bottom bottom",
      scrub: 1,
      pin: pinStory,
      anticipatePin: 1,
      onUpdate: (self) => setActiveStep(self.progress),
    },
  });

  tl.to("[data-story-progress]", { scaleX: 1, duration: 3 }, 0)
    .to("[data-story-window]", { rotationY: -8, rotationX: 4, scale: 1.04, duration: 1 }, 0)
    .to("[data-scan-beam]", { xPercent: 520, duration: 1.15 }, 0.1)
    .to(nodes, { autoAlpha: 1, scale: 1.08, stagger: 0.08, duration: 0.8 }, 0.18)
    .to(steps[1], { autoAlpha: 1, y: 0, duration: 0.45 }, 0.88)
    .to(chips, { x: 0, autoAlpha: 1, scale: 1, stagger: 0.05, duration: 0.95 }, 0.82)
    .to("[data-story-window]", { rotationY: 6, rotationX: -2, scale: 0.98, duration: 1 }, 1.1)
    .to(steps[2], { autoAlpha: 1, y: 0, duration: 0.45 }, 1.9)
    .to("[data-report-sheet]", { y: -18, scale: 1.03, duration: 0.5 }, 1.92)
    .to(lines, { scaleX: 1, stagger: 0.08, duration: 0.7 }, 2.02)
    .to("[data-story-window]", { rotationY: 0, rotationX: 0, scale: 1, duration: 0.7 }, 2.4);
}

function setupDemoFrame() {
  gsap.fromTo(
    "[data-demo-frame]",
    { y: 90, scale: 0.9, rotationX: 8, autoAlpha: 0.65 },
    {
      y: 0,
      scale: 1,
      rotationX: 0,
      autoAlpha: 1,
      ease: "none",
      scrollTrigger: {
        trigger: "[data-demo-frame]",
        start: "top 86%",
        end: "center 48%",
        scrub: 1,
      },
    },
  );
}

function setupReveals() {
  const revealItems = gsap.utils.toArray<HTMLElement>("[data-reveal]");
  gsap.set(revealItems, { y: 34, autoAlpha: 0 });

  ScrollTrigger.batch(revealItems, {
    start: "top 86%",
    once: true,
    onEnter: (items) => {
      gsap.to(items, {
        y: 0,
        autoAlpha: 1,
        duration: 0.75,
        stagger: 0.08,
        overwrite: true,
      });
    },
  });
}
