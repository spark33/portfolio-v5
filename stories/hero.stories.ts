import type { Meta, StoryObj } from "@storybook/html-vite";

import { BEAT, mountHero } from "../src/figures/hero/index.ts";
import type { HeroHandle, HeroOptions } from "../src/figures/hero/index.ts";

/**
 * The hero sequence.
 *
 *   박상현 → ㅂㅏㄱ ㅅㅏㅇ ㅎㅕㄴ → PARK SANGHYEON → SEAN PARK
 *
 * `Scrub` is the working view; `Sequence` plays it on the beats. Both drive
 * the same timeline, so what gets tuned on the slider is what plays.
 */
const meta: Meta = {
  title: "Figures/Hero",
  parameters: { layout: "fullscreen", backgrounds: { disable: true } },
};

export default meta;

// Storybook re-runs render on every arg change and never signals unmount, so a
// detached host is the only unmount signal there is.
const live = new Set<{ host: HTMLElement; handle: HeroHandle }>();

function sweep() {
  for (const entry of live) {
    if (!entry.host.isConnected) {
      entry.handle.dispose();
      live.delete(entry);
    }
  }
}

function stage(): { root: HTMLElement; canvasHost: HTMLElement } {
  const root = document.createElement("div");
  root.style.cssText =
    "position:relative;min-height:100vh;background:#07080a;color:#e8e6e3;" +
    "font-family:Newsreader,Georgia,serif";

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:relative;width:100%;height:74vh;min-height:420px";
  root.append(canvasHost);

  return { root, canvasHost };
}

/**
 * The copy beneath the hero.
 *
 * Real DOM, outside the canvas, and the reason the canvas is allowed to be
 * decorative: with WebGL off this block is the entire content of the hero —
 * in the document, selectable, in the accessibility tree. Nothing here is ever
 * drawn as a texture.
 */
function copy(): HTMLElement {
  const el = document.createElement("div");
  el.dataset.heroCopy = "";
  el.style.cssText =
    "max-width:42rem;margin:0 auto;padding:2.5rem 1.5rem 4rem;" +
    "opacity:0;transition:opacity 700ms ease-out";
  el.innerHTML = `
    <h1 style="font-size:2rem;font-weight:600;margin:0 0 .75rem;letter-spacing:-.01em">
      Sean Park
      <span lang="ko" style="opacity:.55;font-weight:400">박상현</span>
    </h1>
    <p style="font-size:1.15rem;line-height:1.6;margin:0 0 1rem;color:#b9b5b0">
      Engineer. Realtime systems, inference pipelines, and the interfaces that
      make them legible.
    </p>
    <p style="font-size:1rem;line-height:1.6;margin:0;color:#8d8985">
      박상현 romanises to <i>Park Sanghyeon</i>. Sean is the name I go by — chosen,
      not derived, which is why the sequence above stops transliterating and
      starts over.
    </p>
  `;
  return el;
}

function mount(host: HTMLElement, options: HeroOptions): HeroHandle {
  sweep();
  const handle = mountHero(host, options);
  live.add({ host, handle });
  return handle;
}

// One host across re-renders: a slider drag is dozens of renders, and a WebGL
// context per render exhausts the browser's limit in seconds.
let scrubHost: HTMLElement | null = null;
let scrubHandle: HeroHandle | null = null;

/**
 * The working view. Drag through the whole 9.5s.
 *
 * Stage boundaries, for reference while scrubbing:
 *   0.00–0.27  composed 박상현, camera drifting
 *   0.27–0.43  blocks separate along z, each turning a few degrees
 *   0.43–0.63  decomposition — jamo leave their blocks into a line
 *   0.63–0.82  transliteration — ㄱ splits to R and K, ㅇ to N and G, ㅕ to Y E O
 *   0.82–0.94  reduction — SANGHYEON recedes, SEAN arrives
 *   0.94–1.00  camera pulls back, copy fades in
 */
export const Scrub: StoryObj = {
  args: { progress: 0 },
  argTypes: {
    progress: {
      control: { type: "range", min: 0, max: 1, step: 0.001 },
      description: "Seeks the sequence. 0 = 박상현, 1 = SEAN PARK.",
    },
  },

  render: (args) => {
    const { root, canvasHost } = stage();
    canvasHost.remove();

    if (!scrubHost) {
      scrubHost = canvasHost;
      scrubHost.style.height = "80vh";
      scrubHandle = mount(scrubHost, { autoplay: false });
    }
    root.prepend(scrubHost);

    const progress = Number(args.progress ?? 0);
    scrubHandle?.scrub(progress);

    const readout = document.createElement("p");
    readout.style.cssText =
      'margin:0;padding:1rem;font-family:"IBM Plex Mono",monospace;font-size:.8rem;' +
      "color:#8d8985;text-align:center";
    readout.textContent = `${(progress * BEAT.end).toFixed(2)}s / ${BEAT.end}s`;
    root.append(readout);

    return root;
  },
};

/** The sequence on its beats, with the copy fading in beneath it. */
export const Sequence: StoryObj = {
  render: () => {
    const { root, canvasHost } = stage();
    const text = copy();
    root.append(text);

    const replay = document.createElement("button");
    replay.textContent = "Replay";
    replay.style.cssText =
      "position:absolute;top:1rem;right:1rem;z-index:1;background:#16161a;color:#e8e6e3;" +
      "border:1px solid #2c2c33;border-radius:4px;padding:.4rem .8rem;font:inherit;" +
      "font-size:.85rem;cursor:pointer";
    root.append(replay);

    const handle = mount(canvasHost, {
      autoplay: true,
      onProgress: (seconds) => {
        // DOM opacity on the sequence's own clock — never anything inside the
        // canvas.
        text.style.opacity = seconds >= BEAT.reduce ? "1" : "0";
      },
    });

    replay.addEventListener("click", () => handle.play());

    return root;
  },
};

/**
 * The low-power path: no shadows, a lower pixel-ratio ceiling.
 *
 * Same sequence and same geometry — this is the branch a mid-range phone takes,
 * mounted explicitly so the difference can be judged rather than assumed.
 */
export const LowPower: StoryObj = {
  render: () => {
    const { root, canvasHost } = stage();
    root.append(copy());
    mount(canvasHost, { autoplay: true, lowPower: true });
    return root;
  },
};

/**
 * What a `prefers-reduced-motion: reduce` visitor gets: the final state as one
 * static frame, with the render loop never started.
 *
 * Storybook cannot fake the media query, so this only shows the real thing when
 * the OS setting is on. `tests/hero.spec.ts` asserts it properly, where the
 * preference can be set at the browser level.
 */
export const ReducedMotion: StoryObj = {
  render: () => {
    const { root, canvasHost } = stage();
    const text = copy();
    text.style.opacity = "1";
    root.append(text);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const note = document.createElement("p");
      note.style.cssText =
        "position:absolute;top:0;left:0;right:0;margin:1rem;padding:.75rem 1rem;" +
        "background:#16161a;border:1px solid #2c2c33;border-radius:4px;" +
        'font-family:"IBM Plex Mono",monospace;font-size:.8rem;color:#b9b5b0';
      note.textContent =
        "Enable “reduce motion” in your OS to see this story's real state. " +
        "The scene below is running normally.";
      root.append(note);
    }

    mount(canvasHost, { autoplay: false, reducedMotionState: "final" });
    return root;
  },
};
