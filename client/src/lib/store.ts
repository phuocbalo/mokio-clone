// Small observable stores: display prefs, the signed-in account, prototype data, routing and toasts.
import { useSyncExternalStore } from "react";
import { produce } from "immer";
import type { Data, Person } from "./types";
import type { Role } from "./catalog";
import { Vi, wi } from "./seed.js";

export function store<T>(initial: T) {
  let v = initial;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set(n: T) { v = n; subs.forEach((f) => f()); },
    sub(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  };
}
export function useStore<T>(s: ReturnType<typeof store<T>>) {
  return useSyncExternalStore(s.sub, s.get);
}

const read = <T,>(k: string): T | null => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
const remove = (k: string) => { try { localStorage.removeItem(k); } catch { /* storage off */ } };

export const cx = (...a: unknown[]) => a.filter(Boolean).join(" ");
let seq = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(" ").map((w) => w[0].toUpperCase() + w.slice(1)).join("");

// ---- Display prefs --------------------------------------------------------
export interface Prefs {
  theme: "system" | "light" | "dark"; accent: string; zoom: number; density: "cozy" | "compact";
  device: "desktop" | "tablet" | "phone"; zen: boolean; showMock: boolean; hints: boolean; scenario: string;
  sideCollapsed: boolean; pins: Record<string, string[]>; focus: boolean; viewAs: Role | null;
}
const PREFS = "mokio.prefs.v1";
const DEFAULT_PREFS: Prefs = {
  theme: "system", accent: "indigo", zoom: 100, density: "cozy", device: "desktop", zen: false, showMock: false,
  hints: true, scenario: "mid", sideCollapsed: false, pins: { tazko: ["board", "card-detail"] }, focus: false, viewAs: null,
};
export const ZOOMS = [80, 90, 100, 110, 125, 150];
export const ACCENTS = [
  { id: "indigo", name: "Indigo", hue: null as number | null }, { id: "teal", name: "Teal", hue: 185 },
  { id: "green", name: "Green", hue: 150 }, { id: "amber", name: "Amber", hue: 70 },
  { id: "rose", name: "Rose", hue: 5 }, { id: "violet", name: "Violet", hue: 305 },
];
export const prefs = store<Prefs>({ ...DEFAULT_PREFS, ...(read<Prefs>(PREFS) ?? {}) });
export function setPrefs(p: Partial<Prefs>) { prefs.set({ ...prefs.get(), ...p }); write(PREFS, prefs.get()); }
export const usePrefs = () => useStore(prefs);
export const pinsOf = (p: Prefs, projectId: string) => p.pins[projectId] ?? [];
export function togglePin(projectId: string, screenId: string) {
  const cur = pinsOf(prefs.get(), projectId), on = !cur.includes(screenId);
  const next = on ? [...cur, screenId] : cur.filter((x) => x !== screenId);
  setPrefs({ pins: { ...prefs.get().pins, [projectId]: next }, ...(next.length ? {} : { focus: false }) });
  return on;
}

// ---- Account ---------------------------------------------------------------
/** `demo` is true when no Mokio server answers (a static host): demo accounts live in the browser and AI is off. */
export const account = store<{ user: Person | null; team: Person[]; ready: boolean; demo: boolean }>({ user: null, team: [], ready: false, demo: false });
export const useAccount = () => useStore(account);
/** The role permissions are checked against. Owners can preview another role from the bar. */
export function effectiveRole(): Role | undefined {
  const u = account.get().user;
  if (!u) return undefined;
  return u.role === "owner" && prefs.get().viewAs ? prefs.get().viewAs! : u.role;
}
export function useMe(): Person {
  const { user } = useAccount();
  const p = usePrefs();
  const role = user?.role === "owner" && p.viewAs ? p.viewAs : user?.role ?? "developer";
  return { ...(user ?? { id: "", name: "", initials: "?", tone: 0, does: "" }), role } as Person;
}
export const CLAUDE: Person = { id: "claude", name: "Claude", role: "designer", initials: "C", tone: 4, does: "" };
export function person(id: string): Person {
  if (id === "claude") return CLAUDE;
  return account.get().team.find((u) => u.id === id) ?? { id, name: id, role: "developer", initials: id.slice(0, 2).toUpperCase(), tone: 0, does: "" };
}
export const firstName = (id: string) => person(id).name.split(" ")[0];

