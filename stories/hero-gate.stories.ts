import type { Meta, StoryObj } from "@storybook/html-vite";
import * as THREE from "three";

import { loadHeroGeometry } from "../src/figures/hero/geometry.ts";
import type { HeroGeometry } from "../src/figures/hero/geometry.ts";
import { createMorphMaterial } from "../src/figures/hero/material.ts";
import { createShadowCatcher, createStage } from "../src/figures/hero/stage.ts";

/**
 * The gate.
 *
 * Step 2 of the build order: two glyphs, one morph, a debug slider — and stop
 * here. If this morph is not beautiful, nothing downstream saves it, so this
 * story exists to be stared at before any sequence, timing or camera work is
 * written.
 *
 * Judge against the acceptance criteria, not against "does it work":
 *
 * 1. Freeze anywhere in the middle. Is it a legible object, or soup? A good
 *    morph is beautiful at every frame, not only at the endpoints.
 * 2. Is the bevel clean at both ends and through the middle? A bevel that
 *    thins or self-intersects means the inset's miter clamp is wrong.
 * 3. Turn the environment off. Does the form still read?
 * 4. Shrink the window to 25%. Does the silhouette still read?
 * 5. Does anything unwind or cartwheel? That is the point-rotation match
 *    failing, and it is the failure this whole pipeline is built to avoid.
 */
const meta: Meta = {
  title: "Figures/Hero Gate",
  parameters: { layout: "fullscreen", backgrounds: { disable: true } },
};

export default meta;

interface Mounted {
  host: HTMLElement;
  dispose(): void;
  set(pair: number, progress: number, spin: number): void;
}

/** Storybook re-runs render on every arg change and never signals unmount, so
 *  a detached host is the only unmount signal available. */
const live = new Set<Mounted>();

function sweep() {
  for (const entry of live) {
    if (!entry.host.isConnected) {
      entry.dispose();
      live.delete(entry);
    }
  }
}

function mount(host: HTMLElement): Mounted {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  host.append(canvas);

  const stage = createStage(canvas);
  stage.camera.position.set(0, 0, 4.4);

  const shadowCatcher = createShadowCatcher(-1.15);
  stage.scene.add(shadowCatcher);

  const { material, uniforms } = createMorphMaterial();

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.castShadow = true;
  stage.root.add(mesh);

  let loaded: HeroGeometry[] = [];
  let current = "";
  let frameId = 0;
  let disposed = false;

  loadHeroGeometry().then((geometries) => {
    if (disposed) return;
    loaded = geometries;
    apply();
    render();
  });

  let pair = 0;
  let progress = 0;
  let spin = 0;

  function apply() {
    const found = loaded.filter((g) => g.entry.kind === "morph")[pair] ?? loaded[0];
    if (!found || found.entry.name === current) return;
    mesh.geometry = found.geometry;
    current = found.entry.name;
  }

  function render() {
    uniforms.uProgress.value = progress;
    mesh.rotation.y = spin;
    stage.renderer.render(stage.scene, stage.camera);
  }

  function resize() {
    stage.resize(host.clientWidth, host.clientHeight);
    render();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const entry: Mounted = {
    host,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      for (const item of loaded) item.geometry.dispose();
      shadowCatcher.geometry.dispose();
      (shadowCatcher.material as THREE.Material).dispose();
      material.dispose();
      stage.dispose();
      canvas.remove();
    },
    set(nextPair, nextProgress, nextSpin) {
      pair = nextPair;
      progress = nextProgress;
      spin = nextSpin;
      apply();
      render();
    },
  };

  live.add(entry);
  return entry;
}

// One host, kept across re-renders: a slider drag is dozens of renders, and
// rebuilding a WebGL context per frame of that exhausts the browser's limit.
let host: HTMLElement | null = null;
let mounted: Mounted | null = null;

/**
 * Morph pairs, addressed by index rather than by name.
 *
 * Storybook round-trips args through the URL, and the jamo in a name like
 * "ㅇ-N" do not survive that — the arg silently falls back to its default and
 * the contact sheet renders the same pair nine times over while appearing to
 * vary. An integer survives.
 */
const PAIRS = [
  "ㅂ→P",
  "ㅏ→A (박)",
  "ㄱ→R",
  "ㄱ→K",
  "ㅅ→S",
  "ㅏ→A (상)",
  "ㅇ→N",
  "ㅇ→G",
  "ㅎ→H",
  "ㅕ→Y",
  "ㅕ→E",
  "ㅕ→O",
  "ㄴ→N",
];

export const OneMorph: StoryObj = {
  args: { pair: 6, progress: 0.5, spin: 0 },
  argTypes: {
    pair: {
      control: { type: "range", min: 0, max: 12, step: 1 },
      description:
        "Index of the jamo → Latin pair. 6 is ㅇ→N, the topology case: a hole that has to close.",
    },
    progress: {
      control: { type: "range", min: 0, max: 1, step: 0.001 },
      description: "0 = jamo, 1 = Latin letter.",
    },
    spin: {
      control: { type: "range", min: -1.2, max: 1.2, step: 0.01 },
      description: "Turn the glyph to check the extrusion, bevel and silhouette in the round.",
    },
  },

  render: (args) => {
    sweep();

    const root = document.createElement("div");
    root.style.cssText =
      "position:relative;min-height:100vh;background:#07080a;color:#e8e6e3;" +
      'font-family:"IBM Plex Mono",monospace';

    if (!host) {
      host = document.createElement("div");
      host.style.cssText = "position:relative;width:100%;height:82vh;min-height:420px";
      mounted = mount(host);
    }
    root.append(host);

    const readout = document.createElement("p");
    readout.style.cssText = "margin:0;padding:1rem;font-size:.8rem;color:#8d8985;text-align:center";
    readout.textContent = `${PAIRS[Number(args.pair)] ?? "?"}   progress ${Number(args.progress).toFixed(3)}   spin ${Number(args.spin).toFixed(2)}`;
    root.append(readout);

    mounted?.set(Number(args.pair), Number(args.progress), Number(args.spin));

    return root;
  },
};
