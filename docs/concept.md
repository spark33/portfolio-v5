# Site concept

Design brief for portfolio-v5, written before implementation. Two directions are
specified: **A. Editorial with interactive figures** is the recommended spine,
**B. Inspector mode** is a layer that can ride on top of it later.

## Positioning

Primary audience is a hiring manager or product engineer who will skim the site for
90 seconds, on a laptop, possibly on a mediocre connection. That constraint drives
every decision below:

- **The site must be readable with zero WebGL.** Three.js is roughly 150 KB gzipped
  even tree-shaken. It cannot sit in the critical path of the first paint.
- **The argument is the case studies, not the rendering.** 3D appears where it
  explains something a paragraph cannot.
- **Being memorable is secondary to being understood.** No scroll-jacking, no
  fake loading screens, no entrance animation the reader has to sit through.

The current scaffold — full-viewport canvas behind a headline — is the opposite of
this. It becomes the `/` hero only, and even then loads lazily.

## Direction A: Editorial with interactive figures

### The core idea

A text-first, Swiss-grid site with real typography and real writing. Each case study
carries exactly **one interactive figure**: a small, framed, self-contained WebGL or
canvas demo of the actual mechanism the project was about. Not a decorative shape —
a working model of the thing.

The figure is the differentiator. Anyone can write "I built a rate limiter." Almost
nobody lets you drag the request rate slider and watch the token bucket drain.

Examples of what a figure is, by project shape:

| Project shape        | Figure                                                          |
| -------------------- | --------------------------------------------------------------- |
| Backend / infra      | Live queue or token-bucket sim with a rate slider                |
| Latency work         | Waterfall you can scrub, before/after toggle                     |
| ML / retrieval       | 2D/3D embedding neighbourhood; type a query, watch it land       |
| Data pipeline        | Node graph that animates a record flowing through it             |
| Frontend / rendering | The actual component, isolated, with its knobs exposed           |

One figure per project. If a project has no figure worth building, it gets a still
image and that is fine — the constraint is what keeps them good.

### Information architecture

```
/                     Hero + positioning line + 3 featured projects + contact
/work/<slug>          Case study (one per project)
/about                Bio, background, what you want to work on
/notes                Optional: short technical writing. Ship empty or omit.
```

Static multi-page, built with Vite's MPA support — one HTML entry per page. No
router, no framework, no client-side navigation. Every page is independently
crawlable, cacheable, and readable with JS disabled. Case studies are authored as
markdown with frontmatter and compiled to HTML at build time by a small Vite plugin.

### Case study structure

Fixed template, so every project reads consistently and none of them sprawl:

1. **One-line what it was** — plus role, dates, stack, and a link out.
2. **The problem** — what was broken or missing, with a number in it if possible.
3. **The figure** — interactive, captioned, explains the mechanism.
4. **Decisions** — 2–4 of them, each written as *option chosen vs. option rejected,
   and why*. This is the section engineers actually read.
5. **Outcome** — what changed, measured. Including what did not work.

Target 400–700 words. Long enough to have content, short enough to finish.

### Content model

```yaml
title:    "Realtime transcript pipeline"
slug:     realtime-transcript-pipeline
role:     "Lead engineer"
period:   "2024 — 2025"
stack:    [TypeScript, Rust, Postgres]
summary:  "One sentence, used on the index card and in meta description."
figure:   token-bucket          # id of the module under src/figures/, or null
featured: true
links:
  - { label: "Repo", href: "..." }
```

### The figure system

Every figure is a module exposing one function, mirroring the existing `createScene`
contract in `src/scene.ts`:

```ts
export function mountFigure(root: HTMLElement): FigureHandle;
// FigureHandle: { dispose(): void; pause(): void; resume(): void }
```

Rules the loader enforces, not the figure author:

- **Lazy.** Dynamic `import()` per figure, so three.js lands in a chunk that only
  loads on a page that needs it — and only when the reader scrolls to it.
- **Viewport-gated.** An `IntersectionObserver` mounts on approach and calls
  `pause()` when the figure leaves the viewport. `visibilitychange` pauses the tab.
- **At most one running.** A page has one figure by design, but the loader enforces
  it so `/notes` posts cannot stack three.
- **Poster-first.** Each figure ships a static poster image rendered at build time.
  That is what the reader sees before mount, on failure, and under reduced motion.
