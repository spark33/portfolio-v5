import type { Meta, StoryObj } from "@storybook/html-vite";

import { DURATION, mountLoader } from "../src/loader/index.ts";
import type { LoaderHandle } from "../src/loader/index.ts";

/**
 * The loading animation: 박상현 resolves into Sean Park, in just over a second.
 *
 * `Frame` is the working view — it seeks a single frame, so the motion can be
 * judged one moment at a time. `npm run film` drives that same story to build
 * a filmstrip. `Playing` is the real thing.
 */
const meta: Meta = {
  title: "Loader",
  parameters: { layout: "fullscreen", backgrounds: { disable: true } },
};

export default meta;

// Storybook re-runs render on every arg change and never signals unmount, so a
// detached host is the only unmount signal there is.
const live = new Set<{ host: HTMLElement; handle: LoaderHandle }>();

function sweep() {
  for (const entry of live) {
    if (!entry.host.isConnected) {
      entry.handle.dispose();
      live.delete(entry);
    }
  }
}

/**
 * The site's own tokens, set on the stage rather than inherited.
 *
 * The loader takes every colour from `currentColor` and `--accent`, and
 * `--accent` is deliberately a different value on each ground — so a stage that
 * hardcodes a dark background while the document is in light mode shows the
 * animation a colour it would never actually be given.
 */
const GROUNDS = {
  dark: { "--bg": "#0a0a0f", "--fg": "#f4f4f5", "--accent": "#9aa6ff" },
  light: { "--bg": "#fcfcfb", "--fg": "#16161a", "--accent": "#3f4fc4" },
};

function stage(ground: keyof typeof GROUNDS = "dark"): { root: HTMLElement; host: HTMLElement } {
  const root = document.createElement("div");
  root.style.cssText =
    "min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg)";
  for (const [token, value] of Object.entries(GROUNDS[ground])) {
    root.style.setProperty(token, value);
  }

  const host = document.createElement("div");
  host.style.cssText = "width:min(46rem,72vw)";
  root.append(host);

  return { root, host };
}

/**
 * One frame, seeked.
 *
 * The animation is a pure function of normalised time, so this renders exactly
 * what playback renders at the same moment — no waiting, no flake, and the
 * filmstrip harness drives this same story through `window.__loader`.
 */
export const Frame: StoryObj = {
  args: { t: 0.5 },
  argTypes: {
    t: {
      control: { type: "range", min: 0, max: 1, step: 0.001 },
      description: `Normalised time. 0 → 1 spans ${DURATION}ms.`,
    },
  },

  render: (args) => {
    sweep();
    const { root, host } = stage();
    const handle = mountLoader(host, { autoplay: false, loop: false });
    live.add({ host, handle });

    handle.seek(Number(args.t ?? 0));
    // The filmstrip harness seeks through this rather than through timing,
    // which is what makes the frames deterministic.
    (window as unknown as { __loader?: LoaderHandle }).__loader = handle;

    return root;
  },
};

/** The real thing, looping. */
export const Playing: StoryObj = {
  render: () => {
    sweep();
    const { root, host } = stage();
    const handle = mountLoader(host, { autoplay: true, loop: true });
    live.add({ host, handle });
    // `npm run play` shoots this on a wall clock rather than seeking it, and
    // restarts the loop first so a strip begins where the animation does.
    (window as unknown as { __loader?: LoaderHandle }).__loader = handle;
    return root;
  },
};

/** On a light ground, to check it is not relying on the dark background. */
export const OnLight: StoryObj = {
  render: () => {
    sweep();
    const { root, host } = stage("light");
    const handle = mountLoader(host, { autoplay: true, loop: true });
    live.add({ host, handle });
    return root;
  },
};

/** Small, to check the silhouette survives — a loader is often 200px wide. */
export const Small: StoryObj = {
  render: () => {
    sweep();
    const { root, host } = stage();
    host.style.width = "13rem";
    const handle = mountLoader(host, { autoplay: true, loop: true });
    live.add({ host, handle });
    return root;
  },
};
