// Everything that changes prototype data. AI steps call Claude Code through the server.
import type {
  Brief, Change, Comment, Data, DesignSystem, Entry, EntryKind, Finding, LayoutRef, Note, Project, Repo, Screen, Spec,
} from "./types";
import { LAYOUTS, NAV_INFO, type Kind, type Nav } from "./catalog";
import { M, Ai, Ni, Mi, Pi, Fi } from "./seed.js";
import { runAi } from "./api";
import {
  ai, account as acct, data, firstName, getData, mutate, pascal, person, replaceData, slug, store, toast, uid, useStore, effectiveRole,
} from "./store";
import { can, WHY_NOT, type Action } from "./catalog";

export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sentence = (s: string) => { const t = s.trim().replace(/\s+/g, " "); return cap(/[.!?]$/.test(t) ? t : `${t}.`); };
const shortTitle = (s: string) => {
  const w = s.trim().replace(/[.!?].*$/s, "").split(/\s+/);
  return cap(w.length <= 9 ? w.join(" ") : `${w.slice(0, 7).join(" ").replace(/[,;:]$/, "")}…`);
};
const fail = (e: unknown) => toast(e instanceof Error ? e.message : String(e), { go: { label: "Open Settings", path: "/settings" } });

/** True when AI is available; otherwise says why and points to Settings. */
export function aiReady() {
  const s = ai.get();
  if (!s.on) toast(s.why, { go: { label: "Open Settings", path: "/settings" } });
  return s.on;
}
export function allowed(a: Action) {
  if (can(effectiveRole(), a)) return true;
  toast(WHY_NOT[a]);
  return false;
}

// ---- Repo and spec access ----------------------------------------------------
export const repoView = (d: Data, p: Project): Repo => d.repos[p.id] ?? Pi(p);
export const specView = (d: Data, p: Project): Spec => d.specs[p.id] ?? Fi(p);
function repoOf(d: Data, id: string) { const p = d.projects.find((x) => x.id === id); return p ? (d.repos[id] ??= Pi(clone(p))) : undefined; }
function specOf(d: Data, id: string) { const p = d.projects.find((x) => x.id === id); return p ? (d.specs[id] ??= Fi(clone(p))) : undefined; }
export const changeKey = (c: Change) => (c.spec ? `${c.file}#${c.spec.put?.id ?? c.spec.drop ?? "intro"}` : c.file);
const branchOf = (r: Repo, name: string) => r.branches.find((b) => b.name === name);

/** Add a change to the working tree, folding repeat edits of the same file or entry together. */
function record(d: Data, projectId: string, c: Change) {
  const r = repoOf(d, projectId);
  if (!r) return;
  const k = changeKey(c), i = r.working.findIndex((w) => changeKey(w) === k);
  if (i < 0) { r.working.push(c); return; }
  const old = r.working[i];
  const merged: Change = { ...c, ...(old.from ? { from: old.from } : {}) };
  if (c.spec && old.spec) {
    merged.spec = { ...c.spec, ...("prev" in old.spec ? { prev: old.spec.prev } : {}), ...(old.spec.prevIntro ? { prevIntro: old.spec.prevIntro } : {}) };
    if (merged.spec.drop && merged.spec.prev === null) { r.working.splice(i, 1); return; }
  }
  r.working[i] = merged;
}
function applySpec(s: Spec, c: NonNullable<Change["spec"]>) {
  if (c.intro) Object.assign(s, c.intro);
  if (c.drop) s.entries = s.entries.filter((e) => e.id !== c.drop);
  if (c.put) {
    const i = s.entries.findIndex((e) => e.id === c.put!.id);
    if (i >= 0) s.entries[i] = clone(c.put); else s.entries.push(clone(c.put));
  }
}
function undoSpec(s: Spec, c: NonNullable<Change["spec"]>) {
  if (c.prevIntro) Object.assign(s, c.prevIntro);
  const id = c.put?.id ?? c.drop;
  if (id) { s.entries = s.entries.filter((e) => e.id !== id); if (c.prev) s.entries.push(clone(c.prev)); }
}
type Snap = { nav: Nav; screens: Screen[]; spec?: Spec };
function applyChanges(s: Snap, cs: Change[], reset = false) {
  for (const c of cs) {
    if (c.spec && s.spec) applySpec(s.spec, c.spec);
    if (c.add && !s.screens.some((x) => x.id === c.add!.id)) s.screens.push({ ...c.add });
    const sc = s.screens.find((x) => x.id === c.screenId);
    if (c.to) { if (sc) sc.variant = c.to.variant; s.nav = c.to.nav; }
    if (sc && reset) sc.status = "unreviewed";
  }
}
function applyToProject(d: Data, p: Project, cs: Change[], reset = false) {
  applyChanges(p as Snap, cs, reset);
  const s = specOf(d, p.id);
  if (s) for (const c of cs) if (c.spec) applySpec(s, c.spec);
}
/** How a branch's screens and spec look, built from its base plus its commits. */
export function branchSnapshot(d: Data, p: Project, name: string, depth = 0): Required<Snap> {
  const r = repoView(d, p), here = { nav: p.nav, screens: p.screens, spec: specView(d, p) };
  if (name === r.current || depth > 4) return here;
  const b = branchOf(r, name);
  if (!b) return here;
  if (b.snapshot) return { ...b.snapshot, spec: b.snapshot.spec ?? here.spec } as Required<Snap>;
  const s = clone(b.base === name ? here : branchSnapshot(d, p, b.base, depth + 1));
  applyChanges(s, [...b.commits].reverse().flatMap((c) => c.changes));
  return s;
}
const SPEC_PREFIX: Record<EntryKind, string> = { term: "T", role: "R", business: "BR", design: "DR", flow: "F", decision: "D", question: "Q" };
export function nextId(s: Spec, kind: EntryKind) {
  const pre = `${SPEC_PREFIX[kind]}-`;
  return `${pre}${s.entries.filter((e) => e.id.startsWith(pre)).reduce((m, e) => Math.max(m, Number(e.id.slice(pre.length)) || 0), 0) + 1}`;
}
function addNote(d: Data, n: Partial<Note> & Pick<Note, "projectId" | "kind" | "text" | "by" | "status">) {
  d.notes.unshift({ id: uid("n"), answers: [], dialog: [], changes: [], when: "Just now", ...n });
}
const screenFile = (name?: string) => `screens/${pascal(name ?? "Screen")}.tsx`;

// ---- Review comments -----------------------------------------------------------
export const reviewBusy = store<string | null>(null);
export const useReviewBusy = () => useStore(reviewBusy);

export function addComment(c: Omit<Comment, "id" | "status">) {
  const id = uid("c");
  mutate((d) => {
    d.comments.push({ ...c, id, status: "draft" });
    const s = d.projects.find((p) => p.id === c.projectId)?.screens.find((x) => x.id === c.screenId);
    if (s) s.status = "changes";
  });
  return id;
}
export const editComment = (id: string, patch: Partial<Comment>) => mutate((d) => { const c = d.comments.find((x) => x.id === id); if (c) Object.assign(c, patch); });
export function removeComment(id: string) {
  const before = getData();
  mutate((d) => { d.comments = d.comments.filter((c) => c.id !== id); });
  toast("Comment removed.", { undo: () => replaceData(before) });
}
const lastRound = (d: Data, pid: string) => d.comments.filter((c) => c.projectId === pid).reduce((m, c) => Math.max(m, c.round ?? 0), 0);

