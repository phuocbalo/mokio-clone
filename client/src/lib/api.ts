import { account, ai, go, reloadData, setPrefs, toast } from "./store";
import type { Person } from "./types";
import type { Role } from "./catalog";

// ---- Demo mode -------------------------------------------------------------
// With no Mokio server (for example on GitHub Pages), sign-in uses the demo team
// stored in this browser and AI is off. Everything else works the same.
const DEMO_PASSWORD = "mokio-demo";
const DEMO_TEAM_KEY = "mokio.demo.team.v1", DEMO_USER_KEY = "mokio.demo.user.v1";
const DOES: Record<Role, string> = {
  owner: "Owns the libraries, applies options, archives prototypes",
  designer: "Authors prototypes and sends reviews to Claude",
  reviewer: "Comments on screens and approves them",
  developer: "Reads the prototype as the spec and asks questions",
};
const DEMO_TEAM: Person[] = [
  { id: "linh", name: "Linh Tran", email: "linh@mokio.test", role: "owner", initials: "LT", tone: 0, does: DOES.owner },
  { id: "minh", name: "Minh Pham", email: "minh@mokio.test", role: "designer", initials: "MP", tone: 1, does: DOES.designer },
  { id: "hoa", name: "Hoa Le", email: "hoa@mokio.test", role: "reviewer", initials: "HL", tone: 3, does: DOES.reviewer },
  { id: "khoa", name: "Khoa Vu", email: "khoa@mokio.test", role: "developer", initials: "KV", tone: 2, does: DOES.developer },
];
const readLocal = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const writeLocal = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
const demoTeam = () => readLocal<Person[]>(DEMO_TEAM_KEY) ?? DEMO_TEAM;
const isDemo = () => account.get().demo;

class NoServer extends Error {}

// Where the API lives: the page's own origin, or, from the hosted site, a Mokio server
// running on the visitor's computer. Cross-origin calls carry a bearer token, not a cookie.
const LOCAL_SERVER = "http://localhost:8787";
let base = "";
const tokenKey = () => `mokio.token.v1.${base || "same"}`;
const token = () => (base ? readLocal<string>(tokenKey()) : null);

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    const headers: Record<string, string> = {};
    if (body) headers["content-type"] = "application/json";
    const t = token();
    if (t) headers.authorization = `Bearer ${t}`;
    r = await fetch(base + url, {
      method, credentials: base ? "omit" : "same-origin", headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NoServer("No Mokio server.");
  }
  // A static host answers /api/* with an HTML page or a 404: there is no server.
  if (!(r.headers.get("content-type") ?? "").includes("application/json")) throw new NoServer("No Mokio server.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}

export async function loadTeam() {
  if (isDemo()) { account.set({ ...account.get(), team: demoTeam() }); return; }
  const { users } = await call<{ users: Person[] }>("GET", "/api/team");
  account.set({ ...account.get(), team: users });
}

async function connect() {
  await loadTeam();
  const { user } = await call<{ user: Person | null }>("GET", "/api/auth/me");
  account.set({ ...account.get(), user, ready: true });
  if (user) { reloadData(); void checkClaude(); }
}

export async function boot() {
  try {
    try {
      await connect();
    } catch (e) {
      // No server behind this page (a static host). Look for one on this computer.
      const onLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
      if (!(e instanceof NoServer) || onLocalhost) throw e;
      base = LOCAL_SERVER;
      try { await connect(); } catch (x) { base = ""; throw x; }
    }
  } catch (e) {
    if (e instanceof NoServer) {
      const id = readLocal<string>(DEMO_USER_KEY);
      const team = demoTeam();
      account.set({ ...account.get(), demo: true, team, user: team.find((u) => u.id === id) ?? null, ready: true });
      void checkClaude();
      if (account.get().user) reloadData();
    } else {
      account.set({ ...account.get(), ready: true });
      toast("The Mokio server answered with an error. Try reloading.");
    }
  }
}

async function signedIn(user: Person) {
  account.set({ ...account.get(), user });
  setPrefs({ viewAs: null });
  await loadTeam();
  reloadData();
  void checkClaude();
}

export async function login(email: string, password: string) {
  if (isDemo()) {
    const user = demoTeam().find((u) => u.email === email.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD) throw new Error("That email and password do not match a demo account. The demo password is mokio-demo.");
    writeLocal(DEMO_USER_KEY, user.id);
    return signedIn(user);
  }
  const { user, token: t } = await call<{ user: Person; token: string }>("POST", "/api/auth/login", { email, password });
  if (base) writeLocal(tokenKey(), t);
  await signedIn(user);
}
export async function register(name: string, email: string, password: string) {
  if (isDemo()) throw new Error("This hosted demo has only the four demo accounts. Run Mokio on your computer to create accounts.");
  const { user, token: t } = await call<{ user: Person; token: string }>("POST", "/api/auth/register", { name, email, password });
  if (base) writeLocal(tokenKey(), t);
  await signedIn(user);
}
export async function logout() {
  if (isDemo()) writeLocal(DEMO_USER_KEY, null);
  else { await call("POST", "/api/auth/logout").catch(() => {}); if (base) writeLocal(tokenKey(), null); }
  account.set({ ...account.get(), user: null });
  go("/signin");
}
export async function changeRole(id: string, role: string) {
  if (isDemo()) {
    const team = demoTeam().map((u) => (u.id === id ? { ...u, role: role as Role, does: DOES[role as Role] } : u));
    writeLocal(DEMO_TEAM_KEY, team);
  } else {
    await call("PATCH", `/api/users/${id}`, { role });
  }
  await loadTeam();
  const me = account.get().user;
  if (me?.id === id) account.set({ ...account.get(), user: { ...me, role: role as Person["role"] } });
}

export async function checkClaude() {
  if (isDemo()) {
    ai.set({ checked: true, installed: false, loggedIn: false, on: false, why: "AI is off: no Mokio server on this computer. Run npm run dev in the Mokio folder, then reload this page." });
    return false;
  }
  try {
    const s = await call<{ installed: boolean; loggedIn: boolean; version?: string }>("GET", "/api/claude/status");
    const why = !s.installed
      ? "AI is off: Claude Code is not installed on this computer. Settings shows how to fix it."
      : !s.loggedIn
        ? "AI is off: Claude Code is not signed in to a Claude subscription. Settings shows how to fix it."
        : "";
    ai.set({ checked: true, ...s, on: s.installed && s.loggedIn, why });
  } catch {
    ai.set({ checked: true, installed: false, loggedIn: false, on: false, why: "AI is off: the Mokio server did not answer." });
  }
  return ai.get().on;
}

/** Run one AI task through Claude Code on this computer. */
export function runAi<T>(task: string, input: unknown): Promise<T> {
  if (isDemo()) return Promise.reject(new Error(ai.get().why));
  return call<T>("POST", `/api/ai/${task}`, input);
}
