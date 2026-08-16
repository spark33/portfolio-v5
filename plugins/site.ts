/**
 * Writes every page to disk so Vite can treat them as ordinary MPA entries —
 * which is what gets them asset hashing, CSS injection, and dev transforms
 * for free. Output directories are generated, never edited; they are listed
 * in .gitignore alongside the blog.
 *
 * One page per URL, each independently crawlable and readable with JS off.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import { OUT_DIR as BLOG_DIR, POSTS_DIR, loadPosts, renderIndex, renderPost } from "../lib/blog.ts";
import { routes, sitePages } from "../lib/pages.ts";
import { siteOrigin } from "../lib/shell.ts";

/** Directories this plugin owns and rebuilds from scratch each time. */
const GENERATED = ["work", "logician-ui", "harness", "about", BLOG_DIR];

/** Sources that change the output; watched in dev. */
const WATCHED = ["content/", "lib/"];

function write(file: string, contents: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

function sitemap(base: string) {
  const urls = routes
    .map((route) => `  <url><loc>${base}${route}</loc></url>`)
    .join("\n");

  // The namespace is load-bearing: an earlier version of this file used
  // w3.org/2000/schemas/sitemap/0.9, which does not exist, and a crawler
  // cannot parse a urlset in a namespace it does not recognise.
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * Regenerates every page and returns the Vite input map. Stale pages cannot
 * survive a rename because the directories are rebuilt.
 */
export function generateSite({ includeDrafts = false } = {}): Record<string, string> {
  for (const dir of GENERATED) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }

  const inputs: Record<string, string> = {};

  for (const page of sitePages()) {
    write(page.file, page.html);
    inputs[page.name] = page.file;
  }

  const posts = loadPosts({ includeDrafts });
  const blogIndex = join(BLOG_DIR, "index.html");
  write(blogIndex, renderIndex(posts));
  inputs.blog = blogIndex;

  for (const post of posts) {
    const file = join(BLOG_DIR, post.slug, "index.html");
    write(file, renderPost(post));
    inputs[`blog-${post.slug}`] = file;
  }

  // A sitemap pointing at example.com is worse than no sitemap, so when the
  // origin is unknown we write neither it nor a reference to it.
  const base = siteOrigin();
  if (base) {
    write("public/sitemap.xml", sitemap(base));
    write("public/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  } else {
    rmSync("public/sitemap.xml", { force: true });
    write("public/robots.txt", "User-agent: *\nAllow: /\n");
  }

  return inputs;
}

/** Dev-only: rebuild and reload when content or a renderer changes. */
export function siteWatcher(): Plugin {
  return {
    name: "site-watcher",
    apply: "serve",

    configureServer(server) {
      server.watcher.add([POSTS_DIR, ...WATCHED]);

      const rebuild = (file: string) => {
        const path = file.replaceAll("\\", "/");
        const relevant =
          path.includes(`${POSTS_DIR}/`) || WATCHED.some((dir) => path.includes(`/${dir}`));
        if (!relevant) return;

        try {
          generateSite({ includeDrafts: true });
          server.ws.send({ type: "full-reload", path: "*" });
        } catch (error) {
          server.config.logger.error(`[site] ${(error as Error).message}`);
        }
      };

      server.watcher.on("add", rebuild);
      server.watcher.on("change", rebuild);
      server.watcher.on("unlink", rebuild);
    },
  };
}
