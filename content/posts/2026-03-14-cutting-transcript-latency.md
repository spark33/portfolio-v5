---
title: Cutting transcript latency from 4.2s to 380ms
date: 2026-03-14
summary: >-
  A realtime speech pipeline that buffered too eagerly, rebuilt around
  incremental decoding and backpressure that the client could actually observe.
tags: [placeholder, realtime, latency]
---

> Placeholder copy, carried over from the type specimen. Replace it with a real
> post — the frontmatter above is the whole authoring contract.

## The problem

The pipeline transcribed audio in fixed three-second windows, which meant nobody
saw a word until the window closed and the decoder finished. Median
time-to-first-token was 4.2 seconds. Users read that delay as the product being
broken rather than being slow, and support tickets described it as "frozen" more
often than "laggy" — a distinction that changed how we prioritised the work.

The window size was not arbitrary. Shorter windows had been tried and abandoned
because accuracy at the boundaries collapsed: the decoder had no context to
disambiguate a word cut in half, so `recognise` came back as `wreck a nice` often
enough to be embarrassing.

## Decisions

### Incremental decoding over smaller windows

We kept a long context window but emitted partial hypotheses as the decoder
walked it, marking tokens unstable until the window closed.

Rejected: simply shrinking the window to 500ms. It hit the latency target and
lost 6 points of word error rate at segment boundaries — a trade the transcript
quality could not absorb.

### Backpressure the client can see

The stream carries an explicit `lag_ms` field, so the UI can show that it is
behind rather than silently buffering.

Rejected: dropping audio under load. It kept the numbers healthy and made
failures invisible, which is how the original problem survived a year of
dashboards that looked fine.

```js
// Tokens are emitted unstable, then confirmed in place.
stream.on("hypothesis", ({ tokens, lagMs }) => {
  transcript.merge(tokens, { stable: false });
  meter.report(lagMs);
});
```

## Outcome

Median time-to-first-token settled at 380ms and p99 at 1.1s, with word error rate
within half a point of the original. The unstable-token rendering was the part
users noticed: an early build reflowed the paragraph on every correction, which
tested worse than the original delay. Freezing layout and correcting in place
fixed it.

What did not work: an attempt to predict stability from decoder confidence alone.
Confidence turned out to be poorly calibrated near boundaries — the exact place it
needed to be trustworthy — and we fell back to positional rules.