export async function sendRound(projectId: string) {
  if (!aiReady() || !allowed("send") || reviewBusy.get()) return;
  const d = getData(), p = d.projects.find((x) => x.id === projectId);
  const drafts = d.comments.filter((c) => c.projectId === projectId && c.status === "draft");
  if (!p || !drafts.length) return;
  const round = lastRound(d, projectId) + 1, ids = drafts.map((c) => c.id);
  mutate((x) => { for (const c of x.comments) if (ids.includes(c.id)) Object.assign(c, { status: "working", round }); });
  reviewBusy.set(projectId);
  try {
    const spec = specView(d, p).entries.filter((e) => e.status === "agreed" && (e.kind === "design" || e.kind === "business"));
    const out = await runAi<{ replies: { id: string; outcome: "done" | "asking"; reply: string; files: string[]; options: string[]; record: { kind: EntryKind; title: string; text: string } | null }[] }>(
      "reviewRound",
      {
        round, project: { name: p.name, tagline: p.tagline }, spec: spec.map((e) => ({ id: e.id, title: e.title, text: e.text })),
        comments: drafts.map((c) => ({
          id: c.id, kind: c.kind, element: c.elLabel, screen: p.screens.find((s) => s.id === c.screenId)?.name, text: c.text,
          seenIn: `${c.state.mode}, ${c.state.device}, as ${c.state.as}`,
        })),
      },
    );
    let files = new Set<string>();
    mutate((x) => {
      const proj = x.projects.find((q) => q.id === projectId)!;
      for (const r of out.replies) {
        const c = x.comments.find((q) => q.id === r.id);
        if (!c) continue;
        const sc = proj.screens.find((s) => s.id === c.screenId);
        if (r.outcome === "asking") {
          Object.assign(c, { status: "asking", reply: r.reply, files: [], ask: { options: r.options.length >= 2 ? r.options : ["Yes", "No, leave it as it is"] } });
          continue;
        }
        let reply = r.reply;
        if (r.record && c.kind === "change") {
          const s = specOf(x, projectId)!, kind = r.record.kind === "business" ? "business" : "design";
          const e: Entry = {
            id: nextId(s, kind), kind, title: r.record.title || `${c.elLabel}${sc ? ` on ${sc.name}` : ""}`, text: sentence(r.record.text),
            status: "agreed", screens: [c.screenId], source: `Review round ${round}, ${firstName(c.author)} on ${sc?.name ?? "a screen"}`, auto: true,
          };
          s.entries.push(e);
          record(x, projectId, Ni(clone(e), `${e.id} recorded from review round ${round}`));
          addNote(x, {
            projectId, kind: "record", status: "recorded", by: "claude",
            text: `Recorded ${e.id} from ${firstName(c.author)}'s comment on ${sc?.name ?? "a screen"} in review round ${round}: ${e.text}`,
            link: `/p/${projectId}/review/${c.screenId}/sent`, branch: repoOf(x, projectId)?.current,
          });
          reply += ` Recorded as ${e.id} in the spec, so it holds on other screens too.`;
        }
        const fs = r.files.length ? r.files : [screenFile(sc?.name)];
        fs.forEach((f) => files.add(f));
        Object.assign(c, { status: "done", reply, files: fs });
        for (const f of fs) record(x, projectId, { file: f, what: `Review round ${round}: ${c.elLabel}`, ...(f.startsWith("screens/") ? { screenId: c.screenId } : {}) });
      }
      for (const c of x.comments) if (ids.includes(c.id) && c.status === "working") Object.assign(c, { status: "done", reply: "Done." });
    });
    toast(`Claude finished round ${round}: ${drafts.length} comments, ${files.size} files changed.`);
  } catch (e) {
    mutate((x) => { for (const c of x.comments) if (ids.includes(c.id)) { c.status = "draft"; delete c.round; } });
    fail(e);
  } finally {
    reviewBusy.set(null);
  }
}

