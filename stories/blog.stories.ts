import type { Meta, StoryObj } from "@storybook/html-vite";

const meta: Meta = {
  title: "Blog",
};

export default meta;

interface PostItemArgs {
  title: string;
  date: string;
  readingMinutes: number;
  summary: string;
  draft: boolean;
}

/** One row of the index. Rendered server-side by lib/blog.ts. */
export const PostItem: StoryObj<PostItemArgs> = {
  args: {
    title: "Cutting transcript latency from 4.2s to 380ms",
    date: "14 March 2026",
    readingMinutes: 2,
    summary:
      "A realtime speech pipeline that buffered too eagerly, rebuilt around incremental decoding.",
    draft: false,
  },

  argTypes: {
    draft: { control: "boolean", description: "Dev-only; never ships" },
    readingMinutes: { control: { type: "number", min: 1 } },
  },

  render: ({ title, date, readingMinutes, summary, draft }) => `
    <ul class="post-list">
      <li class="post-item">
        <a href="#">${title}</a>
        <p class="meta">
          <time>${date}</time> · ${readingMinutes} min read${
            draft ? ` · <b class="draft-flag">Draft</b>` : ""
          }
        </p>
        <p class="summary">${summary}</p>
      </li>
    </ul>
  `,
};

export const Navigation: StoryObj = {
  render: () => `
    <header class="site-nav">
      <a class="wordmark" href="#">Portfolio</a>
      <nav aria-label="Primary"><a href="#" aria-current="page">Notes</a></nav>
    </header>
  `,
};
