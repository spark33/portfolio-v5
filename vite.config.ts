import { defineConfig } from "vite";
import { blogWatcher, generateBlog } from "./plugins/blog.ts";

export default defineConfig(({ command }) => {
  // Drafts are visible while writing, and never shipped.
  const blogInputs = generateBlog({ includeDrafts: command === "serve" });

  return {
    server: {
      host: true,
      port: 5173,
    },
    plugins: [blogWatcher()],
    build: {
      target: "es2022",
      sourcemap: true,
      rollupOptions: {
        // Relative to the project root. Blog entries are generated; see plugins/blog.ts.
        input: {
          main: "index.html",
          ...blogInputs,
        },
      },
    },
  };
});