/** Answer a question Claude asked in a review round; the answer becomes a decision in the spec. */
export function decide(commentId: string, answer: string) {
  if (!allowed("comment")) return;
  let newId = "";
  mutate((d) => {
    const c = d.comments.find((x) => x.id === commentId), p = d.projects.find((x) => x.id === c?.projectId);
    if (!c || !p || c.status !== "asking") return;
    const s = specOf(d, p.id)!, sc = p.screens.find((x) => x.id === c.screenId), who = firstName(c.author);
    newId = nextId(s, "decision");
    const e: Entry = {
      id: newId, kind: "decision", title: shortTitle(c.text.replace(/\?$/, "")), text: sentence(answer), status: "agreed",
      screens: [c.screenId], source: `Review round ${c.round}, ${who} asked on ${sc?.name ?? "a screen"}`, auto: true,
    };
    const words = new Set(c.text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
    const q = s.entries.find((x) => x.kind === "question" && [...new Set(`${x.title} ${x.text}`.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((w) => words.has(w)).length >= 2);
    if (q) { s.entries = s.entries.filter((x) => x.id !== q.id); record(d, p.id, { file: Mi("question"), what: `${q.id} settled by ${newId}`, spec: { drop: q.id, prev: clone(q) } }); }
    s.entries.push(e);
    record(d, p.id, Ni(clone(e), `${newId} decided in review round ${c.round}`));
    const f = screenFile(sc?.name);
    record(d, p.id, { file: f, what: `Review round ${c.round}: ${c.elLabel}`, screenId: c.screenId });
    Object.assign(c, {
      status: "done", ask: { ...c.ask!, picked: answer }, files: [f],
      reply: `${answer}: done. I changed ${sc?.name ?? "the screen"} to match and recorded it as ${newId}${q ? `, which settles ${q.id}` : ""}.`,
    });
    addNote(d, {
      projectId: p.id, kind: "record", status: "recorded", by: "claude",
      text: `Recorded ${newId} after asking about ${who}'s comment on ${sc?.name ?? "a screen"}: ${e.text}${q ? ` It settles ${q.id}.` : ""}`,
      link: `/p/${p.id}/review/${c.screenId}/sent`, branch: repoOf(d, p.id)?.current,
    });
  });
  if (newId) toast(`Recorded as ${newId} in the spec.`);
}
export const acceptReply = (id: string) => mutate((d) => { const c = d.comments.find((x) => x.id === id); if (c) c.status = "accepted"; });
export const acceptRound = (pid: string, round: number) =>
  mutate((d) => { for (const c of d.comments) if (c.projectId === pid && c.round === round && c.status === "done") c.status = "accepted"; });
export function reopen(id: string) {
  mutate((d) => { const c = d.comments.find((x) => x.id === id); if (c) Object.assign(c, { status: "draft", reopened: true }); });
  toast("Back in the draft. Add what is still wrong, then send it with the next round.");
}
export const setScreenStatus = (pid: string, sid: string, status: Screen["status"]) =>
  mutate((d) => { const s = d.projects.find((p) => p.id === pid)?.screens.find((x) => x.id === sid); if (s) s.status = status; });

// ---- Prototypes ------------------------------------------------------------------
export const SAMPLE: Omit<Project, "id" | "name"> = {
  tagline: "", platform: "web", dsId: "", toolkit: "", framework: "", branch: "", updated: "", nav: "side",
  navItems: ["Home", "Work", "People", "Reports", "Settings"],
  items: ["Plan the spring release", "Review supplier quotes", "Update the price list", "Book the team offsite", "Fix the export format", "Draft the status update", "Renew the certificate", "Tidy the archive"],
  roles: ["Admin", "Member"], screens: [],
};
const TEMPLATES: Record<Project["platform"], { nav: Nav; rows: [string, string, Kind, number][] }> = {
  web: { nav: "side", rows: [["Sign in", "Access", "auth", 0], ["Home", "Core", "dashboard", 0], ["List", "Core", "table", 0], ["Detail", "Core", "detail", 0], ["Activity", "Core", "inbox", 0], ["Members", "Admin", "table", 1], ["Settings", "Admin", "settings", 0]] },
  desktop: { nav: "rail", rows: [["First run", "Onboarding", "auth", 1], ["Main window", "App", "table", 1], ["Detail", "App", "detail", 0], ["Activity", "App", "inbox", 1], ["Preferences", "App", "settings", 0]] },
  mobile: { nav: "top", rows: [["Sign in", "Access", "auth", 2], ["Today", "Core", "dashboard", 1], ["List", "Core", "inbox", 1], ["Detail", "Core", "detail", 1], ["Profile", "Core", "settings", 1]] },
};
const freeId = (taken: Set<string>, base: string) => { let id = base; while (taken.has(id)) id += "-2"; return id; };
const toScreens = (rows: { name: string; flow: string; kind: Kind; variant: number }[], approvedFirst = 0): Screen[] => {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const id = freeId(seen, slug(r.name) || `screen-${i + 1}`); seen.add(id);
    return { id, name: r.name, flow: r.flow, kind: r.kind, variant: Math.max(0, Math.min(2, r.variant)), status: i < approvedFirst ? "approved" : "unreviewed", mock: r.kind === "auth" ? 0 : 1 + (r.name.length % 3) };
  });
};

export function createProject(f: { name: string; brief: string; platform: Project["platform"]; dsId: string; framework: string }) {
  const id = freeId(new Set(getData().projects.map((p) => p.id)), slug(f.name) || "untitled");
  const t = TEMPLATES[f.platform];
  const screens = toScreens(t.rows.map(([name, flow, kind, variant]) => ({ name, flow, kind, variant })));
  const useAi = ai.get().on;
  mutate((d) => {
    d.projects.unshift({
      ...SAMPLE, id, name: f.name.trim(), tagline: f.brief.trim().split(/[.\n]/)[0].slice(0, 80) || "New prototype",
      platform: f.platform, dsId: f.dsId, toolkit: "House kit", framework: f.framework, branch: "main", updated: "Just now",
      nav: t.nav, screens, ...(useAi ? { drafting: screens.length } : {}),
    });
  });
  if (!useAi) { toast(`Created ${f.name.trim()} from the ${f.framework} template. AI is off, so nothing was drafted from the brief.`); return id; }
  runAi<{ tagline: string; nav: Nav; navItems: string[]; items: string[]; roles: string[]; screens: { name: string; flow: string; kind: Kind; variant: number }[] }>(
    "draftPrototype", { name: f.name, brief: f.brief, platform: f.platform, framework: f.framework },
  ).then((o) => {
    mutate((d) => {
      const p = d.projects.find((x) => x.id === id);
      if (!p) return;
      Object.assign(p, {
        tagline: o.tagline, nav: o.nav, navItems: o.navItems.length ? o.navItems : p.navItems, items: o.items.length ? o.items : p.items,
        roles: o.roles.length ? o.roles : p.roles, screens: o.screens.length ? toScreens(o.screens) : p.screens,
      });
      delete p.drafting;
      const r = repoOf(d, id);
      if (r) r.branches[0].commits = [
        M(`Draft ${p.screens.length} screens from the brief`, "claude", "Just now", p.screens.slice(0, 6).map((s) => Ai(s, "New screen"))),
        M(`Start ${p.name} from ${p.framework}`, account().id, "Just now", [{ file: "mokio.json", what: "Manifest, seed table and tokens" }]),
      ];
      d.specs[id] = Fi(clone(p));
      d.specs[id].purpose = `${p.name}: ${f.brief.trim()}`;
    });
    toast(`Claude drafted ${getData().projects.find((x) => x.id === id)?.screens.length ?? 0} screens for ${f.name.trim()}.`);
  }).catch((e) => { mutate((d) => { const p = d.projects.find((x) => x.id === id); if (p) delete p.drafting; }); fail(e); });
  return id;
}
const account = () => acct.get().user ?? person("claude");

export function duplicateProject(id: string) {
  if (!allowed("create")) return;
  mutate((d) => {
    const p = d.projects.find((x) => x.id === id);
    if (!p) return;
    const nid = freeId(new Set(d.projects.map((x) => x.id)), `${p.id}-copy`);
    d.projects.splice(d.projects.indexOf(p) + 1, 0, { ...clone(p), id: nid, name: `${p.name} copy`, branch: "main", updated: "Just now" });
  });
  toast("Duplicated. Comments and option rounds were not copied.");
}
export function archiveProject(id: string) {
  if (!allowed("archive")) return;
  const before = getData(), name = before.projects.find((p) => p.id === id)?.name;
  mutate((d) => { d.projects = d.projects.filter((p) => p.id !== id); });
  toast(`${name} archived.`, { undo: () => replaceData(before) });
}
export function setProjectSystem(pid: string, dsId: string) {
  mutate((d) => {
    const p = d.projects.find((x) => x.id === pid);
    if (!p) return;
    p.dsId = dsId;
    record(d, pid, { file: "tokens.css", what: `Design system: ${d.systems.find((s) => s.id === dsId)?.name ?? dsId}` });
  });
}
/** Clone a prototype from a repository address. Cloning is simulated; nothing is fetched. */
export function cloneRepo(address: string) {
  const base = (address.replace(/\.git$/, "").split(/[/:]/).pop() ?? "cloned").replace(/-prototype$/, "");
  const name = base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const id = freeId(new Set(getData().projects.map((p) => p.id)), slug(base) || "cloned");
  const t = TEMPLATES.web;
  mutate((d) => {
    const p: Project = {
      ...SAMPLE, id, name, tagline: `Cloned from ${address.replace(/^git@|^https:\/\//, "").replace(/\.git$/, "")}`, platform: "web",
      dsId: d.systems[0]?.id ?? "", toolkit: "House kit", framework: "React + Tailwind (web)", branch: "main", updated: "Just now",
      nav: t.nav, screens: toScreens(t.rows.map(([name, flow, kind, variant]) => ({ name, flow, kind, variant })), 3),
    };
    d.projects.unshift(p);
    d.repos[id] = { ...Pi(p), remote: address, fetched: "Just now" };
  });
  return id;
}

// ---- Option rounds ---------------------------------------------------------------
const takenBy = (opts: { nav: Nav; variant: number }[], cur: LayoutRef) => (n: Nav, v: number) =>
  (n === cur.nav && v === cur.variant) || opts.some((o) => o.nav === n && o.variant === v);

export async function newRound(f: { projectId: string; screenId: string; prompt: string; want: number; by: string }) {
  if (!aiReady() || !allowed("pick")) return "";
  const d = getData(), p = d.projects.find((x) => x.id === f.projectId), s = p?.screens.find((x) => x.id === f.screenId);
  if (!p || !s) return "";
  const id = uid("r");
  mutate((x) => { x.rounds.unshift({ ...f, id, when: "Just now", options: [], status: "generating" }); });
  runAi<{ options: { nav: Nav; variant: number; note: string }[] }>("optionsRound", {
    project: { name: p.name, nav: p.nav }, screen: { name: s.name, kind: s.kind, variant: s.variant }, prompt: f.prompt, want: f.want, existing: [],
  }).then((o) => {
    const taken = takenBy([], { nav: p.nav, variant: s.variant });
    const seen: { nav: Nav; variant: number }[] = [];
    for (const opt of o.options) if (!taken(opt.nav, opt.variant) && !seen.some((x) => x.nav === opt.nav && x.variant === opt.variant)) seen.push(opt);
    mutate((x) => {
      const r = x.rounds.find((q) => q.id === id);
      if (!r) return;
      r.options = o.options.filter((opt) => seen.includes(opt)).slice(0, f.want).map((opt, i) => ({ id: `${id}-${i}`, nav: opt.nav, variant: opt.variant, starred: false, note: opt.note }));
      if (!r.options.length) r.options = o.options.slice(0, f.want).map((opt, i) => ({ id: `${id}-${i}`, nav: opt.nav, variant: opt.variant, starred: false, note: opt.note }));
      r.status = "open";
    });
  }).catch((e) => { mutate((x) => { const r = x.rounds.find((q) => q.id === id); if (r) r.status = "open"; }); fail(e); });
  return id;
}
export async function moreLikeThis(roundId: string, optionId: string) {
  if (!aiReady() || !allowed("pick")) return;
  const d = getData(), r = d.rounds.find((x) => x.id === roundId), p = d.projects.find((x) => x.id === r?.projectId), s = p?.screens.find((x) => x.id === r?.screenId);
  const o = r?.options.find((x) => x.id === optionId);
  if (!r || !p || !s || !o) return;
  const taken = takenBy(r.options, { nav: p.nav, variant: s.variant });
  const free = (["side", "top", "rail"] as Nav[]).flatMap((n) => [0, 1, 2].map((v) => ({ nav: n, variant: v }))).filter((x) => !taken(x.nav, x.variant));
  if (!free.length) { toast("Every layout in the toolkit for this kind of screen is already on the board."); return; }
  mutate((x) => { const q = x.rounds.find((y) => y.id === roundId); if (q) q.status = "generating"; });
  try {
    const out = await runAi<{ options: { nav: Nav; variant: number; note: string }[] }>("optionsRound", {
      project: { name: p.name, nav: p.nav }, screen: { name: s.name, kind: s.kind, variant: s.variant }, want: 1,
      prompt: `${r.prompt} More like this option: ${NAV_INFO[o.nav].name}, ${LAYOUTS[s.kind][o.variant].name}. ${o.note}`,
      existing: r.options.map((x) => ({ nav: x.nav, variant: x.variant })),
    });
    const pick = out.options.find((x) => !taken(x.nav, x.variant)) ?? free.find((x) => x.nav === o.nav || x.variant === o.variant) ?? free[0];
    mutate((x) => {
      const q = x.rounds.find((y) => y.id === roundId);
      if (q) { q.options.push({ id: uid("o"), nav: pick.nav, variant: pick.variant, starred: false, note: (pick as { note?: string }).note ?? "" }); q.status = "open"; }
    });
  } catch (e) {
    mutate((x) => { const q = x.rounds.find((y) => y.id === roundId); if (q) q.status = "open"; });
    fail(e);
  }
}
export const patchOption = (rid: string, oid: string, patch: Partial<{ starred: boolean; note: string }>) =>
  mutate((d) => { const o = d.rounds.find((r) => r.id === rid)?.options.find((x) => x.id === oid); if (o) Object.assign(o, patch); });
export const pickOption = (rid: string, oid: string | undefined) => { if (allowed("pick")) mutate((d) => { const r = d.rounds.find((x) => x.id === rid); if (r) r.picked = oid; }); };

export function applyOption(roundId: string, opts: { nav: boolean; screens: string[] }) {
  if (!allowed("apply")) return;
  const before = getData(), r = before.rounds.find((x) => x.id === roundId), o = r?.options.find((x) => x.id === r.picked);
  const p = before.projects.find((x) => x.id === r?.projectId);
  if (!r || !o || !p) return;
  mutate((d) => { const q = d.rounds.find((x) => x.id === roundId); if (q) q.status = "applying"; });
  window.setTimeout(() => {
    let n = 0;
    mutate((d) => {
      const q = d.rounds.find((x) => x.id === roundId)!, proj = d.projects.find((x) => x.id === p.id)!;
      const navChange = opts.nav && proj.nav !== o.nav;
      const oldNav = proj.nav;
      if (navChange) proj.nav = o.nav;
      for (const s of proj.screens) {
        const layout = opts.screens.includes(s.id) && s.variant !== o.variant, from = { variant: s.variant, nav: oldNav };
        if (layout) s.variant = o.variant;
        if (navChange || layout) {
          record(d, proj.id, Ai(s, layout ? `Layout: ${LAYOUTS[s.kind][from.variant].name} to ${LAYOUTS[s.kind][s.variant].name}` : `Navigation: ${NAV_INFO[from.nav].name} to ${NAV_INFO[proj.nav].name}`, from, { variant: s.variant, nav: proj.nav }));
          s.status = "unreviewed"; n++;
        }
      }
      proj.updated = "Just now"; q.status = "applied";
      const spec = specOf(d, proj.id), sc = proj.screens.find((x) => x.id === q.screenId);
      if (spec && sc) {
        const e: Entry = {
          id: nextId(spec, "decision"), kind: "decision", title: `${sc.name}: ${LAYOUTS[sc.kind][o.variant].name.toLowerCase()}`,
          text: `${sc.name} uses ${LAYOUTS[sc.kind][o.variant].name.toLowerCase()}${opts.nav ? ` with ${NAV_INFO[o.nav].name.toLowerCase()} navigation across the app` : ""}. Chosen over ${q.options.length - 1} other ${q.options.length === 2 ? "option" : "options"}.${o.note ? ` ${sentence(o.note)}` : ""}`,
          status: "agreed", screens: opts.screens.length ? [...opts.screens] : [sc.id], source: `Options round "${q.prompt}"`, auto: true,
        };
        spec.entries.push(e);
        record(d, proj.id, Ni(clone(e), `${e.id} recorded from an options round`));
        addNote(d, { projectId: proj.id, kind: "record", status: "recorded", by: "claude", text: `Recorded ${e.id} when an option was applied to ${sc.name}: ${e.text}`, link: `/p/${proj.id}/options/${q.id}`, branch: repoOf(d, proj.id)?.current });
      }
    });
    toast(`Applied to ${p.name}. ${n} screens changed and need another look.`, { undo: () => replaceData(before), go: { label: "Open screen map", path: `/p/${p.id}` } });
  }, 700);
}

// ---- Design systems ----------------------------------------------------------------
export function patchSystem(id: string, patch: Partial<DesignSystem>) {
  mutate((d) => {
    const s = d.systems.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch);
    const release = (keys: string[]) => { for (const m of ["light", "dark"] as const) for (const k of keys) delete s.pins[m][k]; };
    if ("accentHue" in patch || "accentChroma" in patch || "accentL" in patch) release(["accent", "accentInk", "accentSoft", "accentLine"]);
    if ("neutralHue" in patch || "neutralChroma" in patch) release(["bg", "surface", "sunken", "line", "ink", "muted"]);
    if ("contrast" in patch) release(["ink", "muted", "line", "accent", "accentInk"]);
  });
}
export const pinToken = (id: string, mode: "light" | "dark", key: string, value: string | null) =>
  mutate((d) => { const s = d.systems.find((x) => x.id === id); if (s) { if (value) s.pins[mode][key] = value.toUpperCase(); else delete s.pins[mode][key]; } });
