/**
 * The HTML shell every page is rendered into.
 *
 * One shell, so the blog and the case studies cannot drift into looking like
 * two different sites. Pages supply a body and their own stylesheet; the
 * shell owns the head, the masthead, the navigation and the footer.
 */
import { readFileSync } from "node:fs";
import { nav, person } from "../content/site.ts";

export function esc(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wraps Korean runs so they pick up Pretendard and the Korean tracking. */
export function ko(value: string) {
  return value.replace(
    /[ᄀ-ᇿ㄰-㆏가-힯]+/g,
    (run) => `<span lang="ko">${run}</span>`,
  );
}

/**
 * The one function body copy goes through: escape, tag Korean runs, mark up
 * `backticked` spans as code, then swap the `{{?}}` marker for a visible
 * placeholder chip. A metric that is not known yet must look unknown, not
 * absent — and never quietly invented.
 */
export function copy(value: string) {
  return ko(esc(value))
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\{\{\?\}\}/g, '<span class="pending">not yet measured</span>');
}

/**
 * The fonts worth preloading: the display face, which sets the largest
 * contentful paint, and the Korean subset, which sets the first line of the
 * name. Read out of the generated stylesheet so a regenerated hash cannot
 * leave a stale preload behind.
 */
function fontPreloads(): string[] {
  let css = "";
  try {
    css = readFileSync("src/fonts.css", "utf8");
  } catch {
    return []; // Fonts not fetched yet; the site still renders.
  }

  const wanted = ["Schibsted Grotesk", "Pretendard"];
  const urls: string[] = [];

  for (const block of css.split("@font-face")) {
    const family = /font-family:\s*['"]([^'"]+)['"]/.exec(block)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const url = /url\((\/fonts\/[^)]+)\)/.exec(block)?.[1];

    if (!family || !url || !wanted.includes(family)) continue;
    // Pretendard ships two weights; only the text weight is above the fold.
    if (family === "Pretendard" && weight !== "400") continue;
    if (!urls.includes(url)) urls.push(url);
  }

  return urls;
}

const PRELOADS = fontPreloads();

/**
 * Applied before the first paint, so a reader who chose dark never sees a
 * flash of light. Nothing else in the head depends on it, and with JS off it
 * simply never runs and the system preference decides.
 */
const THEME_GATE = `<script>
      (function () {
        try {
          var t = localStorage.getItem("sp:theme");
          if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
        } catch (e) {}
      })();
    </script>`;

function navigation(path: string) {
  const items = nav
    .map(({ href, label }) => {
      const current = href === path ? ' aria-current="page"' : "";
      return `<a href="${href}"${current}>${esc(label)}</a>`;
    })
    .join("\n          ");

  return `    <header class="page site-head">
      <a class="wordmark" href="/">${esc(person.nameEn)} <span lang="ko">${esc(person.nameKo)}</span></a>
      <nav class="site-nav" aria-label="Primary">
          ${items}
      </nav>
      <button class="theme-toggle" type="button" data-theme-toggle
        aria-pressed="false" aria-label="Switch to dark theme">
        <span aria-hidden="true"></span>
      </button>
    </header>`;
}

function footer() {
  return `    <footer class="page site-foot">
      <div>
        <p class="label">Contact</p>
        <p><a href="mailto:${esc(person.email)}">${esc(person.email)}</a></p>
      </div>
      <div>
        <p class="label">Based in</p>
        <p>${esc(person.location)} · Open to relocation</p>
      </div>
      <p class="micro">${esc(person.nameRoman)} — <span lang="ko">${esc(person.nameKo)}</span></p>
    </footer>`;
}

export interface ShellOptions {
  title: string;
  description: string;
  /** Path with trailing slash. Drives the current-page marker. */
  path: string;
  /** Page stylesheet, imported through Vite so it is hashed and inlined. */
  stylesheet: string;
  body: string;
  /** Schema.org payload. Automated screening reads this; a canvas it cannot. */
  jsonLd?: Record<string, unknown>;
  /** Optional module entry. The page must be complete without it. */
  module?: string;
  /** Keep this page out of search results. The 404, and nothing else. */
  noindex?: boolean;
}

