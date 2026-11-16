import type { Kind, Nav, Role } from "./catalog";

export type ScreenStatus = "approved" | "changes" | "unreviewed";
export interface Screen { id: string; name: string; flow: string; kind: Kind; variant: number; status: ScreenStatus; mock: number }
export type Platform = "web" | "desktop" | "mobile";

export interface Project {
  id: string; name: string; tagline: string; platform: Platform; dsId: string; toolkit: string; framework: string;
  branch: string; updated: string; nav: Nav; navItems: string[]; items: string[]; roles: string[]; screens: Screen[];
  drafting?: number;
}

export interface Pins { light: Record<string, string>; dark: Record<string, string> }
export interface DesignSystem {
  id: string; name: string; source: { kind: string; ref: string }; note: string;
  accentHue: number; accentChroma: number; accentL: number; neutralHue: number; neutralChroma: number; contrast: number;
  radius: number; density: "comfortable" | "compact"; display: string; sans: string; mono: string;
  pins: Pins; themes: { name: string; hue: number }[]; log: { id: string; ask: string; reply: string }[];
}

export interface ViewState { mode: "light" | "dark"; device: "desktop" | "tablet" | "phone"; as: string }
export type CommentKind = "fix" | "change" | "question";
export type CommentStatus = "draft" | "queued" | "working" | "done" | "asking" | "accepted";
export interface Comment {
  id: string; projectId: string; screenId: string; el: string; elLabel: string; kind: CommentKind; author: string;
  state: ViewState; status: CommentStatus; text: string; round?: number; reply?: string; files?: string[];
  ask?: { options: string[]; picked?: string }; reopened?: boolean;
}

export interface Option { id: string; nav: Nav; variant: number; starred: boolean; note: string }
export interface Round {
  id: string; projectId: string; screenId: string; by: string; when: string; want: number;
  status: "generating" | "open" | "applying" | "applied"; picked?: string; prompt: string; options: Option[];
}

export type EntryKind = "term" | "role" | "business" | "design" | "flow" | "decision" | "question";
export interface Entry {
  id: string; kind: EntryKind; title: string; text: string; status: "agreed" | "proposed" | "open";
  screens: string[]; source: string; auto?: boolean;
}
export interface Spec { purpose: string; users: string; entries: Entry[] }

export interface LayoutRef { variant: number; nav: Nav }
export interface SpecChange { put?: Entry; drop?: string; prev?: Entry | null; intro?: Partial<Spec>; prevIntro?: Partial<Spec> }
export interface Change {
  file: string; what: string; screenId?: string; from?: LayoutRef; to?: LayoutRef; spec?: SpecChange; add?: Screen;
}
export interface Commit { id: string; msg: string; by: string; when: string; changes: Change[]; pushed: boolean; merge?: boolean }
export interface Branch {
  name: string; base: string; by: string; behind: number; incoming: Commit[]; remote: boolean; commits: Commit[];
  merged?: boolean; snapshot?: { nav: Nav; screens: Screen[]; spec?: Spec };
}
export interface Finding {
  id: string; kind: "conflict" | "rule" | "pattern" | "gap" | "incomplete" | "direction"; level: "block" | "warn" | "note";
  state: "open" | "fixed" | "waived"; screenId?: string; ruleId?: string; title: string; detail: string; fix?: string;
}
export interface PR {
  id: number; title: string; from: string; into: string; by: string; when: string; status: "open" | "merged";
  review: "none" | "running" | "done"; approvals: string[]; about: string; findings: Finding[];
}
export interface Repo { remote: string; current: string; fetched: string; working: Change[]; branches: Branch[]; prs: PR[] }

export interface PlanStep { screenId: string; name: string; what: string; on: boolean; done?: boolean; from?: LayoutRef; to: LayoutRef; add?: Screen }
export interface PlanRule { kind: EntryKind; title: string; text: string; on: boolean }
export interface PlanQ { key: string; q: string; options: string[]; a: number; ruleId?: string }
export interface Brief {
  id: string; projectId: string; by: string; when: string; status: "planning" | "planned" | "running" | "done";
  scope: "app" | "flow" | "pins"; flow?: string; pins?: string[]; branch?: string; pr?: number; title: string; text: string;
  reading: string[]; steps: PlanStep[]; rules: PlanRule[]; questions: PlanQ[];
}

export interface Note {
  id: string; projectId: string; kind: "record" | "ask"; text: string; by: string; when: string;
  status: "recorded" | "thinking" | "asking" | "proposed" | "applied" | "discarded" | "done";
  answers: number[]; dialog: { q: string; options: string[]; picked?: number }[]; changes: Change[];
  reply?: string; link?: string; branch?: string;
}

export interface Data {
  projects: Project[]; systems: DesignSystem[]; comments: Comment[]; rounds: Round[];
  repos: Record<string, Repo>; specs: Record<string, Spec>; briefs: Brief[]; notes: Note[];
}

export interface Person { id: string; name: string; role: Role; initials: string; tone: number; does: string; email?: string }
