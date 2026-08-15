# Visual references

Curated against [`concept.md`](concept.md) — an editorial, text-first site where each
case study carries one interactive figure. Organised by what to steal, not by how
pretty the screenshot is.

> Links are from knowledge and were **not verified in this session**: the cloud
> environment's network policy blocks these hosts, and image CDNs too
> (`cdn.dribbble.com` returns a 403 at the proxy). Adding `cdn.dribbble.com`,
> `mir-s3-cdn-cf.behance.net` and `i.pinimg.com` to the environment's allowed
> domains would let a future session pull thumbnails inline.

## 1. Interactive figures — the reference class

This is the part of the site that has to be good. Everything else is typesetting.

**[ciechanow.ski](https://ciechanow.ski)** — Bartosz Ciechanowski. The gold standard,
and the single most useful thing on this list. Study specifically:

- Figures are *inline in the argument*, introduced by the sentence before them. The
  prose says "drag the slider" and the slider is right there.
- Controls are boring, native, and labelled. No custom knobs, no mystery-meat.
- Each figure demonstrates exactly one variable. When two things need showing, there
  are two figures.
- Nothing autoplays. Figures sit still until you touch them.

Our `mountFigure` contract exists to make this pattern cheap to repeat.

**[Red Blob Games](https://www.redblobgames.com)** — Amit Patel. Dense algorithm
explanations with diagrams you can drag. Less beautiful than Ciechanowski, more
instructive on *layout* — how a figure and its caption share a column, and how to
handle a figure that needs to be wider than the text.

**[The Pudding](https://pudding.cool)** — editorial data storytelling. Steal the
captioning voice and the discipline of a headline on every figure.

**[Distill](https://distill.pub)** (archived) — the margin/figure layout for technical
writing. Its CSS conventions for full-bleed vs. text-width figures are worth copying
outright.

**[Josh Comeau](https://www.joshwcomeau.com)** — best-in-class light/dark handling with
figures embedded in prose, and a good demonstration of restraint: whimsy that never
interrupts reading.

**[Amelia Wattenberger](https://wattenberger.com)** — more experimental. Useful as a
counterexample: some pieces let the interaction overwhelm the point. Note where the
line is.

## 2. Editorial restraint and typography

**[rauno.me](https://rauno.me)** — Rauno Freiberg. The register to aim for: minimal,
obsessive detail, engineering credibility conveyed through craft rather than volume.
Look at focus states, hover timing, and how little he explains himself.

**[Tufte CSS](https://edwardtufte.github.io/tufte-css/)** — margin notes and sidenotes,
implemented plainly. Even if we don't use sidenotes, the measure and rhythm are a good
baseline for the case-study template.

**[Stripe docs](https://docs.stripe.com)** — how to pair a diagram with code and keep
both readable in light and dark. Also the clearest example of a two-column technical
layout that degrades gracefully to one.

**[Linear](https://linear.app)** — type scale and dark-mode surface colours. Take the
scale, leave the marketing gloss.

**Josef Müller-Brockmann, *Grid Systems in Graphic Design*** — the source for the
twelve-column decision in the brief. Worth an hour with the actual book.

## 3. Engineer portfolios in the target register

The audience is a hiring manager or product engineer, so these matter more than
Awwwards winners:

- **[jvns.ca](https://jvns.ca)** — Julia Evans. Nearly no design, enormous credibility.
  Proof that clarity outperforms polish. The floor we should not fall below.
- **[danluu.com](https://danluu.com)** — the extreme text-only end. Instructive on how
  far substance alone carries a site; not a look to copy.
- **[brandur.org](https://brandur.org)** — long-form engineering writing with genuine
  typographic care. Probably the closest single match to our target.
- **[paco.me](https://paco.me)** and **[leerob.com](https://leerob.com)** — short,
  confident, project-led. Good models for the `/` index and the about page.

## 4. Raw visual mood

From the Dribbble/Awwwards/Behance search server. Lower signal — these are static
shots, not working sites, and several are gallery pages rather than single works.
Useful for colour and composition only.

- [Swiss style collection](https://dribbble.com/vladszk/collections/6752336-Swiss-Style-Inspiration)
  — Vlad Szîrka's curation; the most concentrated of the Dribbble results.
- [dribbble.com/tags/swiss-typography](https://dribbble.com/tags/swiss-typography)
- [Swiss style in typography](https://www.behance.net/gallery/87155103/swiss-style-in-typography) (Behance)
- [JH — Editorial Art Director portfolio](https://dribbble.com/shots/27288946-JH-Editorial-Art-Director-Portfolio-Personal-Website-UI-Design)
  — full-page shot; useful for index-page rhythm.
- [Awwwards: typography-heavy web design](https://www.awwwards.com/typography-heavy-design.html)
- [Awwwards: minimal websites](https://www.awwwards.com/websites/minimal/)
- [Awwwards: three.js winners](https://www.awwwards.com/websites/three-js/) — for the
  hero only. Do not let this collection set the direction for the whole site.

## What to do with this

Pick **one** primary reference for figures (recommended: Ciechanowski) and **one** for
typography (recommended: rauno.me or brandur.org), and hold the build to them. A
moodboard with twenty equal influences produces a site with none.