export const setThemes = (id: string, themes: DesignSystem["themes"]) => mutate((d) => { const s = d.systems.find((x) => x.id === id); if (s) s.themes = themes; });

const undoable = new Map<string, DesignSystem>();
export const canUndoAdjust = (logId: string) => undoable.has(logId);
export async function adjustSystem(id: string, ask: string) {
  if (!aiReady() || !allowed("editLibrary")) return;
  const s = getData().systems.find((x) => x.id === id);
  if (!s || !ask.trim()) return;
  const logId = uid("l");
  try {
    const { log: _l, pins: _p, themes: _t, ...settings } = s;
    const out = await runAi<{ patch: Partial<DesignSystem>; said: string[] }>("dsAdjust", { ask, system: settings });
    const changed = Object.keys(out.patch).length > 0;
    if (changed) { undoable.set(logId, clone(s)); patchSystem(id, out.patch); }
    mutate((d) => {
      d.systems.find((x) => x.id === id)?.log.push({
        id: logId, ask: ask.trim(),
        reply: changed ? `Changed ${out.said.join("; ")}. Light and dark were regenerated together.` : out.said.join(" ") || "I could not map that to a token change.",
      });
    });
  } catch (e) { fail(e); }
}
export function undoAdjust(id: string, logId: string) {
  const prev = undoable.get(logId);
  if (!prev) return;
  mutate((d) => {
    const i = d.systems.findIndex((x) => x.id === id);
    if (i >= 0) d.systems[i] = { ...clone(prev), log: d.systems[i].log.filter((l) => l.id !== logId) };
  });
  undoable.delete(logId);
}
export async function captureSystem(f: { name: string; kind: string; ref: string }) {
  if (!aiReady() || !allowed("create")) return "";
  const out = await runAi<Omit<DesignSystem, "id" | "name" | "source" | "pins" | "themes" | "log" | "contrast">>("dsCapture", f);
  const id = freeId(new Set(getData().systems.map((s) => s.id)), slug(f.name) || "untitled-system");
  mutate((d) => { d.systems.push({ ...out, id, name: f.name.trim(), source: { kind: f.kind, ref: f.ref.trim() }, contrast: 0, pins: { light: {}, dark: {} }, themes: [], log: [] }); });
  return id;
}
export function duplicateSystem(id: string) {
  const s = getData().systems.find((x) => x.id === id);
  if (!s) return null;
  const nid = freeId(new Set(getData().systems.map((x) => x.id)), `${s.id}-copy`);
  mutate((d) => { d.systems.push({ ...clone(s), id: nid, name: `${s.name} copy`, source: { kind: "project", ref: `Copy of ${s.name}` }, log: [] }); });
  return nid;
}

