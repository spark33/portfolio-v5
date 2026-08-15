import type { Preview } from "@storybook/html-vite";

// Stories render against the real site system, never a Storybook-only copy.
import "../src/type.css";
import "../src/article.css";
import "../src/blog.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
  },

  globalTypes: {
    theme: {
      description: "Colour scheme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (story, context) => {
      // The tokens key off <html data-theme>, so the toggle has to reach it.
      document.documentElement.dataset.theme = context.globals.theme as string;

      const wrapper = document.createElement("div");
      wrapper.className = "page";

      const rendered = story();
      if (typeof rendered === "string") {
        wrapper.innerHTML = rendered;
      } else {
        wrapper.append(rendered as Node);
      }

      return wrapper;
    },
  ],
};

export default preview;
