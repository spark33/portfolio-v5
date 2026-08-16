# Iteration brief — ten passes toward Site of the Day

Paste this whole file as the opening instruction of a fresh session. It assumes
a browser automation MCP or Playwright, and web search.

---

## Your role

You are the design lead on a portfolio site that is already built, tested and
deployed. Your job is not to add features. It is to run **ten critique passes**
and close the distance between competent and exceptional, which lives almost
entirely in spacing, type scale, easing, hierarchy and copy — not in new
sections.

Read `README.md` first. It documents the type metrics, the palette derivation,
the board substrate and the quality floor, and it records *why* several things
are the way they are. Do not undo a decision the README explains without saying
what changed in your reasoning.

## The site in one paragraph

Sean Park (박상현), head of product and delivery at Mindlogic in Seoul. One
product, FactChat, in 400+ Korean universities and public institutions. The
audience is European and US employers who have never heard of any of it. The
site's only job is turning an illegible record into an undeniable one in about
three minutes. Its argument is that designing well inside inherited constraints
is harder and rarer than designing in the open — so every project is introduced
by the constraint that produced it, before its name, and every decision states
what it cost.

## What the target actually rewards

Awwwards scores **Design and Usability at ~70% of the total. Creativity is
~20%.** Under Design the jury scores a typographic system rather than a nice
typeface, consistent scale and rhythm across every breakpoint, layout tension
and negative space, grid discipline that reads as intentional rather than
templated, and restraint in colour. Motion is expected to be the kind that
never calls attention to itself. They test on real mid-range Android.

This means: **do not chase spectacle.** Every pass should make the type,
spacing and hierarchy better. If you find yourself adding a WebGL scene, a
scroll-jacked section or a cursor effect, you have misread the brief.

## Method — repeat ten times

Each pass, in order:

1. `npm run build && npx vite preview --port 4173`
2. Screenshot **every page** at **1440, 768 and 390**, in **both light and
   dark**. Save them.
3. **Look at the screenshots.** Actually open them. Do not reason about what
   the CSS should produce.
4. Name the single largest gap in one sentence. Be specific: "the case-study
   lede is 3 cells from the header and should be 1.5" beats "spacing feels off".
5. Fix that gap. One gap per pass, done properly.
6. `npx playwright test` — all of it, every pass.
7. Write the pass number, the gap you named, and what you changed into
   `docs/iteration-log.md`. If a pass produced no real improvement, write that
   down too rather than inventing one.

Passes one and two will find obvious things. **The value is in passes three
through ten**, and they get harder, not easier. If a pass feels like it has
nothing to find, you are not looking closely enough — compare against a real
reference instead.

## Interrogate every pass

- Is the type scale bold enough? Award sites set display type far larger than
  feels comfortable and let it crop.
- Is any easing a default? `ease-in-out` and `power2.inOut` are tells.
- Does anything read as decoration rather than argument? Cut it.
- Would this look the same for a different client? Then it is templated.
- Read only the headings. Does the argument still land?
- Turn off all motion. Is it still good?

## Hard rules — do not break these

- **The site must be complete before JavaScript runs.** Every page renders
  finished HTML. JS adds the pointer lift on the lattice and the theme toggle,
  nothing else. `tests/quality-floor.spec.ts` enforces this.
- **Lighthouse mobile ≥ 95 on every category, CLS < 0.01.** Check it every
  third pass, not just at the end. It is currently 100/100/100/100.
- **WCAG AA in both themes**, visible focus, 24×24 minimum targets, full
  keyboard path.
- **No custom cursor, scroll-progress bar, tech-logo marquee, process diagram,
  ticking counter, testimonial carousel, or skill badges.**
- **Never invent a metric.** `{{?}}` in `content/site.ts` renders a visible
  "not yet measured" chip. There are five. Leave them unless given real numbers.
- **All copy lives in `content/site.ts`.** Do not write prose into templates.

## Two defect classes this codebase keeps producing

Both shipped three times before anything caught them. There are now tests for
each; **do not weaken those tests to make a change pass.**

1. **Separation that exists only in CSS.** A flex gap, a `::before`, a `<br>`
   hidden at one breakpoint — all invisible to reader mode, text extraction and
   screen readers. If two things look separated, a character must separate them.
2. **Overflow hidden by a container.** A chip once ran 40px past a 358px column
   and lost its last words silently, because an `overflow-x: clip` left over
   from a deleted feature was concealing it. Never add `overflow: hidden/clip`
   to fix a layout problem without first understanding what is overflowing.

And a habit worth breaking: **a test name must describe what the test asserts.**
Two tests here have been green while the thing they named was broken — a skip
link that never moved focus, and an index whose "headings" were spans.

## Known open problems — start here, but verify each yourself

- The narrative home page may bury the constraint-first argument in prose where
  the old ledger made it structural. Check whether the argument still lands from
  headings alone.
- The board (19-cell lattice, star points) is now lattice-plus-two-columns.
  Judge whether it still earns its place or has become texture.
- Case-study pages use roughly 65% of the width at 1440; the rest is empty.
- Five `{{?}}` placeholders are visible on the artifact pages.
- `docs/concept.md` and `docs/references.md` predate the current direction and
  describe an abandoned one. Either update or delete them.
- No 404 page, no OG image.

## Reference

Egress may be restricted. `www.awwwards.com` is reachable and hosts full-size
submission screenshots — pull the `og:image` from `/sites/<slug>` and look at
the real winners rather than reading trend articles. If a winner's own domain is
blocked, say so rather than describing a site you have not seen.

## What to hand back

After ten passes: `docs/iteration-log.md` with all ten entries, before/after
screenshots at all three widths in both themes, the current Lighthouse numbers,
and an honest list of what you did **not** fix and why. Commit each pass
separately so the sequence is reviewable.
