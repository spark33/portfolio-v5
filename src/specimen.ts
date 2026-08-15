/**
 * Wiring for the type specimen page.
 *
 * Every control writes to a data attribute or custom property on <html>, so the
 * typography itself stays entirely in CSS. Settings persist across reloads and are
 * re-applied before first paint by the inline script in specimen/index.html.
 */

const STORAGE_KEY = "specimen";

interface Settings {
  treatment: string;
  theme: string;
  size: string;
  measure: string;
}

const root = document.documentElement;
const panel = document.querySelector<HTMLFormElement>("#panel");
const gridToggle = document.querySelector<HTMLInputElement>("#grid");
const readingToggle = document.querySelector<HTMLInputElement>("#reading");

if (!panel || !gridToggle || !readingToggle) {
  throw new Error("Specimen controls are missing from the document");
}

function read(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
  } catch {
    return {};
  }
}

function save(settings: Partial<Settings>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), ...settings }));
  } catch {
    // Private browsing: the page still works, it just will not remember.
  }
}

function apply(name: keyof Settings, value: string) {
  if (name === "treatment") {
    root.dataset.treatment = value;
  } else if (name === "theme") {
    if (value === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = value;
    }
  } else if (name === "size") {
    root.style.setProperty("--body-size", value);
  } else {
    root.style.setProperty("--measure", value);
  }
}

// Restore the radio group positions to match what the inline script already applied.
const saved = read();
for (const [name, value] of Object.entries(saved)) {
  const input = panel.querySelector<HTMLInputElement>(
    `input[name="${name}"][value="${value}"]`,
  );
  if (input) {
    input.checked = true;
  }
}

panel.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type !== "radio") {
    return;
  }

  const name = target.name as keyof Settings;
  apply(name, target.value);
  save({ [name]: target.value });
});

gridToggle.addEventListener("change", () => {
  root.dataset.grid = gridToggle.checked ? "on" : "off";
});

readingToggle.addEventListener("change", () => {
  root.dataset.reading = readingToggle.checked ? "on" : "off";
});

// Cycle treatments with 1/2/3 and toggle chrome with g / r, for quick comparison.
const TREATMENTS = ["swiss", "editorial", "technical"];

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.type !== "radio") {
    return;
  }

  const index = Number.parseInt(event.key, 10) - 1;

  if (TREATMENTS[index]) {
    const value = TREATMENTS[index];
    const input = panel.querySelector<HTMLInputElement>(
      `input[name="treatment"][value="${value}"]`,
    );
    if (input) {
      input.checked = true;
    }
    apply("treatment", value);
    save({ treatment: value });
  } else if (event.key === "g") {
    gridToggle.checked = !gridToggle.checked;
    gridToggle.dispatchEvent(new Event("change"));
  } else if (event.key === "r") {
    readingToggle.checked = !readingToggle.checked;
    readingToggle.dispatchEvent(new Event("change"));
  }
});
