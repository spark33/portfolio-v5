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
 * The four steps of the name motif. `groups` keeps the decomposed step split
 * into syllables so the row reads as three parts rather than nine loose
 * letters — the point of the step is that the parts are still organised.
 */
export const nameSequence = [
  { step: "Composed", groups: [person.nameKo], note: "Three syllable blocks" },
  { step: "Decomposed", groups: person.nameJamo, note: "Nine jamo, still in three groups" },
  { step: "Transliterated", groups: [person.nameRoman], note: "Mechanical — a table did this" },
  { step: "Resolved", groups: [person.nameEn], note: "Chosen — nothing derived it" },
];

/**
 * The home field, as blocks on the board.
 *
 * `weight` is initiative: the highest holds its intersection and everything
 * else yields around it, so the whitespace is allocated by rank. `h` is the
 * block's height in lattice cells — declared, because the solver runs at build
 * time and cannot measure text. `tests/board.spec.ts` checks every one of
 * these against the real rendered height and tells you the right number when
 * it drifts, so treat a failure there as an instruction rather than a puzzle.
 */
export type HeroBlock = {
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
  weight: number;
  label: string;
  /** Rendered at display size. Line breaks are deliberate. */
  claim?: string[];
  body?: string;
  stat?: string;
  note?: string;
};

export const heroBlocks: HeroBlock[] = [
  {
    id: "claim",
    col: 1,
    row: 0.5,
    w: 11,
    h: 2.75,
    weight: 4,
    label: "Position",
    claim: ["The board was not empty", "when I sat down."],
  },
  {
    id: "lede",
    col: 1,
    row: 0.5,
    w: 6,
    h: 2.25,
    weight: 2,
    label: "",
    body:
      "Head of product and delivery at Mindlogic, Seoul. Three years, one " +
      "product — a multi-LLM assistant in 400+ Korean universities and public " +
      "institutions. Every decision answered something already on the board.",
  },
  {
    id: "position",
    col: 13,
    row: 0.5,
    w: 5,
    h: 1.5,
    weight: 3,
    label: "Position",
    stat: "400+  100%  180k",
    note: "institutions · re-contract · registered",
  },
  {
    id: "also",
    col: 13,
    row: 0.5,
    w: 5,
    h: 1.25,
    weight: 1,
    label: "Also built",
    note: "LogicianUI, the design system. The harness, the automation under it.",
  },
];

export const thesis =
  "I have never designed in a vacuum. Every system I have worked in was " +
  "already there when I arrived — the scope set by a public tender before I " +
  "was involved, the accessibility law, the procurement cycle, the users who " +
  "showed up already fluent in someone else's product. Designing well inside " +
  "constraints you did not choose is a different skill from designing in the " +
  "open, and it is the one almost every company hiring actually needs.";

export const position: Meta[] = [
  { label: "Institutions", value: "400+" },
  { label: "Re-contract", value: "100%" },
  { label: "Registered", value: "180k+" },
  { label: "One product", value: "3 years" },
];

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

export type Artifact = {
  slug: string;
  constraint: string;
  title: string;
  summary: string;
  meta: Meta[];
  lede: string;
  sections: { heading: string; body: string[]; table?: { head: string[]; rows: string[][] } }[];
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

export const about = {
  lede:
    "I am head of product and delivery at Mindlogic in Seoul. I own " +
    "architecture, scope, release timelines, and design and feature decisions " +
    "across an eight-person engineering team, lead a three-person frontend " +
    "chapter directly, and sit in a product organisation of about twenty. I " +
    "still ship production code.",
  body: [
    "The work is one product, FactChat, over three years — a multi-LLM " +
      "assistant deployed in more than 400 Korean universities and public " +
      "institutions, with 180,000+ registered users and a peak of around 53,000 " +
      "weekly actives during term.",
    "None of it was greenfield. The scope of a public tender is set before a " +
      "designer is involved. The accessibility standard is statutory. The " +
      "procurement cycle decides the release calendar. The company's position " +
      "is fast-follower, so the interface conventions were set by a competitor " +
      "with more users than we will have. Those are the conditions, and they " +
      "are not unusual — they are what most product work looks like once the " +
      "company is old enough to have customers.",
    "What I am looking for is somewhere with real constraints and the honesty " +
      "to say so. I read and write English fluently and work daily in both " +
      "English and Korean.",
  ],
};

export const nav = [
  { href: "/", label: "Index" },
  { href: "/logician-ui/", label: "LogicianUI" },
  { href: "/harness/", label: "Harness" },
  { href: "/blog/", label: "Writing" },
  { href: "/about/", label: "About" },
];
