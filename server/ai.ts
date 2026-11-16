// Every AI feature in Mokio is one task: a prompt, a JSON schema, and who may run it.
import { LAYOUTS, NAV_INFO, KINDS, NAVS, type Action } from "../client/src/lib/catalog.ts";

const str = { type: "string" } as const;
const int = { type: "integer" } as const;
const arr = (items: object) => ({ type: "array", items });
const obj = (props: Record<string, object>, required = Object.keys(props)) => ({
  type: "object", properties: props, required, additionalProperties: false,
});
const kind = { type: "string", enum: KINDS } as const;
const nav = { type: "string", enum: NAVS } as const;
const variant = { type: "integer", minimum: 0, maximum: 2 } as const;

const CATALOG = `The house toolkit draws every screen as one of these kinds, each with three layout variants (0, 1, 2):
${KINDS.map((k) => `- ${k}: ${LAYOUTS[k].map((l, i) => `${i} "${l.name}" (${l.why})`).join("; ")}`).join("\n")}
Navigation is one of: ${NAVS.map((n) => `${n} "${NAV_INFO[n].name}" (${NAV_INFO[n].why})`).join("; ")}.`;

const SYSTEM = `You are Claude working inside Mokio, a tool where product teams design app prototypes with you.
Screens are drawn from a fixed toolkit, so you change a prototype by choosing screen kinds, layout variants and navigation, and by writing to the spec.
Write plainly and briefly, in British-neutral product English. Never invent features the input does not support.
${CATALOG}`;

const specEntry = obj({
  kind: { type: "string", enum: ["term", "role", "business", "design", "flow", "decision", "question"] },
  title: str, text: str,
});

export interface Task {
  action: Action;
  prompt: (input: any) => string;
  schema: object;
}

const j = (x: unknown) => JSON.stringify(x, null, 1);