- **Fails silently.** No WebGL, WebGL context lost, or a throw during mount leaves
  the poster in place. The page never breaks because the toy broke.

### Motion

- Respect `prefers-reduced-motion: reduce` globally: figures show their poster and
  expose their controls without ambient animation. Note that the current
  `src/scene.ts` gates mesh rotation on this but leaves pointer parallax running —
  that gate needs to cover camera movement too.
- No scroll-driven camera work. Scroll scrolls.
- Transitions are short and functional: 150–250 ms, ease-out, opacity and small
  translations only.
- The `/` hero may idle-animate, and pauses when scrolled past.

### Typography and layout

**Decided: Editorial (Newsreader), from the specimen at `/specimen/`.** It gives the
writing more authority than a grotesk does, and it separates the site from the
Inter-based default that most engineer portfolios land on. The rejected alternatives
stay in `src/specimen.css` so the choice can be re-examined against real copy.

- Self-hosted latin-subset woff2, `font-display: swap`; see `scripts/fetch-fonts.py`.
- Measure capped at 68–72 characters. Body at 18–19 px, 1.6 line height.
- Twelve-column grid with a generous baseline; figures may break to full width,
  body text never does.
- Light and dark both supported, driven by `prefers-color-scheme`. The current
  hardcoded dark is fine as the dark half but a text-heavy site needs the light one.
- Accent is for links and figure controls only: `#3f4fc4` in light, `#9aa6ff` in
  dark. The starter scene's `#5b6cff` fails AA against the dark background at body
  sizes and is not used for text.

### Performance budget

Measured on a throttled 4G connection, mid-tier laptop:

| Metric                              | Budget                     |
| ----------------------------------- | -------------------------- |
| HTML + CSS + JS for first paint     | < 60 KB gzipped            |
| Fonts (2 faces, subset)             | < 45 KB                    |
| LCP                                 | < 1.5 s                    |
| CLS                                 | < 0.05 (reserve figure box)|
| Figure chunk, loaded on demand      | < 200 KB gzipped           |
| Figure frame time                   | < 8 ms at DPR 2            |

Keep the DPR clamp of 2 already in `scene.ts`. Render figures on demand rather than
in a permanent `requestAnimationFrame` loop where the figure is not continuously
animating.

### Accessibility

- Every figure has a text description adjacent to it that carries the same
  information. The figure is an illustration, never the only source.
- Figure controls are real `<input>` and `<button>` elements, keyboard operable,
  labelled. Canvas is `aria-hidden`.
- Contrast at AA minimum in both themes, including the accent on both backgrounds.
- Full keyboard path through the site; visible focus rings; skip link.

### Build order

1. **Content first.** Three case studies written in markdown, no styling. If the
   writing is not compelling as plain text, no amount of WebGL rescues it.
2. **Typography and grid.** Static pages, real type, both themes, no JS.
3. **Figure loader.** The contract, observer gating, poster fallback — proven with
   one deliberately trivial figure.
4. **Figures.** One per featured project, hardest one first.
5. **Hero.** Rework the existing scene into a lazy, pausable `/` hero.

## Direction B: Inspector mode

A developer-facing layer rather than a separate site: a panel, toggled by backtick
or `?inspect`, that exposes the machinery of whatever figure is on screen — frame
time, draw calls, live uniforms as draggable controls, the scene graph.

The pitch is that the site's own instrumentation is the credential. It is cheap
signal for an engineering reader and invisible to everyone else.

- **Cost:** small, if the figure contract exposes its uniforms as a declared object
  from the start. Retrofitting later is more work than designing for it now.
- **Risk:** it is a toy for a narrow audience, and it can absorb unbounded polish
  time. It must not be built before the case studies exist.
- **Verdict:** not phase one. Design the figure contract so the panel is possible —
  a `params` descriptor alongside `mountFigure` — and revisit once the site ships.

## Recommendation

Build A. Treat the figure system as the one piece of real engineering in the site
and keep everything else deliberately plain. Reserve B until three case studies are
live and readable.

## Open questions

1. **Which three projects?** Everything above is a container. The figures cannot be
   specced further without knowing what the projects actually are.
2. **Is there anything under NDA?** It changes what a figure can show and may force
   an abstracted version of the mechanism.
3. **Korean and English, or English only?** Bilingual doubles the writing burden and
   affects the type pairing choice; better decided now than retrofitted.
