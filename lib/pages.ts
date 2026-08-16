/**
 * Page renderers.
 *
 * The recurring structure is the resolution strip: a row of mono-labelled
 * cells that appears twice in the site's grammar — once for the name
 * (composed / decomposed / transliterated / resolved) and once for every
 * project (its constraint, its decisions, what they cost). The name and the
 * work get identical treatment on purpose, so the argument is carried by the
 * structure rather than asserted in copy.
 */
import {
  about,
  artifacts,
  caseStudies,
  closing,
  evidence,
  greeting,
  narrative,
  nav,
  position,
  person,
  type Artifact,
  type CaseStudy,
  type Meta,
} from "../content/site.ts";
import { copy, esc, personJsonLd, shell } from "./shell.ts";

const SITE = `${person.nameEn} — ${person.role}, ${person.org}`;

function n(index: number) {
  return String(index + 1).padStart(2, "0");
}

/** A row of labelled fields. The site's one repeating layout primitive. */
function strip(items: Meta[], className = "") {
  const cells = items
    .map(
      (item) => `        <div class="strip-cell">
          <dt class="label">${copy(item.label)}</dt>
          <dd class="strip-value">${copy(item.value)}</dd>
        </div>`,
    )
    .join("\n");

  return `      <dl class="strip ${className}">
${cells}
      </dl>`;
}

/* -- home ---------------------------------------------------------------- */

/**
 * `[Label|fact]` and `[Label|fact|/href]` become chips.
 *
 * The chip is the site's one inline device: a noun nobody recognises, plus the
 * fact that makes it mean something. The reference this borrows from uses
 * favicons, which work because Microsoft and Behance credential themselves —
 * Mindlogic and LogicianUI do not, so the payload is the fact instead.
 */
function chips(text: string) {
  return copy(text).replace(
    /\[([^\]|]+)\|([^\]|]+)(?:\|([^\]]+))?\]/g,
    (_match, label: string, fact: string, href?: string) => {
      const inner = `${label}<span class="chip-fact">${fact}</span>`;
      return href
        ? `<a class="chip" href="${href}">${inner}</a>`
        : `<span class="chip">${inner}</span>`;
    },
  );
}

function paragraphs(items: typeof narrative) {
  return items
    .map((item) => `        <p${item.lead ? ' class="lead"' : ""}>${chips(item.text)}</p>`)
    .join("\n");
}

/**
 * The opening: a person talking, with the record beside them.
 *
 * The narrative runs in the board's first ten and a half cells and the
 * evidence sits in the margin from cell twelve, so the two columns are the
 * board's decision rather than a layout guess.
 */
function opening() {
  const figures = evidence.figures
    .map(
      (f) => `            <div><span class="label">${copy(f.label)}</span>
              <b>${copy(f.value)}</b></div>`,
    )
    .join("\n");

  return `      <section class="page spread">
        <div class="story">
          <h1 class="greeting">${chips(greeting)}</h1>
${paragraphs(narrative)}
        </div>
        <aside class="margin-note" aria-label="The record">
          <div class="evidence">
            <div class="evidence-figures">
${figures}
            </div>
            <p class="evidence-caption">${copy(evidence.caption)}</p>
          </div>
        </aside>
      </section>`;
}

function closingMarkup() {
  return `      <section class="page story story-closing">
${paragraphs(closing)}
        <p class="contact"><a href="mailto:${esc(person.email)}">${esc(person.email)}</a></p>
      </section>`;
}