export const TASKS: Record<string, Task> = {
  draftPrototype: {
    action: "create",
    prompt: (i) => `Draft a new prototype from this brief.
Name: ${i.name}
Platform: ${i.platform}; framework: ${i.framework}
Brief: ${i.brief}

Return a one-line tagline, 4-6 navigation items, 8 realistic sample record titles for the seed table, 2-5 user roles,
the navigation style, and 5-12 screens grouped into flows (the first flow usually "Access" with a sign-in screen).
Pick the kind and layout variant that fit each screen. Screen names are short ("Board", "Card detail").`,
    schema: obj({
      tagline: str, nav, navItems: arr(str), items: arr(str), roles: arr(str),
      screens: arr(obj({ name: str, flow: str, kind, variant })),
    }),
  },

  reviewRound: {
    action: "send",
    prompt: (i) => `A reviewer sent round ${i.round} of comments on the prototype "${i.project.name}" (${i.project.tagline}).
Spec entries already agreed:
${j(i.spec)}
Comments (each pinned to an element of a screen):
${j(i.comments)}

Answer every comment, in order, by id.
- outcome "done": say in one or two sentences what you changed, and list the files you touched (screens/<ScreenName>.tsx, toolkit/<Widget>.tsx, tokens.css).
- outcome "asking": only when the comment is a real question that needs a product decision. Give 2-3 short answer options and change nothing.
- record: for a "change" comment that states a rule worth holding on other screens, give a design or business spec entry. Otherwise null.
  If an agreed spec entry already covers it, say so in the reply and give null.`,
    schema: obj({
      replies: arr(obj({
        id: str, outcome: { type: "string", enum: ["done", "asking"] }, reply: str,
        files: arr(str), options: arr(str), record: { anyOf: [specEntry, { type: "null" }] },
      })),
    }),
  },

  optionsRound: {
    action: "pick",
    prompt: (i) => `Draw ${i.want} different takes on the screen "${i.screen.name}" (kind ${i.screen.kind}) of "${i.project.name}".
Now: layout variant ${i.screen.variant}, navigation ${i.project.nav}.
What the team wants to explore: ${i.prompt}
Already on the board (do not repeat): ${j(i.existing)}
Each option is a navigation plus a layout variant of the same kind; make them differ in the way the prompt cares about.
Write a short note per option saying what it is good for.`,
    schema: obj({ options: arr(obj({ nav, variant, note: str })) }),
  },

  prReview: {
    action: "approve",
    prompt: (i) => `Review pull request #${i.pr.id} "${i.pr.title}" (${i.pr.from} into ${i.pr.into}) of the prototype "${i.project.name}".
About: ${i.pr.about}
Branch is ${i.behind} commits behind ${i.pr.into}.
Changes on the branch: ${j(i.changes)}
Screens: ${j(i.screens)}
Spec on the branch: ${j(i.spec)}

Find what a careful design reviewer would: conflicts with the base branch, broken spec rules, inconsistent patterns,
design gaps (missing empty, error or loading states), incomplete flows, and direction concerns.
level: "block" must fix before merging, "warn" worth a look, "note" for information. Give a concrete fix where one exists.
Use screenId and ruleId values from the input, or empty strings. Return 2-6 findings, most serious first.`,
    schema: obj({
      findings: arr(obj({
        kind: { type: "string", enum: ["conflict", "rule", "pattern", "gap", "incomplete", "direction"] },
        level: { type: "string", enum: ["block", "warn", "note"] },
        title: str, detail: str, fix: str, screenId: str, ruleId: str,
      })),
    }),
  },

  specAsk: {
    action: "spec",
    prompt: (i) => `Someone asked you to change the spec of "${i.project.name}".
Request: ${i.text}
Earlier questions you asked and their answers: ${j(i.dialog)}
Screens: ${j(i.screens)}
Spec now:
${j(i.spec)}

Work out which entries the request touches. Ids look like T-1 (term), R-1 (role), BR-1 (business rule), DR-1 (design rule), F-1 (flow), D-1 (decision), Q-1 (question).
- If the request clashes with an agreed business or role rule, or is ambiguous, set status "asking" with one question and 2-3 options. Ask at most once per open point.
- Otherwise set status "proposed" with the edits: "put" adds or replaces an entry (reuse the id to replace; use an empty id for a new one), "drop" removes one by id.
- If nothing should change, set status "done" and explain.
Keep the reply to one or two sentences.`,
    schema: obj({
      status: { type: "string", enum: ["asking", "proposed", "done"] },
      reply: str, question: str, options: arr(str),
      edits: arr(obj({
        op: { type: "string", enum: ["put", "drop"] }, id: str,
        kind: { type: "string", enum: ["term", "role", "business", "design", "flow", "decision", "question"] },
        title: str, text: str, screens: arr(str),
      })),
    }),
  },

  briefPlan: {
    action: "brief",
    prompt: (i) => `Plan a brief for the prototype "${i.project.name}" before changing anything.
Brief: ${i.text}
Scope: ${i.scope}
Screens in scope (id, name, kind, variant, review status): ${j(i.screens)}
Current navigation: ${i.project.nav}
Spec: ${j(i.spec)}
Draft review comments not yet sent: ${j(i.drafts)}

Return:
- title: the brief in under 9 words.
- reading: ids of agreed spec entries that bear on this work.
- steps: one per screen you would change or add. For an existing screen use its id; for a new screen set newScreen with a fresh name, flow and kind.
  Give the target layout variant and navigation, and say what changes in one line.
- rules: sentences from the brief that should become spec entries ("must", "never", "only"...).
- questions: what you need decided first. Always include key "land" with options ["A new branch and a pull request", "Straight onto the current branch, as uncommitted changes"].
  If the brief clashes with an agreed rule, add key "conflict" naming the rule id in ruleId. If approved screens are in scope, add key "approved".`,
    schema: obj({
      title: str, reading: arr(str),
      steps: arr(obj({
        screenId: str, name: str, what: str, variant, nav,
        newScreen: { anyOf: [obj({ name: str, flow: str, kind }), { type: "null" }] },
      })),
      rules: arr(specEntry),
      questions: arr(obj({ key: str, q: str, options: arr(str), ruleId: str })),
    }),
  },

  dsAdjust: {
    action: "editLibrary",
    prompt: (i) => `Adjust this design system's generator settings to match the request.
Request: ${i.ask}
Now: ${j(i.system)}
Ranges: accentHue 0-360, accentChroma 0.04-0.26, accentL 0.4-0.85, neutralHue 0-360, neutralChroma 0-0.03, contrast 0-1, radius 0-18, density comfortable|compact.
Only change what the request asks for. In "said", list each change in a few words ("accent hue 275° to 185° (teal)").
If the request cannot map to these settings, change nothing and explain in said.`,
    schema: obj({
      patch: obj({
        accentHue: { type: "number" }, accentChroma: { type: "number" }, accentL: { type: "number" },
        neutralHue: { type: "number" }, neutralChroma: { type: "number" }, contrast: { type: "number" },
        radius: { type: "number" }, density: { type: "string", enum: ["comfortable", "compact"] },
      }, []),
      said: arr(str),
    }),
  },

  dsCapture: {
    action: "create",
    prompt: (i) => `Capture a design system from a ${i.kind} reference: ${i.ref}
Name: ${i.name}
Infer an accent hue and chroma, lightness, neutral tint, corner radius, density, and fonts.
Fonts must come from: Hanken Grotesk, Inter, Instrument Sans, Space Grotesk, Bricolage Grotesque (headings and text); DM Mono, JetBrains Mono (data).
Write a one-sentence note describing the look.`,
    schema: obj({
      note: str, accentHue: { type: "number" }, accentChroma: { type: "number" }, accentL: { type: "number" },
      neutralHue: { type: "number" }, neutralChroma: { type: "number" }, radius: int,
      density: { type: "string", enum: ["comfortable", "compact"] }, display: str, sans: str, mono: str,
    }),
  },

  commitMessage: {
    action: "commit",
    prompt: (i) => `Write a one-line git commit message (under 72 characters, no trailing period) for these prototype changes:
${j(i.changes)}`,
    schema: obj({ message: str }),
  },
};

export const SYSTEM_PROMPT = SYSTEM;
