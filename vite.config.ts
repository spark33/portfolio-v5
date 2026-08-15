import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      // Relative to the project root; keeps the specimen out of the main entry.
      input: {
        main: "index.html",
        specimen: "specimen/index.html",
      },
    },
  },
});