// ---- History: branches, commits, pull requests -----------------------------------------
export const gitBusy = store<string | null>(null);
export const useGitBusy = () => useStore(gitBusy);
const later = (op: string, ms: number, fn: () => void) => { if (gitBusy.get()) return; gitBusy.set(op); window.setTimeout(() => { gitBusy.set(null); fn(); }, ms); };
export const unpushed = (b: { commits: { pushed: boolean }[] }) => b.commits.filter((c) => !c.pushed).length;

export function checkout(pid: string, name: string) {
  if (!allowed("commit")) return;
  const d0 = getData(), p = d0.projects.find((x) => x.id === pid);
  if (!p || repoView(d0, p).current === name || !repoView(d0, p).branches.some((b) => b.name === name)) return;
  const snap = clone(branchSnapshot(d0, p, name));
  mutate((d) => {
    const proj = d.projects.find((x) => x.id === pid)!, r = repoOf(d, pid)!, cur = branchOf(r, r.current);
    if (cur) cur.snapshot = clone({ nav: proj.nav, screens: proj.screens, spec: specOf(d, pid) });
    proj.nav = snap.nav; proj.screens = snap.screens; d.specs[pid] = snap.spec; proj.branch = name; r.current = name;
  });
  const n = getData().repos[pid]?.working.length ?? 0;
  toast(`Switched to ${name}. Screens and spec are as that branch has them.${n ? ` ${n} uncommitted ${n === 1 ? "change" : "changes"} came along.` : ""}`);
}
export function newBranch(pid: string, raw: string, by: string) {
  const name = slug(raw).slice(0, 36), r = getData().repos[pid];
  if (!name || r?.branches.some((b) => b.name === name)) return false;
  mutate((d) => { const x = repoOf(d, pid); x?.branches.push({ name, base: x.current, by, commits: [], behind: 0, incoming: [], remote: false }); });
  checkout(pid, name);
  return true;
}
export function commit(pid: string, msg: string, keys: string[], by: string) {
  if (!allowed("commit")) return;
  mutate((d) => {
    const r = repoOf(d, pid), b = r && branchOf(r, r.current);
    if (!r || !b) return;
    const picked = r.working.filter((c) => keys.includes(changeKey(c)));
    if (!picked.length) return;
    b.commits.unshift(M(msg.trim(), by, "Just now", clone(picked), false));
    r.working = r.working.filter((c) => !keys.includes(changeKey(c)));
    const p = d.projects.find((x) => x.id === pid);
    if (p) p.updated = "Just now";
  });
  toast(`Committed ${keys.length} ${keys.length === 1 ? "change" : "changes"}. Push to share it.`);
}
export async function draftCommitMessage(changes: Change[]) {
  if (!ai.get().on) return "";
  try { return (await runAi<{ message: string }>("commitMessage", { changes: changes.map((c) => `${c.file}: ${c.what}`) })).message; }
  catch { return ""; }
}
export function discard(pid: string, key: string) {
  const before = getData();
  let what = "";
  mutate((d) => {
    const r = repoOf(d, pid), p = d.projects.find((x) => x.id === pid), c = r?.working.find((w) => changeKey(w) === key);
    if (!r || !p || !c) return;
    what = c.spec?.put?.id ?? c.spec?.drop ?? c.file;
    const s = p.screens.find((x) => x.id === c.screenId);
    if (s && c.from) { s.variant = c.from.variant; p.nav = c.from.nav; }
    const spec = specOf(d, pid);
    if (c.spec && spec) undoSpec(spec, c.spec);
    r.working = r.working.filter((w) => changeKey(w) !== key);
  });
  toast(`Discarded the change to ${what}.`, { undo: () => replaceData(before) });
}
export function push(pid: string) {
  if (!allowed("commit")) return;
  later("push", 1100, () => {
    let n = 0;
    mutate((d) => { const r = repoOf(d, pid), b = r && branchOf(r, r.current); if (b) { for (const c of b.commits) if (!c.pushed) { c.pushed = true; n++; } b.remote = true; } });
    toast(n ? `Pushed ${n} ${n === 1 ? "commit" : "commits"} to origin.` : "Branch published to origin.");
  });
}
export function pull(pid: string) {
  if (!allowed("commit")) return;
  later("pull", 1300, () => {
    let n = 0, screens = 0;
    mutate((d) => {
      const r = repoOf(d, pid), p = d.projects.find((x) => x.id === pid), b = r && branchOf(r, r.current);
      if (!r || !p || !b) return;
      n = b.incoming.length;
      const cs = [...b.incoming].reverse().flatMap((c) => c.changes);
      screens = new Set(cs.filter((c) => c.screenId).map((c) => c.screenId)).size;
      applyToProject(d, p, cs, true);
      b.commits.unshift(...b.incoming); b.incoming = []; r.fetched = "Just now";
    });
    toast(n ? `Pulled ${n} ${n === 1 ? "commit" : "commits"}. ${screens} ${screens === 1 ? "screen" : "screens"} changed and need another look.` : "Already up to date.");
  });
}
export function fetchRemote(pid: string) {
  later("fetch", 800, () => {
    mutate((d) => { const r = repoOf(d, pid); if (r) r.fetched = "Just now"; });
    const r = getData().repos[pid], n = r ? branchOf(r, r.current)?.incoming.length ?? 0 : 0;
    toast(n ? `Fetched. ${n} ${n === 1 ? "commit" : "commits"} on origin to pull.` : "Fetched. Nothing new on origin.");
  });
}
export function updateFromBase(pid: string, name: string) {
  mutate((d) => { const r = repoOf(d, pid), b = r && branchOf(r, name); if (b?.behind) { b.commits.unshift(M(`Merge ${b.base} into ${b.name}`, "claude", "Just now", [], false, true)); b.behind = 0; } });
  toast(`${name} now includes everything on its base branch.`);
}
export function openPR(pid: string, f: { from: string; title: string; about: string; by: string }) {
  let id = 0;
  mutate((d) => {
    const r = repoOf(d, pid), b = r && branchOf(r, f.from);
    if (!r || !b) return;
    id = r.prs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    r.prs.unshift({ id, title: f.title.trim(), about: f.about.trim(), from: b.name, into: b.base, by: f.by, when: "Just now", status: "open", review: "none", findings: [], approvals: [] });
    for (const c of b.commits) c.pushed = true;
    b.remote = true;
  });
  return id;
}
const prOf = (d: Data, pid: string, n: number) => repoOf(d, pid)?.prs.find((x) => x.id === n);

