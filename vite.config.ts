import { defineConfig } from "vite";
import { generateSite, siteWatcher } from "./plugins/site.ts";

export default defineConfig(({ command }) => {
  // Drafts are visible while writing, and never shipped.
  const inputs = generateSite({ includeDrafts: command === "serve" });

  return {
    server: {
      host: true,
      port: 5173,
    },
    plugins: [siteWatcher()],
    build: {
      target: "es2022",
      sourcemap: true,
      // Every page is a real HTML entry; see plugins/site.ts.
      rollupOptions: { input: inputs },
    },
  };
});
