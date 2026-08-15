import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.ts"],
  framework: { name: "@storybook/html-vite", options: {} },

  // Serves /fonts/* so stories render in the real typeface, not a fallback.
  staticDirs: ["../public"],

  core: { disableTelemetry: true },

  viteFinal(config) {
    // The site's MPA entries and generated blog pages have nothing to do with
    // Storybook, and its builder supplies its own inputs.
    if (config.build?.rollupOptions) {
      delete config.build.rollupOptions.input;
    }
    return config;
  },
};

export default config;
