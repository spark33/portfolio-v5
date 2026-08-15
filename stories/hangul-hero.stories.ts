import type { Meta, StoryObj } from "@storybook/html-vite";

import { mountHangulHero } from "../src/figures/hangul-hero/index.ts";
import type { HeroHandle, HeroOptions } from "../src/figures/hangul-hero/index.ts";

/**
 * The hero for `/`: 박상현 as extruded 3D type, decomposed into its nine jamo
 * and reassembled as "Sean Park".
 *
 * `Decomposition` is the one that matters. It exposes the transform on a
 * 0 → 1 slider with no timing, no camera work and no sequence around it, which
 * is the only way to tell whether the motion reads as parts moving or as a
 * crossfade wearing a costume. `Sequence` plays the same timeline on the
 * brief's beats; if something looks wrong there, it is wrong here first.
 */
const meta: Meta = {
  title: "Figures/Hangul Hero",
  parameters: {
    layout: "fullscreen",
    // The scene sets its own near-black; the Storybook chrome around it should
    // not fight that with a white page.
    backgrounds: { disable: true },
  },
};

export default meta;

// ---------------------------------------------------------------------------
// Context lifecycle
// ---------------------------------------------------------------------------

/**
 * Storybook's HTML renderer has no unmount hook — it empties the container and
 * calls `render` again. A WebGL scene needs to know about that, because
 * browsers cap live contexts at around sixteen and a story that mounts one per
 * render exhausts them in a few clicks.
 *
 * So: every mount is registered here, and each render first disposes any
 * handle whose host has been detached from the document. Being detached is the
 * unmount signal Storybook does not send.
 */
const mounted = new Set<{ host: HTMLElement; handle: HeroHandle }>();

function sweep() {
  for (const entry of mounted) {
    if (!entry.host.isConnected) {
      entry.handle.dispose();
      mounted.delete(entry);
    }
  }
}

function mount(host: HTMLElement, options: HeroOptions): HeroHandle {
  sweep();
  const handle = mountHangulHero(host, options);
  mounted.add({ host, handle });
  return handle;
}

/**
 * A host that survives re-renders, for the scrub story.
 *
 * Storybook re-runs `render` on every arg change, so a slider drag is dozens
 * of renders. Keeping one host element at module scope and moving it into each
 * new wrapper preserves the context and the built geometry across all of them
 * — only the seek is repeated, which is the whole point of scrubbing.
 */
let scrubHost: HTMLElement | null = null;
let scrubHandle: HeroHandle | null = null;

// ---------------------------------------------------------------------------
// Shared furniture
// ---------------------------------------------------------------------------

function stage(): { root: HTMLElement; canvasHost: HTMLElement } {
  const root = document.createElement("div");
  root.style.cssText = `
    position: relative;
    min-height: 100vh;
    background: #08080a;
    color: #e8e6e3;
    font-family: Newsreader, Georgia, serif;
  `;

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:relative;width:100%;height:68vh;min-height:380px";
  root.append(canvasHost);

  return { root, canvasHost };
}

/**
 * The copy that sits under the hero on the real page.
 *
 * Ordinary DOM, outside the canvas, and the reason the canvas is allowed to be
 * decorative: with WebGL off this block is still the entire content of the
 * hero — in the document, selectable, and in the accessibility tree. Nothing
 * here is ever drawn as a texture.
 */
