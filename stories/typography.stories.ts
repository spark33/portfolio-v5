import type { Meta, StoryObj } from "@storybook/html-vite";

const meta: Meta = {
  title: "Foundations/Typography",
};

export default meta;

/** The whole scale in one view — the fastest way to spot a broken step. */
export const Scale: StoryObj = {
  render: () => `
    <div class="prose">
      <h1>Portfolio</h1>
      <h2>Section heading</h2>
      <h3>Subheading</h3>
      <p class="lede">A lede, one step up from body copy and used once per page.</p>
      <p>Body copy at the site's default size, set to the standard measure.</p>
      <p class="meta">Meta — dates, roles, tags</p>
    </div>
  `,
};

/** Every construct markdown can emit, so the stylesheet can be checked at once. */
export const Prose: StoryObj = {
  render: () => `
    <article class="prose">
      <h2>The problem</h2>
      <p>
        The pipeline transcribed audio in fixed three-second windows, so nobody saw a
        word until the window closed. Inline literals like <code>lag_ms</code> sit in
        the text without breaking the rhythm.
      </p>
      <blockquote><p>A blockquote, used for asides and caveats.</p></blockquote>
      <ul>
        <li>An unordered list item</li>
        <li>Another, long enough to wrap onto a second line and show its leading</li>
      </ul>
      <ol>
        <li>An ordered list item</li>
        <li>A second one</li>
      </ol>
      <pre><code>stream.on("hypothesis", ({ tokens, lagMs }) =&gt; {
  transcript.merge(tokens, { stable: false });
});</code></pre>
      <table>
        <thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead>
        <tbody>
          <tr><td>Time to first token</td><td>4.2s</td><td>380ms</td></tr>
          <tr><td>p99</td><td>9.8s</td><td>1.1s</td></tr>
        </tbody>
      </table>
      <p><a href="#">A link in running text</a>, then more text after it.</p>
    </article>
  `,
};

/** Numerals carry most of the weight in engineering writing. */
export const Numerals: StoryObj = {
  render: () => `
    <div class="prose">
      <p style="font-size: var(--step-1)">0123456789</p>
      <p style="font-size: var(--step-1)">4.2s → 380ms · p99 1.1s · 99.95% · −6pts</p>
    </div>
  `,
};