// ---- Prototype data (kept in this browser, per account and scenario) --------
const dataKey = () => `mokio.data.v1.${account.get().user?.id ?? "anon"}.${prefs.get().scenario}`;

function settle(d: Data): Data {
  // Work that was running when the page reloaded cannot finish; put it back to a resting state.
  return produce(d, (x) => {
    for (const c of x.comments) if (c.status === "queued" || c.status === "working") c.status = "draft";
    for (const p of x.projects) delete p.drafting;
    for (const r of x.rounds) if (r.status === "generating" || r.status === "applying") r.status = "open";
    for (const b of x.briefs) if (b.status === "planning" || b.status === "running") b.status = "planned";
    for (const r of Object.values(x.repos)) for (const pr of r.prs) if (pr.review === "running") pr.review = "none";
    for (const n of x.notes) if (n.status === "thinking") Object.assign(n, { status: "done", reply: "Interrupted by a reload. Ask again." });
  });
}
export const scenarioOf = (id: string) => Vi.find((s) => s.id === id) ?? Vi[0];
export const SCENARIOS = Vi;
function load(): Data {
  const d = read<Data>(dataKey());
  return d?.projects && d.systems && d.repos && d.specs && d.briefs && d.notes ? settle(d) : scenarioOf(prefs.get().scenario).build();
}
export const data = store<Data>(scenarioOf("mid").build());
export const useData = () => useStore(data);
export const getData = () => data.get();
export function reloadData() { data.set(load()); }
let lastScenario = prefs.get().scenario;
prefs.sub(() => { if (prefs.get().scenario !== lastScenario) { lastScenario = prefs.get().scenario; reloadData(); } });

export function mutate(fn: (d: Data) => void) { data.set(produce(data.get(), fn)); write(dataKey(), data.get()); }
export function replaceData(d: Data) { data.set(d); write(dataKey(), d); }
export function resetData() { remove(dataKey()); data.set(scenarioOf(prefs.get().scenario).build()); toast("Sample data restored for this scenario."); }
export const HOUSE_SYSTEM = wi()[0];

// ---- Hash routing ----------------------------------------------------------
const hashPath = () => { try { return window.location.hash.replace(/^#/, "") || "/"; } catch { return "/"; } };
export const route = store(hashPath());
window.addEventListener("hashchange", () => { const h = hashPath(); if (h !== route.get()) route.set(h); });
export function parse(full: string) {
  const [path, q] = full.split("?");
  return { full, path, parts: path.split("/").filter(Boolean), params: new URLSearchParams(q ?? "") };
}
export const useRoute = () => parse(useStore(route));
export function go(to: string) {
  if (to === route.get()) return;
  route.set(to);
  try { window.location.hash = to; window.scrollTo(0, 0); } catch { /* ignore */ }
}

// ---- Toasts, palette, shortcuts overlay -------------------------------------
export interface Toast { id: string; text: string; undo?: () => void; go?: { label: string; path: string } }
export const ui = store<{ palette: boolean; keys: boolean; toasts: Toast[] }>({ palette: false, keys: false, toasts: [] });
export const useUi = () => useStore(ui);
export const openPalette = (v = true) => ui.set({ ...ui.get(), palette: v });
export const openKeys = (v = true) => ui.set({ ...ui.get(), keys: v });
export const dropToast = (id: string) => ui.set({ ...ui.get(), toasts: ui.get().toasts.filter((t) => t.id !== id) });
export function toast(text: string, opts: Omit<Toast, "id" | "text"> = {}) {
  const t: Toast = { id: uid("t"), text, ...opts };
  ui.set({ ...ui.get(), toasts: [...ui.get().toasts.slice(-2), t] });
  window.setTimeout(() => dropToast(t.id), opts.undo || opts.go ? 8000 : 4500);
}

// ---- Claude Code status ----------------------------------------------------
export interface AiState { checked: boolean; installed: boolean; loggedIn: boolean; version?: string; on: boolean; why: string }
export const ai = store<AiState>({ checked: false, installed: false, loggedIn: false, on: false, why: "Checking Claude Code on this computer…" });
export const useAi = () => useStore(ai);