function copy(): HTMLElement {
  const el = document.createElement("div");
  el.dataset.heroCopy = "";
  el.style.cssText = `
    max-width: 42rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    opacity: 0;
    transition: opacity 600ms ease-out;
  `;
  el.innerHTML = `
    <h1 style="font-size:2rem;font-weight:600;margin:0 0 .75rem;letter-spacing:-.01em">
      Sean Park <span lang="ko" style="opacity:.55;font-weight:400">박상현</span>
    </h1>
    <p style="font-size:1.15rem;line-height:1.6;margin:0 0 1rem;color:#b9b5b0">
      Engineer. Realtime systems, inference pipelines, and the interfaces that
      make them legible.
    </p>
    <p style="font-size:1rem;line-height:1.6;margin:0;color:#8d8985">
      Currently at Mindlogic, working on latency in speech pipelines.
    </p>
  `;
  return el;
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * The gate. Drag the slider and watch the nine jamo leave their blocks and
 * arrive as eight letters.
 *
 * What to check, in order:
 * 1. At 0, 박상현 reads as three square blocks — not as nine jamo parked near
 *    each other. If the blocks are not convincing, the cells in `layout.ts`
 *    are wrong and nothing downstream will save it.
 * 2. Through the middle it stays *one* connected mark. Islands drifting apart
 *    mean the gather or the smooth-union radius has gone too low; shapeless
 *    puddles mean the radius has gone too high, past a stroke width.
 * 3. Outlines change late and together. A letter arriving fully formed while
 *    its neighbours are still jamo reads as a glitch.
 * 4. At 1, "Sean Park" is undistorted — the Latin is set from real advance
 *    widths and must not look stretched by the morph that produced it.
 * 5. ㅇ closes on the "a" of "Sean" in the last third and stays as the ring in
 *    its bowl. It should look aimed, not dropped.
 */
export const Decomposition: StoryObj = {
  args: { progress: 0 },
  argTypes: {
    progress: {
      control: { type: "range", min: 0, max: 1, step: 0.001 },
      description: "Scrubs the transform. 0 = composed 박상현, 1 = resolved Sean Park.",
    },
  },

  render: (args) => {
    const { root, canvasHost } = stage();
    canvasHost.remove();
    canvasHost.style.height = "78vh";

    if (!scrubHost) {
      scrubHost = canvasHost;
      scrubHandle = mount(scrubHost, { autoplay: false });
    }
    // Moves the surviving host — and its live context — into this render's
    // wrapper.
    root.prepend(scrubHost);

    const readout = document.createElement("p");
    readout.style.cssText = `
      margin: 0; padding: 1rem 1.5rem; font-family: "IBM Plex Mono", monospace;
      font-size: .8rem; color: #8d8985; text-align: center;
    `;
    root.append(readout);

    const progress = Number(args.progress ?? 0);
    scrubHandle?.scrub(progress);
    readout.textContent = `progress ${progress.toFixed(3)}`;

    return root;
  },
};

/** The full timed sequence on the brief's beats, with the copy fading in
 *  beneath it at 10s. Replays on click. */
export const Sequence: StoryObj = {
  render: () => {
    const { root, canvasHost } = stage();
    const text = copy();
    root.append(text);

    const replay = document.createElement("button");
    replay.textContent = "Replay";
    replay.style.cssText = `
      position: absolute; top: 1rem; right: 1rem; z-index: 1;
      background: #16161a; color: #e8e6e3; border: 1px solid #2c2c33;
      border-radius: 4px; padding: .4rem .8rem; font: inherit; font-size: .85rem;
      cursor: pointer;
    `;
    root.append(replay);

    const handle = mount(canvasHost, {
      autoplay: true,
      onProgress: (p) => {
        // Fades once the mark has settled — DOM opacity, not anything inside
        // the canvas.
        text.style.opacity = p > 0.8 ? "1" : "0";
      },
    });

    replay.addEventListener("click", () => handle.play());

    return root;
  },
};

/**
 * What a `prefers-reduced-motion: reduce` visitor gets: one frame, no loop.
 *
 * Storybook cannot fake the media query, so this story only shows the real
 * thing when the OS setting is on; with it off you get the note instead.
 *
 * Not covered by a test yet. `tests/hangul-hero.spec.ts` asserts the layout
 * and atlas without a browser, and the Playwright config drives the site
 * preview rather than Storybook — so there is nowhere to assert this until the
 * hero is mounted on a real page. Verify it by hand until then.
 */
export const ReducedMotion: StoryObj = {
  render: () => {
    const { root, canvasHost } = stage();
    const text = copy();
    text.style.opacity = "1";
    root.append(text);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const note = document.createElement("p");
      note.style.cssText = `
        position:absolute; top:0; left:0; right:0; margin:1rem; padding:.75rem 1rem;
        background:#16161a; border:1px solid #2c2c33; border-radius:4px;
        font-family:"IBM Plex Mono",monospace; font-size:.8rem; color:#b9b5b0;
      `;
      note.textContent =
        "Enable “reduce motion” in your OS to see this story's real state. " +
        "The scene below is running normally.";
      root.append(note);
    }

    mount(canvasHost, { autoplay: false, reducedMotionState: "resolved" });

    return root;
  },
};