export async function reviewPR(pid: string, n: number) {
  if (!aiReady() || !allowed("approve")) return;
  const d = getData(), p = d.projects.find((x) => x.id === pid), r = p && repoView(d, p), pr = r?.prs.find((x) => x.id === n);
  if (!p || !r || !pr || pr.review === "running") return;
  const b = branchOf(r, pr.from), changes = (b?.commits ?? []).flatMap((c) => c.changes);
  mutate((x) => { const q = prOf(x, pid, n); if (q) Object.assign(q, { review: "running", findings: [] }); });
  try {
    const out = await runAi<{ findings: Omit<Finding, "id" | "state">[] }>("prReview", {
      project: { name: p.name }, pr: { id: pr.id, title: pr.title, from: pr.from, into: pr.into, about: pr.about }, behind: b?.behind ?? 0,
      changes: changes.map((c) => ({ file: c.file, what: c.what, screenId: c.screenId })),
      screens: p.screens.map((s) => ({ id: s.id, name: s.name, kind: s.kind, status: s.status })),
      spec: branchSnapshot(d, p, pr.from).spec.entries.map((e) => ({ id: e.id, kind: e.kind, title: e.title, text: e.text, status: e.status })),
    });
    mutate((x) => {
      const q = prOf(x, pid, n);
      if (q) Object.assign(q, { review: "done", findings: out.findings.map((f) => ({ ...f, id: uid("f"), state: "open", screenId: f.screenId || undefined, ruleId: f.ruleId || undefined, fix: f.fix || undefined })) });
    });
  } catch (e) {
    mutate((x) => { const q = prOf(x, pid, n); if (q) q.review = "none"; });
    fail(e);
  }
}
export function fixFinding(pid: string, n: number, fid: string) {
  if (!aiReady() || !allowed("commit")) return;
  mutate((d) => {
    const r = repoOf(d, pid), pr = r?.prs.find((x) => x.id === n), f = pr?.findings.find((x) => x.id === fid), b = r && pr && branchOf(r, pr.from), p = d.projects.find((x) => x.id === pid);
    if (!r || !pr || !f || !b || !p) return;
    f.state = "fixed";
    if (f.kind === "conflict") b.behind = 0;
    const cs: Change[] = [], s = p.screens.find((x) => x.id === f.screenId);
    if (s) cs.push(Ai(s, f.fix ?? f.title));
    const rule = f.ruleId ? branchSnapshot(d, p, pr.from).spec.entries.find((e) => e.id === f.ruleId) : undefined;
    if (rule?.status === "proposed") cs.push(Ni({ ...clone(rule), status: "agreed" }, `${rule.id} agreed`, clone(rule)));
    if (!cs.length) cs.push({ file: "notes/review.md", what: f.fix ?? f.title });
    b.commits.unshift(M(`Fix from review of #${pr.id}: ${f.title.charAt(0).toLowerCase()}${f.title.slice(1)}`, "claude", "Just now", cs));
    const specCs = cs.filter((c) => c.spec);
    if (r.current === b.name) applyToProject(d, p, specCs); else if (b.snapshot) applyChanges(b.snapshot, specCs);
  });
  toast("Claude fixed it on the branch and added a commit.");
}
export const setFinding = (pid: string, n: number, fid: string, state: Finding["state"] = "waived") =>
  mutate((d) => { const f = prOf(d, pid, n)?.findings.find((x) => x.id === fid); if (f) f.state = state; });
export function toggleApproval(pid: string, n: number, who: string) {
  if (!allowed("approve")) return;
  mutate((d) => { const pr = prOf(d, pid, n); if (pr) pr.approvals = pr.approvals.includes(who) ? pr.approvals.filter((x) => x !== who) : [...pr.approvals, who]; });
}
export function merge(pid: string, n: number, by: string) {
  if (!allowed("merge")) return;
  const before = getData();
  let title = "", screens = 0, entries = 0;
  mutate((d) => {
    const r = repoOf(d, pid), p = d.projects.find((x) => x.id === pid), pr = r?.prs.find((x) => x.id === n);
    const from = r && pr && branchOf(r, pr.from), into = r && pr && branchOf(r, pr.into);
    if (!r || !p || !pr || !from || !into) return;
    const cs = clone([...from.commits].reverse().flatMap((c) => c.changes));
    screens = new Set(cs.filter((c) => c.screenId).map((c) => c.screenId)).size;
    entries = new Set(cs.filter((c) => c.spec).map(changeKey)).size;
    if (r.current === into.name) applyToProject(d, p, cs, true);
    else { into.snapshot ??= clone(branchSnapshot(d, p, into.name)); applyChanges(into.snapshot, cs, true); }
    into.commits.unshift(M(`Merge #${pr.id}: ${pr.title}`, by, "Just now", cs, false, true));
    pr.status = "merged"; from.merged = true; from.behind = 0; title = pr.title; p.updated = "Just now";
  });
  toast(`Merged "${title}". ${screens} ${screens === 1 ? "screen" : "screens"}${entries ? ` and ${entries} spec ${entries === 1 ? "entry" : "entries"}` : ""} changed on the target branch.`, { undo: () => replaceData(before) });
}

