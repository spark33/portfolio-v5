import { test as base } from "@playwright/test";

/**
 * The home page opens behind the loading animation's curtain, which covers the
 * viewport for about four seconds on the first visit of a session. Every test
 * that is not *about* the curtain wants the second visit.
 *
 * Set the way the site itself decides — the same session key the gate reads —
 * rather than by hiding the element, so a test still exercises the real
 * once-per-session path and would catch that path breaking.
 *
 * `tests/gate.spec.ts` uses the unwrapped `test` and gets the curtain.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("loader:seen", "1");
      } catch {
        // Storage disabled; the gate handles that case by playing anyway.
      }
    });
    await use(page);
  },
});

export { expect } from "@playwright/test";