/**
 * The origin, or null if nobody has told us what it is.
 *
 * `SITE_ORIGIN` wins; otherwise Vercel's production hostname when the build
 * runs there. The sitemap needs it to be absolute or it is worthless, and the
 * share card is the same: a card is fetched by a machine that has no page to
 * resolve a relative path against.
 */
export function siteOrigin(): string | null {
  const configured = process.env.SITE_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return null;
}

const ORIGIN = siteOrigin();

/** Describes the card at public/og.png. Kept beside the origin it needs. */
const SHARE_ALT =
  "Sean Park — head of product and delivery at Mindlogic, Seoul. " +
  "Designing inside constraints you did not choose is a different skill.";

export function shell({
  title,
  description,
  path,
  stylesheet,
  body,
  jsonLd,
  module,
  noindex,
}: ShellOptions) {
  const preload = PRELOADS.map(
    (url) =>
      `    <link rel="preload" href="${url}" as="font" type="font/woff2" crossorigin />`,
  ).join("\n");

  const structured = jsonLd
    ? `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  const script = module
    ? `\n    <script type="module" src="${module}"></script>`
    : "";

  const robots = noindex
    ? `\n    <meta name="robots" content="noindex" />`
    : "";

  // The card is committed at public/og.png and regenerated by scripts/og.mjs,
  // the same arrangement as the fonts: the build needs no browser and no
  // network. It is only advertised when the origin is known, because a
  // scraper fetches it with no page to resolve a relative path against —
  // the same reason the sitemap is not written without one.
  const share = ORIGIN
    ? [
        `    <meta property="og:image" content="${ORIGIN}/og.png" />`,
        `    <meta property="og:image:width" content="1200" />`,
        `    <meta property="og:image:height" content="630" />`,
        `    <meta property="og:image:alt" content="${esc(SHARE_ALT)}" />`,
        `    <meta property="og:url" content="${ORIGIN}${path}" />`,
        `    <meta name="twitter:card" content="summary_large_image" />`,
      ].join("\n")
    : `    <!-- No og:image: SITE_ORIGIN is unset, and a share card needs an absolute URL. -->`;

  // The board is decoration to a screen reader and structure to everyone else.
  // `.tooth` is the ground's material and is deliberately outside `.board`:
  // the board is nineteen cells inside the gutter, and the surface it is drawn
  // on runs to the edges of the window.
  const board = `    <div class="tooth" aria-hidden="true"></div>
    <div class="board" aria-hidden="true">
      <div class="lattice lattice-base"></div>
      <div class="lattice lattice-lift"></div>
      <div class="board-edge"></div>
      <div class="hoshi"></div>
    </div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="author" content="${esc(person.nameEn)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:type" content="website" />
${share}
    <meta name="theme-color" content="#e9e9e3" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#161613" media="(prefers-color-scheme: dark)" />
    <link
      rel="icon"
      href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' fill='%23e9e9e3'/><rect x='3' y='3' width='10' height='10' fill='%23b4372b'/></svg>"
    />
${preload}
    <link rel="stylesheet" href="${stylesheet}" />${robots}${structured}
    ${THEME_GATE}
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
${board}
${navigation(path)}
${body}
${footer()}${script}
  </body>
</html>
`;
}

/** The Person record, shared by the index and the about page. */
export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.nameEn,
    alternateName: [person.nameKo, person.nameRoman],
    jobTitle: person.role,
    email: `mailto:${person.email}`,
    worksFor: { "@type": "Organization", name: person.org },
    address: { "@type": "PostalAddress", addressLocality: person.location },
    knowsLanguage: ["en", "ko"],
  };
}
