import type { Meta, StoryObj } from "@storybook/html-vite";

/**
 * The three pieces the site is built from, in isolation.
 *
 * All of them are rendered server-side by lib/pages.ts; these are here so a
 * spacing or scale change can be judged without scrolling a whole page.
 */
const meta: Meta = { title: "System" };
export default meta;

/**
 * A row of labelled fields — the site's one repeating layout primitive. It
 * carries the name's encodings, a project's role and period, and the parts of
 * every decision. The repetition is the argument, so this is the piece to
 * check first when the rhythm feels off.
 */
export const Strip: StoryObj = {
  render: () => `
    <dl class="strip position">
      <div class="strip-cell">
        <dt class="label">Institutions</dt><dd class="strip-value">400+</dd>
      </div>
      <div class="strip-cell">
        <dt class="label">Re-contract</dt><dd class="strip-value">100%</dd>
      </div>
      <div class="strip-cell">
        <dt class="label">Registered</dt><dd class="strip-value">180k+</dd>
      </div>
      <div class="strip-cell">
        <dt class="label">One product</dt><dd class="strip-value">3 years</dd>
      </div>
    </dl>
  `,
};

/**
 * The constraint is the heading and the project name is subordinate to it, so
 * the pressure cannot be read after the title. Hover to check the arrow easing.
 */
export const IndexRow: StoryObj = {
  render: () => `
    <ol class="index">
      <li class="index-row">
        <a class="index-link" href="#">
          <span class="index-n micro">01</span>
          <span class="index-body">
            <span class="index-constraint display-m">Users arrived already fluent in someone else's interface.</span>
            <span class="index-title">An inherited mental model</span>
          </span>
          <span class="index-meta">
            <span class="micro">2023 — 2026</span>
            <span class="micro">400+ institutions</span>
            <span class="index-arrow" aria-hidden="true">&rarr;</span>
          </span>
        </a>
      </li>
      <li class="index-row">
        <a class="index-link" href="#">
          <span class="index-n micro">02</span>
          <span class="index-body">
            <span class="index-constraint display-m">Two features had become one idea in everyone's head but the IA.</span>
            <span class="index-title">Two concepts, one product</span>
          </span>
          <span class="index-meta">
            <span class="micro">2025</span>
            <span class="micro">400+ tenants</span>
            <span class="index-arrow" aria-hidden="true">&rarr;</span>
          </span>
        </a>
      </li>
    </ol>
  `,
};

/**
 * Context, the option not taken, and what it cost. `COST` is required and
 * carries the second of the accent's three uses; a decision without one is a
 * preference, and the content types will not let it be written.
 */
export const Decision: StoryObj = {
  render: () => `
    <div class="case-body">
      <section class="decision">
        <p class="label decision-n">Decision 01</p>
        <h2 class="decision-title">Match the inherited model, then break it exactly once.</h2>
        <dl class="decision-fields">
          <div class="field">
            <dt class="label">Context</dt>
            <dd>Prior fluency is an asset until you contradict it. Students landed
            expecting a thread list, streaming tokens, and a message they could edit
            and resend. Every one of those we reproduced was a support ticket that
            never got filed.</dd>
          </div>
          <div class="field">
            <dt class="label">Rejected</dt>
            <dd>A distinct interaction paradigm — a document canvas with the model as
            a margin collaborator. It demoed well, and it was the only version of the
            product that looked like it had been designed rather than copied.</dd>
          </div>
          <div class="field field-cost">
            <dt class="label">Cost</dt>
            <dd>The product is derivative in a screenshot, which is the format sales
            and procurement see it in first.</dd>
          </div>
        </dl>
      </section>
    </div>
  `,
};

/**
 * One row of the name sequence. Sizes are a share of the row's own width, so
 * resize the preview and every encoding should keep filling the measure
 * exactly.
 */
export const NameStep: StoryObj = {
  render: () => `
    <ol class="name-steps">
      <li class="name-step" data-step="0">
        <p class="name-meta">
          <span class="label">Composed</span>
          <span class="micro name-note">Three syllable blocks</span>
        </p>
        <p class="name-value"><span class="name-group" lang="ko">박상현</span></p>
      </li>
      <li class="name-step" data-step="3">
        <p class="name-meta">
          <span class="label">Resolved</span>
          <span class="micro name-note">Chosen — nothing derived it</span>
        </p>
        <p class="name-value"><span class="name-group">Sean Park</span></p>
      </li>
    </ol>
  `,
};