function workIndex() {
  const rows = caseStudies
    .map(
      (study, i) => `          <li class="index-row">
            <a class="index-link" href="/work/${study.slug}/">
              <span class="index-n micro">${n(i)}</span>
              <span class="index-body">
                <span class="index-constraint display-m">${copy(study.constraint)}</span>
                <span class="index-title">${copy(study.title)}</span>
              </span>
              <span class="index-meta" aria-hidden="true">
                ${study.meta
                  .slice(2)
                  .map((m) => `<span class="micro">${copy(m.value)}</span>`)
                  .join("\n                ")}
                <span class="index-arrow" aria-hidden="true">&rarr;</span>
              </span>
            </a>
          </li>`,
    )
    .join("\n");

  return `      <section class="section" id="work" aria-labelledby="work-heading">
        <h2 class="label section-label" id="work-heading">Three constraints</h2>
        <ol class="index">
${rows}
        </ol>
      </section>`;
}

export function renderHome() {
  return shell({
    title: SITE,
    description:
      "Head of product and delivery at Mindlogic, Seoul. Three years on one " +
      "product: a multi-LLM assistant in 400+ Korean universities and public " +
      "institutions.",
    path: "/",
    stylesheet: "/src/home.css",
    module: "/src/main.ts",
    jsonLd: personJsonLd(),
    body: `    <main class="main" id="main" tabindex="-1">
${opening()}

      <div class="page">
${workIndex()}
      </div>

${closingMarkup()}
    </main>`,
  });
}

/* -- case study ---------------------------------------------------------- */

function decisions(study: CaseStudy) {
  return study.decisions
    .map(
      (decision, i) => `        <section class="decision" aria-labelledby="d${i}">
          <p class="label decision-n">Decision ${n(i)}</p>
          <h2 class="display-s decision-title" id="d${i}">${copy(decision.title)}</h2>
          <dl class="decision-fields">
            <div class="field">
              <dt class="label">Context</dt>
              <dd>${copy(decision.context)}</dd>
            </div>
            <div class="field">
              <dt class="label">Rejected</dt>
              <dd>${copy(decision.rejected)}</dd>
            </div>
            <div class="field field-cost">
              <dt class="label">Cost</dt>
              <dd>${copy(decision.cost)}</dd>
            </div>
          </dl>
        </section>`,
    )
    .join("\n");
}

function nextLink(index: number) {
  const next = caseStudies[(index + 1) % caseStudies.length];
  return `      <nav class="next" aria-label="Next case study">
        <a class="index-link" href="/work/${next.slug}/">
          <span class="index-n micro">Next</span>
          <span class="index-body">
            <span class="index-constraint display-s">${copy(next.constraint)}</span>
            <span class="index-title">${copy(next.title)}</span>
          </span>
          <span class="index-meta" aria-hidden="true"><span class="index-arrow" aria-hidden="true">&rarr;</span></span>
        </a>
      </nav>`;
}

export function renderCaseStudy(study: CaseStudy, index: number) {
  const outcome = study.outcome
    .map((line) => `            <li>${copy(line)}</li>`)
    .join("\n");

  return shell({
    title: `${study.title} — ${person.nameEn}`,
    description: study.summary,
    path: `/work/${study.slug}/`,
    stylesheet: "/src/case.css",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: study.title,
      description: study.summary,
      author: personJsonLd(),
      about: study.constraint,
      isPartOf: { "@type": "CreativeWorkSeries", name: "Three constraints" },
    },
    body: `    <main class="main page" id="main" tabindex="-1">
      <article class="case">
        <header class="case-head">
          <p class="case-topline">
            <span class="label">Constraint</span>
            <span class="case-counter micro">${n(index)} / ${String(caseStudies.length).padStart(2, "0")}</span>
          </p>
          <h1 class="display-l case-constraint">${copy(study.constraint)}</h1>
          <p class="display-m case-title">${copy(study.title)}</p>
${strip(study.meta, "case-meta")}
        </header>

        <div class="case-body">
          <p class="lede case-lede">${copy(study.lede)}</p>

${decisions(study)}

          <section class="outcome" aria-labelledby="outcome">
            <p class="label">Outcome</p>
            <h2 class="visually-hidden" id="outcome">Outcome</h2>
            <ul class="outcome-list">
${outcome}
            </ul>
          </section>
        </div>
      </article>

${nextLink(index)}
    </main>`,
  });
}

