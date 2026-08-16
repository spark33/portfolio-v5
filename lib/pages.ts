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
  greeting,
  narrative,
  nav,
  person,
  record,
  recordCaption,
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

/**
 * The same fields, in the margin rather than under the title.
 *
 * As a horizontal band under the header it read once and then left the right
 * five cells of the board empty for the whole length of the page. In the
 * margin it holds that column and stays beside the argument it qualifies —
 * the same move the home page makes with the record, so it is the site's
 * grammar rather than a fix applied here.
 *
 * It is first in the DOM, and placed right by the grid, so the reading order
 * is unchanged: the fields still precede the lede.
 */
function margin(items: Meta[]) {
  return `          <aside class="case-margin" aria-label="Project details">
${strip(items, "margin-strip")}
          </aside>`;
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
      // A real space, not a flex gap. The gap is invisible to text extraction,
      // reader mode and screen readers, which read "LogicianUIour design
      // system". Visual separation has to exist as a character.
      const inner = `${label} <span class="chip-fact">${fact}</span>`;
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
  const figures = record
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
            <p class="evidence-caption">${copy(recordCaption)}</p>
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
                <h3 class="index-constraint display-m">${copy(study.constraint)}</h3>
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
        <p class="index-more"><a href="/work/">All work, including what is underneath it &rarr;</a></p>
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

/* -- work index ---------------------------------------------------------- */

function indexRow(
  href: string,
  marker: string,
  constraint: string,
  title: string,
  meta: string[],
) {
  const metaCells = meta
    .map((m) => `<span class="micro">${copy(m)}</span>`)
    .join("\n                ");

  return `          <li class="index-row">
            <a class="index-link" href="${href}">
              <span class="index-n micro">${copy(marker)}</span>
              <span class="index-body">
                <h3 class="index-constraint display-m">${copy(constraint)}</h3>
                <span class="index-title">${copy(title)}</span>
              </span>
              <span class="index-meta" aria-hidden="true">
                ${metaCells}
                <span class="index-arrow" aria-hidden="true">&rarr;</span>
              </span>
            </a>
          </li>`;
}

export function renderWorkIndex() {
  const studies = caseStudies
    .map((study, i) =>
      indexRow(
        `/work/${study.slug}/`,
        n(i),
        study.constraint,
        study.title,
        study.meta.slice(2).map((m) => m.value),
      ),
    )
    .join("\n");

  const built = artifacts
    .map((item) => indexRow(`/${item.slug}/`, "—", item.constraint, item.title, []))
    .join("\n");

  return shell({
    title: `Work — ${person.nameEn}`,
    description:
      "Three constraints and what each one cost, plus the design system and " +
      "the automation underneath them.",
    path: "/work/",
    stylesheet: "/src/home.css",
    module: "/src/main.ts",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Work",
      about: caseStudies.map((s) => s.constraint),
      author: personJsonLd(),
    },
    body: `    <main class="main page" id="main" tabindex="-1">
      <header class="work-head">
        <p class="label">Work</p>
        <h1 class="display-l">Every project here is named by the pressure that produced it.</h1>
      </header>

      <section class="section" aria-labelledby="constraints">
        <h2 class="label section-label" id="constraints">Three constraints</h2>
        <ol class="index">
${studies}
        </ol>
      </section>

      <section class="section" aria-labelledby="built">
        <h2 class="label section-label" id="built">Also built</h2>
        <ol class="index">
${built}
        </ol>
      </section>
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
        </header>

        <div class="case-layout">
${margin(study.meta)}

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
        </header>
        <div class="case-layout">
${margin(item.meta)}

          <div class="case-body">
            <p class="lede case-lede">${copy(item.lede)}</p>
${sections}
          </div>
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
        </header>
        <div class="case-layout">
${margin(record)}

          <div class="case-body">
            <p class="lede case-lede">${copy(about.lede)}</p>
            <section class="doc-section">
${body}
            </section>
          </div>
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
    { file: "work/index.html", name: "work", html: renderWorkIndex() },
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
  "/work/",
  ...caseStudies.map((s) => `/work/${s.slug}/`),
  ...artifacts.map((a) => `/${a.slug}/`),
  "/about/",
  ...nav.filter((n) => n.href === "/blog/").map((n) => n.href),
];
