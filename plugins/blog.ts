/**
 * Writes the blog's HTML pages to disk so Vite can treat them as ordinary MPA
 * entries — which is what gets them asset hashing, CSS injection, and dev
 * transforms for free. The output directory is generated, never edited.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import { OUT_DIR, POSTS_DIR, loadPosts, renderIndex, renderPost } from "../lib/blog.ts";

function write(file: string, contents: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

/**
 * Regenerates the whole output directory and returns the Vite input map.
 * Stale pages cannot survive a rename because the directory is rebuilt.
 */
export function generateBlog({ includeDrafts = false } = {}): Record<string, string> {
  const posts = loadPosts({ includeDrafts });

  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true });
  }

  const index = join(OUT_DIR, "index.html");
  write(index, renderIndex(posts));

  const inputs: Record<string, string> = { blog: index };

  for (const post of posts) {
    const file = join(OUT_DIR, post.slug, "index.html");
    write(file, renderPost(post));
    inputs[`blog-${post.slug}`] = file;
  }

  return inputs;
}

/** Dev-only: rebuild and reload when a post changes. */
export function blogWatcher(): Plugin {
  return {
    name: "blog-watcher",
    apply: "serve",

    configureServer(server) {
      server.watcher.add(POSTS_DIR);

      const rebuild = (file: string) => {
        if (!file.replaceAll("\\", "/").includes(`${POSTS_DIR}/`)) {
          return;
        }

        try {
          generateBlog({ includeDrafts: true });
          server.ws.send({ type: "full-reload", path: "*" });
        } catch (error) {
          server.config.logger.error(`[blog] ${(error as Error).message}`);
        }
      };

      server.watcher.on("add", rebuild);
      server.watcher.on("change", rebuild);
      server.watcher.on("unlink", rebuild);
    },
  };
}