// ---- Spec ----------------------------------------------------------------------------
export function editIntro(pid: string, intro: { purpose: string; users: string }) {
  mutate((d) => {
    const s = specOf(d, pid);
    if (!s) return;
    const prev = { purpose: s.purpose, users: s.users };
    Object.assign(s, intro);
    record(d, pid, { file: "spec/overview.md", what: "Purpose and users edited", spec: { intro, prevIntro: prev } });
  });
}
export function addEntry(pid: string, e: Omit<Entry, "id">) {
  let id = "";
  mutate((d) => { const s = specOf(d, pid); if (!s) return; id = nextId(s, e.kind); const x = { ...e, id }; s.entries.push(x); record(d, pid, Ni(clone(x), `${id} added: ${e.title}`)); });
  return id;
}
export function editEntry(pid: string, id: string, patch: Partial<Entry>) {
  mutate((d) => {
    const e = specOf(d, pid)?.entries.find((x) => x.id === id);
    if (!e) return;
    const prev = clone(e);
    Object.assign(e, patch);
    record(d, pid, Ni(clone(e), patch.status === "agreed" ? `${id} agreed` : patch.status === "proposed" ? `${id} reopened` : `${id} edited`, prev));
  });
}
export function removeEntry(pid: string, id: string) {
  const before = getData();
  mutate((d) => {
    const s = specOf(d, pid), e = s?.entries.find((x) => x.id === id);
    if (!s || !e) return;
    s.entries = s.entries.filter((x) => x.id !== id);
    record(d, pid, { file: Mi(e.kind), what: `${id} removed`, spec: { drop: id, prev: clone(e) } });
  });
  toast(`${id} removed from the spec. It stays in history.`, { undo: () => replaceData(before) });
}
export function answerQuestion(pid: string, qid: string, answer: string) {
  let id = "";
  mutate((d) => {
    const s = specOf(d, pid), q = s?.entries.find((x) => x.id === qid);
    if (!s || !q) return;
    id = nextId(s, "decision");
    const e: Entry = { id, kind: "decision", title: q.title.replace(/\?$/, ""), text: answer.trim(), status: "agreed", screens: [...q.screens], source: `Answer to ${qid}: "${q.text}"` };
    s.entries = s.entries.filter((x) => x.id !== qid);
    s.entries.push(e);
    record(d, pid, { file: Mi("question"), what: `${qid} answered`, spec: { drop: qid, prev: clone(q) } });
    record(d, pid, Ni(clone(e), `${id} added, answering ${qid}`));
  });
  toast(`Recorded as ${id}. Claude will hold every later change to it.`);
}
export function specDiff(a: Spec, b: Spec) {
  const only = (x: Spec, y: Spec) => x.entries.filter((e) => !y.entries.some((f) => f.id === e.id));
  const changed = a.entries.map((here) => ({ here, there: b.entries.find((e) => e.id === here.id) }))
    .filter((x): x is { here: Entry; there: Entry } => !!x.there && (x.there.text !== x.here.text || x.there.status !== x.here.status || x.there.title !== x.here.title));
  return { onlyHere: only(a, b), onlyThere: only(b, a), changed, intro: a.purpose !== b.purpose || a.users !== b.users };
}
export function specMarkdown(p: Project, s: Spec) {
  const sec = (title: string, kind: EntryKind) => {
    const es = s.entries.filter((e) => e.kind === kind);
    return es.length ? `\n## ${title}\n\n${es.map((e) => `- **${e.id} ${e.title}**${e.status === "agreed" ? "" : ` _(${e.status})_`}: ${e.text}`).join("\n")}\n` : "";
  };
  return `# ${p.name} spec\n\n${s.purpose}\n\n**Who uses it.** ${s.users}\n${sec("Glossary", "term")}${sec("Roles", "role")}${sec("Business rules", "business")}${sec("Design rules", "design")}${sec("Flows", "flow")}${sec("Decisions", "decision")}${sec("Open questions", "question")}`;
}

type SpecEdit = { op: "put" | "drop"; id: string; kind: EntryKind; title: string; text: string; screens: string[] };
function editsToChanges(s: Spec, edits: SpecEdit[], who: string): Change[] {
  const work = clone(s), out: Change[] = [];
  for (const e of edits) {
    const cur = work.entries.find((x) => x.id === e.id);
    if (e.op === "drop") {
      if (!cur) continue;
      out.push({ file: Mi(cur.kind), what: `${cur.id} removed`, spec: { drop: cur.id, prev: clone(cur) } });
      work.entries = work.entries.filter((x) => x.id !== cur.id);
      continue;
    }
    const id = cur ? cur.id : nextId(work, e.kind);
    const entry: Entry = {
      id, kind: cur?.kind ?? e.kind, title: e.title || cur?.title || shortTitle(e.text), text: sentence(e.text),
      status: "agreed", screens: e.screens.length ? e.screens : cur?.screens ?? [], source: cur ? `${cur.source}; reworded, asked by ${who}` : `Asked by ${who}`,
    };
    out.push(Ni(clone(entry), cur ? `${id} reworded` : `${id} added: ${entry.title}`, cur ? clone(cur) : null));
    applySpec(work, { put: entry });
  }
  return out;
}
async function thinkNote(noteId: string) {
  const d = getData(), n = d.notes.find((x) => x.id === noteId), p = d.projects.find((x) => x.id === n?.projectId);
  if (!n || !p) return;
  try {
    const s = specView(d, p);
    const out = await runAi<{ status: "asking" | "proposed" | "done"; reply: string; question: string; options: string[]; edits: SpecEdit[] }>("specAsk", {
      project: { name: p.name }, text: n.text, dialog: n.dialog.map((q, i) => ({ q: q.q, answer: q.options[n.answers[i]] })),
      screens: p.screens.map((x) => ({ id: x.id, name: x.name })), spec: { purpose: s.purpose, users: s.users, entries: s.entries },
    });
    mutate((x) => {
      const note = x.notes.find((y) => y.id === noteId);
      if (!note) return;
      if (out.status === "asking" && out.options.length >= 2 && note.dialog.length < 3) {
        note.dialog.push({ q: out.question || out.reply, options: out.options });
        note.status = "asking";
        return;
      }
      const changes = editsToChanges(s, out.edits, firstName(note.by));
      Object.assign(note, { status: changes.length ? "proposed" : "done", reply: out.reply, changes });
    });
  } catch (e) {
    mutate((x) => { const note = x.notes.find((y) => y.id === noteId); if (note) Object.assign(note, { status: "done", reply: e instanceof Error ? e.message : String(e) }); });
  }
}
export function askSpec(pid: string, text: string, by: string) {
  if (!aiReady() || !allowed("spec")) return "";
  const id = uid("n");
  mutate((d) => { d.notes.unshift({ id, projectId: pid, kind: "ask", text: text.trim(), by, when: "Just now", status: "thinking", answers: [], dialog: [], changes: [] }); });
  void thinkNote(id);
  return id;
}
export function answerNote(noteId: string, i: number) {
  if (!aiReady()) return;
  mutate((d) => { const n = d.notes.find((x) => x.id === noteId); if (n && n.status === "asking") { n.dialog[n.answers.length].picked = i; n.answers.push(i); n.status = "thinking"; } });
  void thinkNote(noteId);
}
export function applyNote(noteId: string) {
  let count = 0, pid = "";
  mutate((d) => {
    const n = d.notes.find((x) => x.id === noteId), p = d.projects.find((x) => x.id === n?.projectId), r = p && repoOf(d, p.id);
    if (!n || !p || !r || n.status !== "proposed") return;
    applyToProject(d, p, n.changes);
    for (const c of n.changes) record(d, p.id, c);
    Object.assign(n, { status: "applied", branch: r.current });
    count = n.changes.length; pid = p.id;
  });
  if (pid) toast(`Applied ${count} ${count === 1 ? "change" : "changes"} to the spec. They are uncommitted.`, { go: { label: "Commit", path: `/p/${pid}/history/changes` } });
}
export const discardNote = (id: string) => mutate((d) => { const n = d.notes.find((x) => x.id === id); if (n) n.status = "discarded"; });

// ---- Briefs ----------------------------------------------------------------------------
const patchBrief = (id: string, fn: (b: Brief) => void) => mutate((d) => { const b = d.briefs.find((x) => x.id === id); if (b) fn(b); });

