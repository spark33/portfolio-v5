/**
 * Every word the site sets, as data.
 *
 * The shape enforces the argument. A case study cannot be written without a
 * constraint, and a decision cannot be written without what it cost — those
 * are required fields, not a convention someone remembers to follow.
 *
 * `{{?}}` marks a number that is not known yet. It renders as a visible
 * placeholder; it is never silently filled in.
 */

export const PENDING = "{{?}}";

export type Meta = { label: string; value: string };

export type Decision = {
  /** Short imperative statement of what was decided. */
  title: string;
  /** What was true before the decision, with a number in it where possible. */
  context: string;
  /** The option not taken, stated fairly enough that it sounds tempting. */
  rejected: string;
  /** What the decision cost. Required. A decision with no cost is a preference. */
  cost: string;
};

export type CaseStudy = {
  slug: string;
  /** The pressure that was there before the work started. Precedes the title. */
  constraint: string;
  title: string;
  /** One sentence, used on the index and as the meta description. */
  summary: string;
  meta: Meta[];
  lede: string;
  decisions: Decision[];
  outcome: string[];
};

export const person = {
  nameKo: "박상현",
  /** Kept as three groups so the syllable structure survives decomposition. */
  nameJamo: ["ㅂㅏㄱ", "ㅅㅏㅇ", "ㅎㅕㄴ"],
  nameRoman: "PARK SANGHYEON",
  nameEn: "Sean Park",
  role: "Head of product and delivery",
  org: "Mindlogic",
  orgKo: "마인드로직",
  location: "Seoul",
  email: "sanghyun.park@mindlogic.ai",
};

/**
 * The name, resolved in four steps. Rendered on the about page only.
 *
 * It answers a question that page has actually asked — its h1 is the name in
 * two scripts — by saying what a reader should call this person and what the
 * English form costs. It was briefly the home page's opening at display scale,
 * which put identity in front of an employer who was there to find out about
 * the work; the reasoning for taking it back off is in docs/iteration-log.md.
 *
 * The four values are derived from `person` rather than retyped, so they
 * cannot drift from the wordmark, the footer or the structured data.
 */
export type NameStep = {
  /** Two digits, like every other counter on the site. */
  n: string;
  /** The operation that produced this form. */
  step: string;
  value: string;
};

export const nameResolution: NameStep[] = [
  { n: "01", step: "Composed", value: person.nameKo },
  { n: "02", step: "Decomposed", value: person.nameJamo.join(" ") },
  { n: "03", step: "Transliterated", value: person.nameRoman },
  { n: "04", step: "Resolved", value: person.nameEn },
];

/**
 * What the last step cost, in the field name every decision here uses.
 */
export const nameCost =
  "Sean is what I answer to in English, and it is the only one of the four " +
  "that loses the name: legible to everyone, and true to no document I own.";

/**
 * The home page, as a person talking.
 *
 * Links live inside sentences rather than in an index. Each `[chip]` names an
 * entity and the fact that makes it mean something to a stranger — the
 * reference this borrows from can lean on logos everyone knows, and every
 * noun here is one nobody has heard of, so the fact does the work a mark
 * would otherwise do.
 *
 * Syntax: [Label|the fact] for a plain chip, [Label|the fact|/href] for a link.
 */
export type Narrative = { kind: "p"; text: string; lead?: boolean };

export const greeting =
  "Hi, I'm Sean Park — 박상현 — and I run product and delivery at Mindlogic in Seoul.";

export const narrative: Narrative[] = [
  { kind: "p", text: "You won't have heard of [Mindlogic|Seoul, 20 people], and that is most of the reason this site exists.", lead: true },
  {
    kind: "p",
    text:
      "For three years I have worked on one product: [FactChat|400+ institutions] — " +
      "a multi-LLM assistant used across Korean universities and public bodies. I own " +
      "architecture, scope, release timelines and the design decisions across an " +
      "eight-person engineering team, I lead three frontend engineers directly, and I " +
      "still ship production code.",
  },
  {
    kind: "p",
    text:
      "None of it was greenfield. The scope was set by a public tender before I was " +
      "involved. The accessibility standard is statutory. The release calendar belongs " +
      "to the procurement cycle. And our users arrived already fluent in a competitor's " +
      "product, so the interface conventions were decided somewhere else too.",
  },
];

