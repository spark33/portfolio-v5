/**
 * Light and dark.
 *
 * The system preference decides by default. An explicit choice overrides it in
 * both directions and persists, because "follow the OS" is not always what
 * someone wants from one particular site.
 *
 * The stored choice is applied by an inline script in the head, before the
 * first paint, so there is no flash of the other theme. All this module does
 * is wire the control — if it never loads, the reader still gets the theme
 * they asked for, they just cannot change it from here.
 */

const KEY = "sp:theme";

type Theme = "light" | "dark";

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme, button: HTMLButtonElement) {
  document.documentElement.dataset.theme = theme;
  // The control reports the current state; the label says what it will do.
  button.setAttribute("aria-pressed", String(theme === "dark"));
  button.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
}

export function mountTheme() {
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!button) return;

  button.dataset.ready = "";
  apply(stored() ?? system(), button);

  button.addEventListener("click", () => {
    const next: Theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(next, button);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode. The choice holds for this page and no longer.
    }
  });

  // Someone who has never chosen keeps following the system as it changes.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (!stored()) apply(event.matches ? "dark" : "light", button);
  });
}
