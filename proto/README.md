# Typography prototypes — creativity pass A

Three throwaway directions, built to be looked at rather than shipped. None of
them is wired into the site; they are static pages served from the repo root so
they can borrow the real fonts and the real palette, and nothing else about
them is shared with `src/`.

```sh
python3 -m http.server 4180 --directory .
SCALE=1 CHROME=/opt/pw-browsers/chromium \
  node proto/shoot.mjs http://localhost:4180/proto/1-resolution.html proto/screenshots 1-resolution
```

`shoot.mjs` renders 1440 and 390, then re-renders the 1440 first screen inside a
300px frame — the thumbnail an Awwwards juror sees before anything else, and
the width that decides whether a text-only site is opened at all.

`measure.mjs` reports the advance width of each step of the name in ems, at the
weight and tracking it is actually set in. The chosen direction sizes type from
the width of the page rather than from a scale, so it needs that number; CSS has
no unit for "the width of this string".

| File | Thesis |
| --- | --- |
| `0-baseline-*` (screenshots only) | The site as it stood after ten critique passes. |
| `1-resolution.html` | The site's claim is a name being made legible without being flattened, so set that transformation — composed, decomposed, transliterated, resolved — at display scale as the first thing on the page. **Chosen.** |
| `2-weight-authorship.html` | Schibsted Grotesk's 400–900 axis encodes authorship: what was imposed is set light, what was chosen is set heavy, so the colour of a page maps the argument before a word is read. |
| `3-ledger.html` | Numerals are the only part of this record a stranger can read without knowing one of its nouns, so set the four figures at the size of the claim and let the sentences caption them. |

The reasoning for the choice, and what the other two did better, is in
[`../docs/iteration-log.md`](../docs/iteration-log.md) under "Creativity pass A".

These files are kept as the record of the exploration. They are not maintained:
if the fonts are regenerated or the palette moves, they will drift, and that is
fine.