/**
 * The claim the site exists to make, as a heading rather than as prose.
 *
 * It used to be the fourth narrative paragraph — "That is the part I actually
 * want to talk about…" — which meant that reading only the headings gave you a
 * greeting, the words "Three constraints" at 11px, and three constraints, with
 * nothing anywhere saying why a constraint is the thing being shown. The
 * argument was in the copy and not in the structure, which is the failure mode
 * this whole site is arranged against.
 */
export const thesis = {
  label: "Three constraints",
  claim: "Designing inside constraints you did not choose is a different skill.",
  support:
    "Three were already true before I arrived. Each produced a decision I can " +
    "defend, including what it cost.",
};

export const closing: Narrative[] = [
  {
    kind: "p",
    text:
      "Alongside the product I wrote [LogicianUI|our design system|/logician-ui/], and " +
      "[the harness|agents, autofixes, auto-merge|/harness/] — the automation that lets " +
      "three frontend engineers hold a surface this wide. I [write about both|notes|/blog/].",
  },
  {
    kind: "p",
    text:
      "I read and write English fluently and work daily in English and Korean. I am " +
      "looking for somewhere with real constraints and the honesty to say so.",
  },
];

/**
 * The record. One constant, rendered in the home margin and on the about page
 * — it used to be two (`position` and `evidence.figures`) carrying the same
 * four numbers, which is two places for them to drift apart.
 */
export const record: Meta[] = [
  { label: "Institutions", value: "400+" },
  { label: "Re-contract", value: "100%" },
  { label: "Registered", value: "180k+" },
  { label: "Peak weekly", value: "53k" },
];

export const recordCaption =
  "Every institution that has reached the end of a contract has renewed. " +
  "Term-time peaks around 900,000 messages a week.";

