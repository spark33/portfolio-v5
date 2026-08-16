/**
 * Build-time blog pipeline.
 *
 * Posts are markdown with YAML frontmatter under content/posts/. This module
 * turns them into standalone HTML pages; the Vite plugin in plugins/blog.mjs
 * decides when to write them and Vite processes the result as ordinary MPA
 * entries, so posts get the same asset hashing and CSS handling as any page.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { person } from "../content/site.ts";
import { esc, personJsonLd, shell } from "./shell.ts";

export const POSTS_DIR = "content/posts";
export const OUT_DIR = "blog";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true, // curly quotes and proper dashes; this is an editorial site
});

const WORDS_PER_MINUTE = 220;

export interface PostDate {
  iso: string;
  label: string;
  sortKey: number;
}

export interface Post {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  draft: boolean;
  date: PostDate;
  readingMinutes: number;
  html: string;
  source: string;
}

const escapeHtml = esc;

/** `2026-03-01-cutting-latency.md` and `cutting-latency.md` both slug the same. */
function slugFromFilename(filename: string) {
  return filename.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function formatDate(value: unknown): PostDate | null {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    iso: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    sortKey: date.getTime(),
  };
}

/**
 * Reads every post. Drafts are kept in dev so they can be previewed, and
 * dropped from production builds.
 */
export function loadPosts({ includeDrafts = false } = {}): Post[] {
  let filenames: string[] = [];
  try {
    filenames = readdirSync(POSTS_DIR).filter((name) => name.endsWith(".md"));
  } catch {
    return []; // No posts yet is a valid state, not an error.
  }

  const posts = filenames.map((filename) => {
    const raw = readFileSync(join(POSTS_DIR, filename), "utf8");
    const { data, content } = matter(raw);

    if (!data.title) {
      throw new Error(`${POSTS_DIR}/${filename}: frontmatter is missing "title"`);
    }

    const date = formatDate(data.date);
    if (!date) {
      throw new Error(`${POSTS_DIR}/${filename}: frontmatter needs a valid "date"`);
    }

    const words = content.trim().split(/\s+/).length;

    return {
      slug: data.slug ?? slugFromFilename(filename),
      title: data.title,
      summary: data.summary ?? "",
      tags: data.tags ?? [],
      draft: Boolean(data.draft),
      date,
      readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
      html: md.render(content),
      source: `${POSTS_DIR}/${filename}`,
    };
  });

  return posts
    .filter((post) => includeDrafts || !post.draft)
    .sort((a, b) => b.date.sortKey - a.date.sortKey);
}

interface LayoutOptions {
  title: string;
  description: string;
  body: string;
  jsonLd?: Record<string, unknown>;
}

// No <link rel="canonical">: it needs an absolute origin to mean anything, and
// Vite resolves link hrefs as build assets, which a directory URL is not.
function layout({ title, description, body, jsonLd }: LayoutOptions) {
  return shell({
    title,
    description,
    path: "/blog/",
    stylesheet: "/src/blog.css",
    body,
    jsonLd,
  });
}

function postMeta(post: Post) {
  const draft = post.draft ? ` · <b class="draft-flag">Draft</b>` : "";
  return `<p class="meta">
            <time datetime="${post.date.iso}">${post.date.label}</time> · ${post.readingMinutes} min read${draft}
          </p>`;
}

export function renderPost(post: Post) {
  const tags = post.tags.length
    ? `\n            <ul class="tags">${post.tags
        .map((tag) => `<li class="meta">${escapeHtml(tag)}</li>`)
        .join("")}</ul>`
    : "";

  return layout({
    title: `${post.title} — Writing — ${person.nameEn}`,
    description: post.summary,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.summary,
      datePublished: post.date.iso,
      author: personJsonLd(),
    },
    // The date, the reading time and the tags are the post's fields, so they
    // go where every other page on the site puts its fields: the margin note.
    // In the masthead they pushed the title down the page and left the right
    // five cells of the board empty for the whole post.
    body: `    <main class="main page" id="main" tabindex="-1">
      <div class="margin-layout">
        <aside class="margin-note" aria-label="Post details">
          ${postMeta(post)}${tags}
        </aside>

        <article class="prose">
          <header class="masthead">
            <h1 class="display-m display-measure">${escapeHtml(post.title)}</h1>
            ${post.summary ? `<p class="lede">${escapeHtml(post.summary)}</p>` : ""}
          </header>
${post.html}
        </article>
      </div>
      <p class="back"><a href="/blog/">← All writing</a></p>
    </main>`,
  });
}

export function renderIndex(posts: Post[]) {
  // The same row the work index uses: the whole row is the link, the title is
  // a heading, and the machine voice sits on the right.
  const items = posts.length
    ? posts
        .map(
          (post) => `        <li class="index-row">
          <a class="index-link post-link" href="/blog/${post.slug}/">
            <span class="index-body">
              <h2 class="post-title display-s">${escapeHtml(post.title)}</h2>
              ${post.summary ? `<span class="summary">${escapeHtml(post.summary)}</span>` : ""}
            </span>
            <span class="index-meta">
              <span class="micro"><time datetime="${post.date.iso}">${post.date.label}</time></span>
              <span class="micro">${post.readingMinutes} min read</span>
              <span class="index-arrow" aria-hidden="true">&rarr;</span>
            </span>
          </a>
        </li>`,
        )
        .join("\n")
    : `        <li class="index-row"><p class="summary">No posts yet. Add a markdown file to <code>content/posts/</code>.</p></li>`;

  return layout({
    title: `Writing — ${person.nameEn}`,
    description: "Notes on delivery, design systems, and working inside constraints.",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: `Writing — ${person.nameEn}`,
      description: "Notes on delivery, design systems, and working inside constraints.",
      author: personJsonLd(),
      blogPost: posts.map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.date.iso,
        url: `/blog/${post.slug}/`,
      })),
    },
    body: `    <main class="main page" id="main" tabindex="-1">
      <header class="blog-head">
        <p class="label">Writing</p>
        <h1 class="display-l display-measure">Notes on delivery, design systems, and working inside constraints.</h1>
      </header>
      <ol class="index post-list">
${items}
      </ol>
    </main>`,
  });
}
