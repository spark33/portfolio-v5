import { expect, test } from "@playwright/test";
import { loadPosts } from "../lib/blog.ts";

/** Pure loader tests — no browser needed. */
test.describe("post loading", () => {
  test("drafts are excluded by default and available on request", async () => {
    const published = loadPosts();
    const all = loadPosts({ includeDrafts: true });

    expect(published.every((post) => !post.draft)).toBe(true);
    expect(all.length).toBeGreaterThan(published.length);
  });

  test("strips the date prefix from the filename to make the slug", async () => {
    const post = loadPosts().find((p) => p.title.startsWith("Cutting transcript"));

    expect(post?.slug).toBe("cutting-transcript-latency");
    expect(post?.source).toContain("2026-03-14-");
  });

  test("sorts newest first and derives reading time", async () => {
    const posts = loadPosts({ includeDrafts: true });
    const keys = posts.map((post) => post.date.sortKey);

    expect(keys).toEqual([...keys].sort((a, b) => b - a));
    expect(posts[0].readingMinutes).toBeGreaterThanOrEqual(1);
  });
});