export const caseStudies: CaseStudy[] = [
  {
    slug: "inherited-mental-model",
    constraint: "Users arrived already fluent in someone else's interface.",
    title: "An inherited mental model",
    summary:
      "Designing a multi-LLM product for people who had already learned " +
      "ChatGPT, and deciding which of its conventions to keep.",
    meta: [
      { label: "Role", value: "Product, design, delivery" },
      { label: "Team", value: "8 engineers · 3 frontend" },
      { label: "Period", value: "2023 — 2026" },
      { label: "Surface", value: "400+ institutions" },
    ],
    lede:
      "FactChat is a multi-LLM assistant deployed across Korean universities " +
      "and public institutions. By the time it reached a student, that student " +
      "had already used ChatGPT. The interface was not a blank page — it was a " +
      "set of expectations we had inherited from a competitor, and every " +
      "departure from it would be read as a defect rather than a difference.",
    decisions: [
      {
        title: "Match the inherited model, then break it exactly once.",
        context:
          "Prior fluency is an asset until you contradict it. Students landed " +
          "expecting a thread list, streaming tokens, and a message they could " +
          "edit and resend. Every one of those we reproduced was a support " +
          "ticket that never got filed.",
        rejected:
          "A distinct interaction paradigm — a document canvas with the model " +
          "as a margin collaborator. It demoed well, and it was the only version " +
          "of the product that looked like it had been designed rather than " +
          "copied.",
        cost:
          "The product is derivative in a screenshot, which is the format sales " +
          "and procurement see it in first. I have had to make this argument " +
          "again at the start of nearly every institutional pilot.",
      },
      {
        title: "Put model choice in front of the user, not behind a setting.",
        context:
          "Being multi-LLM is the reason the product exists — it is what an " +
          "institution is buying when it will not commit its data to a single " +
          "vendor. The competitor hides model selection because it sells one " +
          "family of models. We had the opposite incentive and copied the " +
          "pattern anyway for two releases.",
        rejected:
          "A single abstracted assistant that silently routes to whichever " +
          "model suits the request. Cleaner, less to explain, and genuinely " +
          "better for a first-time user.",
        cost:
          "It puts a decision in front of someone who did not ask for one, and " +
          "it moved a support burden onto institutional admins who now field " +
          "'which one should I use' from their own students.",
      },
      {
        title: "Treat the accessibility standard as the floor for everyone.",
        context:
          "Korean public institutions procure against a statutory accessibility " +
          "standard. It is a compliance gate, and the cheap way through is a " +
          "parallel accessible mode that satisfies an auditor.",
        rejected:
          "A separate compliant view. It would have shipped in a fraction of " +
          "the time and passed the same audit.",
        cost:
          "Keyboard and screen-reader paths through a streaming, stateful chat " +
          "surface are genuinely hard, and holding one code path to that bar " +
          "slowed feature work for roughly two quarters.",
      },
    ],
    outcome: [
      "Peak load during term runs around 53,000 weekly actives and 900,000 " +
        "messages a week, against 180,000+ registered users.",
      "Every institution that has reached the end of a contract has renewed — " +
        "a 100% re-contract rate across three years.",
      "The canvas concept was not wasted. It came back as the structure " +
        "underneath the learning path in a later project, where the users had " +
        "no inherited model to contradict.",
    ],
  },
  {
    slug: "two-concepts-one-product",
    constraint: "Two features had become one idea in everyone's head but the IA.",
    title: "Two concepts, one product",
    summary:
      "Collapsing agents and add-ons into a single concept, and migrating an " +
      "information architecture across 400+ live tenants without a downtime window.",
    meta: [
      { label: "Role", value: "Architecture, scope, release" },
      { label: "Team", value: "8 engineers · 3 frontend" },
      { label: "Period", value: "2025" },
      { label: "Surface", value: "400+ tenants" },
    ],
    lede:
      "Agents and add-ons were built eighteen months apart by different people " +
      "solving different problems. By 2025 users described both as 'the things " +
      "you can add', support answered questions about them interchangeably, and " +
      "only the navigation still insisted they were separate. The information " +
      "architecture had become the last place in the company that believed its " +
      "own original distinction.",
    decisions: [
      {
        title: "Collapse both into one concept rather than clarify the boundary.",
        context:
          "The distinction was real to the codebase and invisible to users. " +
          "Two years of copy revisions had failed to teach it, which is usually " +
          "evidence that the distinction is not worth teaching.",
        rejected:
          "Keeping both and fixing the labelling. Far cheaper, reversible, and " +
          "defensible — the underlying capabilities genuinely do differ in what " +
          "they can access.",
        cost:
          "A capability that only ever applied to one of the two now has to be " +
          "explained as a property of a single concept, which is a worse " +
          "explanation than the one we removed. We traded a structural problem " +
          "for a copy problem, deliberately.",
      },
      {
        title: "Migrate every tenant at once, with old URLs kept alive.",
        context:
          "400+ institutions on independent academic calendars. There is no " +
          "hour of the year when all of them are idle, and no shared maintenance " +
          "window to negotiate.",
        rejected:
          "A per-tenant migration flag, rolled out institution by institution. " +
          "The standard safe answer, and the one I would give another team.",
        cost:
          "Two information architectures alive in one codebase for a quarter " +
          "would have doubled the surface every subsequent feature had to " +
          "support. Instead we carried permanent URL redirects and a compatibility " +
          "layer that is still there, and I expect it to outlive me.",
      },
      {
        title: "Ship the admin migration before the student-facing one.",
        context:
          "Institutional admins retrain their own users. If they meet a changed " +
          "IA at the same moment their students do, the support load lands on " +
          "them with no preparation.",
        rejected:
          "A simultaneous cutover, which is simpler to reason about and avoids " +
          "a period where admin and student vocabulary disagree.",
        cost:
          "Six weeks where documentation, admin UI, and student UI used two " +
          "different names for the same object. Support articles had to be " +
          "written twice.",
      },
    ],
    outcome: [
      "The restructure shipped across all tenants in a single release with no " +
        "scheduled downtime.",
      "Support volume on the agents/add-ons distinction: " + PENDING + ".",
      "The compatibility layer is still in the codebase. It was the price of " +
        "the cutover and it was worth paying, but it is a real, permanent cost " +
        "and I would rather name it than round it off.",
    ],
  },
  {
    slug: "no-reason-to-return",
    constraint: "No grade, no credit, no manager. Attendance was the whole problem.",
    title: "Students with no reason to return",
    summary:
      "A voluntary, unassessed learning path for 한국장학재단, designed for " +
      "people with no external reason to come back on day two.",
    meta: [
      { label: "Role", value: "Product, design" },
      { label: "Client", value: "한국장학재단" },
      { label: "Period", value: "2025 — 2026" },
      { label: "Assessment", value: "None" },
    ],
    lede:
      "The Korea Student Aid Foundation commissioned a learning path with no " +
      "grade attached, no credit, and no one checking. Every mechanism a course " +
      "normally uses to produce attendance had been removed by the brief before " +
      "we started. What was left was whether the thing itself was worth " +
      "returning to — which is the only honest version of the problem, and the " +
      "hardest one.",
    decisions: [
      {
        title: "Make progress legible instead of rewarding it.",
        context:
          "The default answer to voluntary retention is points, streaks and " +
          "badges. They work on a population that has already decided to " +
          "participate, and they read as condescending to adults who have not.",
        rejected:
          "A points and streak system. It is well-evidenced, the client " +
          "expected it, and it would have moved day-7 numbers.",
        cost:
          "We gave up the easy early metric. A legibility-based design has a " +
          "flatter, slower curve, and it is much harder to show progress to a " +
          "public-sector client at a quarterly review with a flat curve.",
      },
      {
        title: "Let the path be abandoned and resumed without penalty.",
        context:
          "The realistic user is a student who does two sessions, disappears " +
          "for five weeks during exams, and comes back. Most course software " +
          "treats that as failure and greets them with everything they missed.",
        rejected:
          "Scheduled cohorts with a fixed pace, which produce far better " +
          "completion statistics because they exclude the people who cannot " +
          "keep pace.",
        cost:
          "Completion rate as a headline number becomes close to meaningless, " +
          "so we had to define and defend a different measure of success to the " +
          "client before launch rather than after.",
      },
      {
        title: "No notifications.",
        context:
          "A public institution sending push reminders to students about a " +
          "voluntary programme reads as an obligation, which is precisely the " +
          "framing the brief had removed.",
        rejected:
          "Re-engagement notifications — the single highest-leverage retention " +
          "lever available, and one the client had already paid for the " +
          "infrastructure to send.",
        cost:
          "Measurably lower return rates in the first month. This is the " +
          "decision on this project I am least sure about.",
      },
    ],
    outcome: [
      "Return rate at week four: " + PENDING + ".",
      "Completion, on the measure agreed before launch: " + PENDING + ".",
      "The client accepted a non-completion success measure, which took longer " +
        "to negotiate than the design took to build.",
    ],
  },
];

