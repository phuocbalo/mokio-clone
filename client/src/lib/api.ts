import { account, ai, go, reloadData, setPrefs, toast } from "./store";
import type { Person } from "./types";

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method, credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}

export async function loadTeam() {
  const { users } = await call<{ users: Person[] }>("GET", "/api/team");
  account.set({ ...account.get(), team: users });
}

export async function boot() {
  try {
    await loadTeam();
    const { user } = await call<{ user: Person | null }>("GET", "/api/auth/me");
    account.set({ ...account.get(), user, ready: true });
    if (user) { reloadData(); void checkClaude(); }
  } catch {
    account.set({ ...account.get(), ready: true });
    toast("Cannot reach the Mokio server. Start it with npm run dev.");
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
  const { user } = await call<{ user: Person }>("POST", "/api/auth/login", { email, password });
  await signedIn(user);
}
export async function register(name: string, email: string, password: string) {
  const { user } = await call<{ user: Person }>("POST", "/api/auth/register", { name, email, password });
  await signedIn(user);
}
export async function logout() {
  await call("POST", "/api/auth/logout").catch(() => {});
  account.set({ ...account.get(), user: null });
  go("/signin");
}
export async function changeRole(id: string, role: string) {
  await call("PATCH", `/api/users/${id}`, { role });
  await loadTeam();
  const me = account.get().user;
  if (me?.id === id) account.set({ ...account.get(), user: { ...me, role: role as Person["role"] } });
}

export async function checkClaude() {
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
  return call<T>("POST", `/api/ai/${task}`, input);
}