/* -- artifact (documentation, not narrative) ----------------------------- */

export function renderArtifact(item: Artifact) {
  const sections = item.sections
    .map((section, i) => {
      const body = section.body
        .map((p) => `          <p>${copy(p)}</p>`)
        .join("\n");

      const table = section.table
        ? `          <table class="spec">
            <thead><tr>${section.table.head.map((h) => `<th class="label">${copy(h)}</th>`).join("")}</tr></thead>
            <tbody>${section.table.rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell, c) =>
                      c === 0
                        ? `<th scope="row">${copy(cell)}</th>`
                        : `<td>${copy(cell)}</td>`,
                    )
                    .join("")}</tr>`,
              )
              .join("")}</tbody>
          </table>`
        : "";

      return `        <section class="doc-section" aria-labelledby="s${i}">
          <h2 class="display-s" id="s${i}">${copy(section.heading)}</h2>
${body}
${table}
        </section>`;
    })
    .join("\n");

  return shell({
    title: `${item.title} — ${person.nameEn}`,
    description: item.summary,
    path: `/${item.slug}/`,
    stylesheet: "/src/case.css",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: item.title,
      description: item.summary,
      author: personJsonLd(),
      about: item.constraint,
    },
    body: `    <main class="main page" id="main" tabindex="-1">
      <article class="case doc">
        <header class="case-head">
          <p class="case-topline">
            <span class="label">Constraint</span>
            <span class="case-counter micro">Artifact</span>
          </p>
          <h1 class="display-m case-constraint">${copy(item.constraint)}</h1>
          <p class="display-l case-title doc-title">${copy(item.title)}</p>
${strip(item.meta, "case-meta")}
        </header>
        <div class="case-body">
          <p class="lede case-lede">${copy(item.lede)}</p>
${sections}
        </div>
      </article>
    </main>`,
  });
}

/* -- about --------------------------------------------------------------- */

export function renderAbout() {
  const body = about.body
    .map((p) => `          <p>${copy(p)}</p>`)
    .join("\n");

  return shell({
    title: `About — ${person.nameEn}`,
    description: about.lede,
    path: "/about/",
    stylesheet: "/src/case.css",
    jsonLd: personJsonLd(),
    body: `    <main class="main page" id="main" tabindex="-1">
      <article class="case">
        <header class="case-head">
          <p class="case-topline">
            <span class="label">About</span>
            <span class="case-counter micro">${esc(person.location)}</span>
          </p>
          <h1 class="display-l case-constraint">${copy(person.nameEn)} &mdash; <span lang="ko">${esc(person.nameKo)}</span></h1>
${strip(position, "case-meta")}
        </header>
        <div class="case-body">
          <p class="lede case-lede">${copy(about.lede)}</p>
          <section class="doc-section">
${body}
          </section>
        </div>
      </article>
    </main>`,
  });
}

/* -- the page map the build consumes ------------------------------------- */

export function sitePages(): { file: string; name: string; html: string }[] {
  const pages = [
    { file: "index.html", name: "main", html: renderHome() },
    { file: "about/index.html", name: "about", html: renderAbout() },
  ];

  caseStudies.forEach((study, i) => {
    pages.push({
      file: `work/${study.slug}/index.html`,
      name: `work-${study.slug}`,
      html: renderCaseStudy(study, i),
    });
  });

  for (const item of artifacts) {
    pages.push({
      file: `${item.slug}/index.html`,
      name: item.slug,
      html: renderArtifact(item),
    });
  }

  return pages;
}

/** Every route the site serves, for the sitemap and for tests. */
export const routes = [
  "/",
  ...caseStudies.map((s) => `/work/${s.slug}/`),
  ...artifacts.map((a) => `/${a.slug}/`),
  "/about/",
  ...nav.filter((n) => n.href === "/blog/").map((n) => n.href),
];