/** A documented section: a heading, prose, and optionally one table. */
export type DocSection = {
  heading: string;
  body: string[];
  table?: { head: string[]; rows: string[][] };
};

export type Artifact = {
  slug: string;
  constraint: string;
  title: string;
  summary: string;
  meta: Meta[];
  lede: string;
  sections: DocSection[];
};

export const artifacts: Artifact[] = [
  {
    slug: "logician-ui",
    constraint: "A design system nobody has been given time to maintain.",
    title: "LogicianUI",
    summary:
      "Mindlogic's design system: token architecture, a golden-ratio colour " +
      "ramp, and component APIs built to be maintained by people whose main job " +
      "is something else.",
    meta: [
      { label: "Role", value: "Author, maintainer" },
      { label: "Consumers", value: "3 frontend engineers" },
      { label: "Coverage", value: PENDING },
      { label: "Status", value: "In production" },
    ],
    lede:
      "A design system with no dedicated team is a liability unless it is " +
      "cheaper to use than to bypass. LogicianUI is built around that single " +
      "constraint: every decision below trades expressiveness for the property " +
      "that a busy engineer reaches for it by default.",
    sections: [
      {
        heading: "Token architecture",
        body: [
          "Three tiers, and the rule that a component may only ever read from " +
            "the third. Primitives hold raw values and are never referenced " +
            "directly. Semantic tokens name a role. Component tokens name a part.",
          "The tiering exists so that a rebrand touches one file and a component " +
            "author cannot accidentally couple to a hex value. It is also the " +
            "part of the system most often ignored under deadline, so the lint " +
            "rule that enforces it matters more than the documentation that " +
            "describes it.",
        ],
        table: {
          head: ["Tier", "Example", "Who may read it"],
          rows: [
            ["Primitive", "blue-60", "Semantic tokens only"],
            ["Semantic", "surface-accent", "Component tokens, page CSS"],
            ["Component", "button-bg-pressed", "That component"],
          ],
        },
      },
      {
        heading: "Golden-ratio colour derivation",
        body: [
          "Ramps are derived rather than hand-picked. Lightness steps are " +
            "spaced by a golden-ratio progression and chroma is held to a " +
            "perceptual curve, so a new hue produces a ramp with the same " +
            "contrast behaviour as every existing one without a designer " +
            "tuning eleven swatches.",
          "The point is not mathematical elegance. It is that contrast pairs " +
            "hold automatically: any semantic token at step n against a surface " +
            "at step n±5 clears WCAG AA by construction, which removes an entire " +
            "category of review comment.",
        ],
      },
      {
        heading: "Component APIs",
        body: [
          "Props describe intent, never appearance. A component takes " +
            "`tone=\"critical\"`, never `color=\"red\"`, so that a change in what " +
            "critical looks like is a token change rather than a codemod across " +
            "the product.",
          "Every component ships its own keyboard and focus behaviour, because " +
            "the accessibility standard the product is procured against cannot " +
            "be satisfied at the page level if the primitives leak.",
        ],
      },
      {
        heading: "Coverage",
        body: [
          "Coverage is measured as the share of rendered product surface using " +
            "system components rather than the share of components documented — " +
            "the second number flatters, the first one is actionable.",
          "Current coverage: " + PENDING + ". Components in the system: " + PENDING + ".",
        ],
      },
    ],
  },
  {
    slug: "harness",
    constraint: "The tender was written for a team we do not have.",
    title: "The harness",
    summary:
      "The automation — agent skills, automated bugfixes, auto-merged " +
      "dependency PRs — that lets a three-person chapter hold a very wide product.",
    meta: [
      { label: "Role", value: "Author" },
      { label: "Team held", value: "3 frontend engineers" },
      { label: "Surface", value: "400+ tenants" },
      { label: "Status", value: "In production" },
    ],
    lede:
      "The frontend chapter is three people. The product they are responsible " +
      "for was scoped by tenders written for larger teams. The gap is not " +
      "closed by working harder; it is closed by moving a specific class of " +
      "work off people entirely, and being honest that the class is narrow.",
    sections: [
      {
        heading: "What is automated, and what deliberately is not",
        body: [
          "Automation is applied where the work is well-specified, verifiable " +
            "by a test, and low-variance: dependency upgrades, mechanical " +
            "refactors, lint and codemod application, and bugfixes whose " +
            "reproduction is already captured in a failing test.",
          "It is not applied to anything requiring a judgement about scope or " +
            "a trade-off between users, because the review cost of a wrong " +
            "answer there exceeds the cost of doing it by hand.",
        ],
      },
      {
        heading: "Agent skills",
        body: [
          "Repeated tasks are captured as skills — a written procedure plus the " +
            "commands and checks that verify it — rather than as prompts held in " +
            "someone's head. A skill is reviewable in a pull request, which " +
            "means the automation is subject to the same standard as the code.",
          "This is the part with the clearest payoff: it turns tacit " +
            "knowledge held by whoever built a subsystem into something a new " +
            "engineer or an agent can execute identically.",
        ],
      },
      {
        heading: "Dependency PRs",
        body: [
          "Dependency updates are opened, tested and merged without a human in " +
            "the loop when the test suite passes and the change is within a " +
            "semver range the policy allows. Anything outside that lands as a " +
            "normal pull request for review.",
          "The value is not the time saved per upgrade. It is that the " +
            "dependency graph never drifts far enough to make a security patch " +
            "a project.",
        ],
      },
      {
        heading: "What it costs",
        body: [
          "The harness is itself a system that needs maintenance, and it is " +
            "maintained by the same three people. When it breaks it fails " +
            "quietly, and a quietly broken automation is worse than no " +
            "automation because the team has already stopped checking.",
          "Time recovered per engineer per week: " + PENDING + ".",
        ],
      },
    ],
  },
];

