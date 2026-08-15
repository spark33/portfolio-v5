---
title: Notes on building this site
date: 2026-04-02
summary: A second post, so the index has something to sort. Delete it whenever.
tags: [placeholder, meta]
draft: true
---

> Placeholder, and marked `draft: true` — so it renders in `npm run dev` and is
> left out of `npm run build`. That is the whole draft mechanism.

Drafts are useful for exactly one thing: seeing a post typeset before deciding
whether it is worth finishing. The index in dev shows it with a flag; production
never learns it exists.

## Adding a post

Drop a markdown file in `content/posts/`. The filename may carry a date prefix
for ordering on disk — `2026-04-02-notes-on-this-site.md` — which is stripped
from the URL. Only `title` and `date` are required.