export function planBrief(f: { projectId: string; text: string; scope: Brief["scope"]; flow?: string; pins: string[]; by: string }) {
  if (!aiReady() || !allowed("brief")) return "";
  const d = getData(), p = d.projects.find((x) => x.id === f.projectId);
  if (!p) return "";
  const id = uid("b"), s = specView(d, p);
  const inScope = f.scope === "app" ? p.screens : f.scope === "flow" ? p.screens.filter((x) => x.flow === f.flow) : p.screens.filter((x) => f.pins.includes(x.id));
  mutate((x) => {
    x.briefs.unshift({ id, projectId: f.projectId, text: f.text.trim(), scope: f.scope, flow: f.flow, pins: f.pins, by: f.by, when: "Just now", status: "planning", title: shortTitle(f.text), reading: [], steps: [], rules: [], questions: [] });
  });
  runAi<{ title: string; reading: string[]; steps: { screenId: string; name: string; what: string; variant: number; nav: Nav; newScreen: { name: string; flow: string; kind: Kind } | null }[]; rules: { kind: EntryKind; title: string; text: string }[]; questions: { key: string; q: string; options: string[]; ruleId: string }[] }>(
    "briefPlan",
    {
      project: { name: p.name, nav: p.nav }, text: f.text, scope: f.scope === "app" ? "Whole app" : f.scope === "flow" ? `The ${f.flow} flow` : "Pinned screens",
      screens: inScope.map((x) => ({ id: x.id, name: x.name, kind: x.kind, variant: x.variant, status: x.status })),
      spec: s.entries.map((e) => ({ id: e.id, kind: e.kind, title: e.title, text: e.text, status: e.status })),
      drafts: d.comments.filter((c) => c.projectId === p.id && c.status === "draft").map((c) => c.text),
    },
  ).then((o) => {
    patchBrief(id, (b) => {
      b.title = o.title || b.title;
      b.reading = o.reading.filter((r) => s.entries.some((e) => e.id === r));
      b.steps = o.steps.map((st) => {
        const cur = p.screens.find((x) => x.id === st.screenId);
        if (cur) return { screenId: cur.id, name: cur.name, what: st.what, on: cur.status !== "approved", from: { variant: cur.variant, nav: p.nav }, to: { variant: st.variant, nav: st.nav } };
        const ns = st.newScreen ?? { name: st.name, flow: inScope[0]?.flow ?? "Core", kind: "dashboard" as Kind };
        const add: Screen = { id: slug(ns.name), name: ns.name, flow: ns.flow, kind: ns.kind, variant: st.variant, status: "unreviewed", mock: 2 };
        return { screenId: add.id, name: add.name, what: st.what, on: true, add, to: { variant: st.variant, nav: st.nav } };
      });
      b.rules = o.rules.map((r) => ({ ...r, on: true }));
      const qs = o.questions.map((q) => ({ key: q.key, q: q.q, options: q.options, a: 0, ...(q.ruleId ? { ruleId: q.ruleId } : {}) }));
      if (!qs.some((q) => q.key === "land")) qs.push({ key: "land", q: "Where should the work land?", options: ["A new branch and a pull request", `Straight onto ${p.branch || "main"}, as uncommitted changes`], a: 0 });
      b.questions = qs;
      b.status = "planned";
    });
  }).catch((e) => { patchBrief(id, (b) => { b.status = "planned"; }); fail(e); });
  return id;
}
export const toggleStep = (id: string, i: number, on: boolean) => patchBrief(id, (b) => { b.steps[i].on = on; });
export const toggleRule = (id: string, i: number, on: boolean) => patchBrief(id, (b) => { b.rules[i].on = on; });
export function answerPlan(id: string, qi: number, a: number) {
  const d = getData(), b = d.briefs.find((x) => x.id === id), p = d.projects.find((x) => x.id === b?.projectId);
  patchBrief(id, (x) => {
    x.questions[qi].a = a;
    if (x.questions[qi].key === "approved") for (const st of x.steps) if (p?.screens.find((s) => s.id === st.screenId)?.status === "approved") st.on = a === 1;
  });
}
export function removeBrief(id: string) {
  const before = getData();
  mutate((d) => { d.briefs = d.briefs.filter((b) => b.id !== id); });
  toast("Brief removed. Nothing in the prototype had changed.", { undo: () => replaceData(before) });
}
export function runBrief(id: string) {
  if (!aiReady() || !allowed("brief")) return;
  const d0 = getData(), b0 = d0.briefs.find((x) => x.id === id), p0 = d0.projects.find((x) => x.id === b0?.projectId);
  if (!b0 || !p0 || b0.status !== "planned") return;
  const steps = b0.steps.filter((s) => s.on);
  if (!steps.length) return;
  const toBranch = b0.questions.find((q) => q.key === "land")?.a !== 1;
  patchBrief(id, (b) => { b.status = "running"; for (const s of b.steps) delete s.done; });
  steps.forEach((st, i) => window.setTimeout(() => patchBrief(id, (b) => { const x = b.steps.find((y) => y.screenId === st.screenId); if (x) x.done = true; }), 450 * (i + 1)));
  window.setTimeout(() => {
    let prId = 0, branch = "";
    mutate((d) => {
      const b = d.briefs.find((x) => x.id === id)!, p = d.projects.find((x) => x.id === p0.id)!, r = repoOf(d, p.id)!, s = specOf(d, p.id)!;
      const cs: Change[] = steps.map((st) => ({ ...Ai({ id: st.screenId, name: st.name }, cap(st.what), st.from, st.to), ...(st.add ? { add: st.add } : {}) }));
      const work = clone(s), conflict = b.questions.find((q) => q.key === "conflict");
      if (conflict?.a === 1 && conflict.ruleId) {
        const e = work.entries.find((x) => x.id === conflict.ruleId);
        if (e) cs.push(Ni({ ...e, status: "proposed", source: `Reopened by the brief "${b.title}"` }, `${e.id} reopened by the brief`, clone(e)));
      }
      for (const rule of b.rules.filter((x) => x.on)) {
        const e: Entry = { id: nextId(work, rule.kind), kind: rule.kind, title: rule.title, text: rule.text, status: "agreed", screens: rule.kind === "decision" ? steps.map((x) => x.screenId) : [], source: `Brief "${b.title}"` };
        work.entries.push(e);
        cs.push(Ni(e, `${e.id} added: ${rule.title}`));
      }
      if (toBranch) {
        branch = slug(b.title).slice(0, 36);
        while (branchOf(r, branch)) branch += "-2";
        r.branches.push({ name: branch, base: r.current, by: b.by, behind: 0, incoming: [], remote: true, commits: [M(b.title, "claude", "Just now", cs)] });
        prId = r.prs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
        r.prs.unshift({ id: prId, title: b.title, about: b.text, from: branch, into: r.current, by: b.by, when: "Just now", status: "open", review: "none", findings: [], approvals: [] });
        b.branch = branch; b.pr = prId;
      } else {
        applyToProject(d, p, cs, true);
        for (const c of cs) record(d, p.id, c);
        b.branch = r.current; p.updated = "Just now";
      }
      b.status = "done";
    });
    if (toBranch) toast(`Claude finished on the branch ${branch} and opened pull request #${prId}.`, { go: { label: "Open the pull request", path: `/p/${p0.id}/history/pr/${prId}` } });
    else toast(`Claude changed ${steps.length} screens on ${p0.branch}. They are uncommitted.`, { go: { label: "See the changes", path: `/p/${p0.id}/history/changes` } });
  }, 450 * steps.length + 400);
}

export { data };