/**
 * The about page uses the same section shape as an artifact, so it renders
 * through the same code and inherits the same rail. As three unlabelled
 * paragraphs it had exactly one heading on the whole page — the name — and its
 * body copy was indented past a rail that never held anything.
 */
export const about = {
  lede:
    "I am head of product and delivery at Mindlogic in Seoul. I own " +
    "architecture, scope, release timelines, and design and feature decisions " +
    "across an eight-person engineering team, lead a three-person frontend " +
    "chapter directly, and sit in a product organisation of about twenty. I " +
    "still ship production code.",
  sections: [
    {
      heading: "One product, three years",
      body: [
        "The work is one product, FactChat — a multi-LLM assistant deployed in " +
          "more than 400 Korean universities and public institutions, with " +
          "180,000+ registered users and a peak of around 53,000 weekly actives " +
          "during term.",
      ],
    },
    {
      heading: "None of it was greenfield",
      body: [
        "The scope of a public tender is set before a designer is involved. The " +
          "accessibility standard is statutory. The procurement cycle decides " +
          "the release calendar. The company's position is fast-follower, so the " +
          "interface conventions were set by a competitor with more users than " +
          "we will have.",
        "Those are the conditions, and they are not unusual — they are what most " +
          "product work looks like once the company is old enough to have " +
          "customers.",
      ],
    },
    {
      heading: "What I am looking for",
      body: [
        "Somewhere with real constraints and the honesty to say so. I read and " +
          "write English fluently and work daily in both English and Korean.",
      ],
    },
  ],
};

/**
 * The page a reader reaches by mistake.
 *
 * Written in the same grammar as everything else: the condition first, the
 * name of it second. A 404 is the one page whose whole job is to be useful
 * about a dead end, so it carries the work index rather than an apology.
 */
export const notFound = {
  code: "404",
  constraint: "Nothing is published at this address.",
  title: "Not found",
  lede:
    "The address may have changed, or it may never have existed. Everything " +
    "the site holds is on this page.",
};

/**
 * Three items. It was five, two of which were individual artifact pages while
 * "Work" — the thing the site is for — had no slot at all, so returning from a
 * case study meant going to the home page and scrolling past the narrative.
 */
export const nav = [
  { href: "/work/", label: "Work" },
  { href: "/blog/", label: "Writing" },
  { href: "/about/", label: "About" },
];
