import type { Meta, StoryObj } from "@storybook/html-vite";

const meta: Meta = {
  title: "Article",
};

export default meta;

export const Masthead: StoryObj = {
  render: () => `
    <article class="prose">
      <header class="masthead">
        <p class="meta"><time datetime="2026-03-14">14 March 2026</time> · 2 min read</p>
        <h1>Cutting transcript latency from 4.2s to 380ms</h1>
        <p class="lede">
          A realtime speech pipeline that buffered too eagerly, rebuilt around
          incremental decoding and backpressure the client could observe.
        </p>
        <ul class="tags">
          <li class="meta">realtime</li>
          <li class="meta">latency</li>
        </ul>
      </header>
    </article>
  `,
};

/** The chosen-vs-rejected pairing that carries the argument in a case study. */
export const Decision: StoryObj = {
  render: () => `
    <div class="prose">
      <div class="decision">
        <h3>Incremental decoding over smaller windows</h3>
        <p>
          We kept a long context window but emitted partial hypotheses as the decoder
          walked it, marking tokens unstable until the window closed.
        </p>
        <p class="rejected">
          Rejected: shrinking the window to 500ms. It hit the latency target and lost
          6 points of word error rate at segment boundaries.
        </p>
      </div>
    </div>
  `,
};

interface FigureArgs {
  caption: string;
  poster: string;
  showControls: boolean;
  bleed: boolean;
}

/**
 * The container every interactive figure mounts into. The box is reserved before
 * mount so nothing shifts, and the poster is what shows before it — and instead of
 * it, under reduced motion or when WebGL is unavailable.
 */
export const Figure: StoryObj<FigureArgs> = {
  args: {
    caption:
      "Drag the window size down and watch time-to-first-token fall while boundary errors rise.",
    poster: "Figure mounts here — reserved 16:10 box, poster shown until visible",
    showControls: true,
    bleed: true,
  },

  argTypes: {
    caption: { control: "text" },
    poster: { control: "text" },
    showControls: { control: "boolean" },
    bleed: { control: "boolean", description: "Break out past the text measure" },
  },

  render: ({ caption, poster, showControls, bleed }) => `
    <div class="prose">
      <figure class="figure${bleed ? " bleed" : ""}">
        <div class="figure-frame"><p class="meta">${poster}</p></div>
        ${
          showControls
            ? `<div class="controls-demo">
          <label class="meta">Window size
            <input type="range" min="200" max="3000" step="100" value="3000" />
          </label>
          <label class="meta"><input type="checkbox" /> Show boundary context</label>
        </div>`
            : ""
        }
        <figcaption><b>Figure 1.</b> ${caption}</figcaption>
      </figure>
    </div>
  `,
};
