// Accounts and sessions live in a small SQLite file on this computer.
// Prototype data (projects, comments, spec, history) stays in each browser.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export type Role = "owner" | "designer" | "reviewer" | "developer";
export const ROLES: Role[] = ["owner", "designer", "reviewer", "developer"];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  initials: string;
  tone: number;
  does: string;
}

mkdirSync("data", { recursive: true });
export const db = new DatabaseSync("data/mokio.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL, initials TEXT NOT NULL, tone INTEGER NOT NULL,
    does TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL
  );
`);

const DOES: Record<Role, string> = {
  owner: "Owns the libraries, applies options, archives prototypes",
  designer: "Authors prototypes and sends reviews to Claude",
  reviewer: "Comments on screens and approves them",
  developer: "Reads the prototype as the spec and asks questions",
};

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";

const row = (r: any): User => ({
  id: r.id, email: r.email, name: r.name, role: r.role, initials: r.initials, tone: r.tone, does: r.does,
});

export function listUsers(): User[] {
  return db.prepare("SELECT * FROM users ORDER BY created").all().map(row);
}
export function findUserByEmail(email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim()) as any;
}
export function getUser(id: string): User | null {
  const r = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return r ? row(r) : null;
}

export function createUser(name: string, email: string, password: string, role: Role, id?: string): User {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as any).n as number;
  const u = {
    id: id ?? randomBytes(6).toString("hex"),
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role,
    initials: initialsOf(name),
    tone: count % 4,
    does: DOES[role],
  };
  db.prepare(
    "INSERT INTO users (id,email,name,role,initials,tone,does,password_hash,created) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(u.id, u.email, u.name, u.role, u.initials, u.tone, u.does, bcrypt.hashSync(password, 10), Date.now());
  return u;
}

export function setRole(id: string, role: Role) {
  db.prepare("UPDATE users SET role = ?, does = ? WHERE id = ?").run(role, DOES[role], id);
}

export function checkPassword(hash: string, password: string) {
  return bcrypt.compareSync(password, hash);
}

const WEEK = 7 * 24 * 3600 * 1000;
export function createSession(userId: string) {
  const token = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)").run(token, userId, Date.now() + WEEK);
  return token;
}
export function sessionUser(token: string | undefined): User | null {
  if (!token) return null;
  const s = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as any;
  if (!s || s.expires < Date.now()) return null;
  return getUser(s.user_id);
}
export function dropSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// The demo team from the original prototype. Passwords are documented in the README.
export const DEMO_PASSWORD = "mokio-demo";
export function seedDemoTeam() {
  if (listUsers().length) return;
  createUser("Linh Tran", "linh@mokio.test", DEMO_PASSWORD, "owner", "linh");
  createUser("Minh Pham", "minh@mokio.test", DEMO_PASSWORD, "designer", "minh");
  createUser("Hoa Le", "hoa@mokio.test", DEMO_PASSWORD, "reviewer", "hoa");
  createUser("Khoa Vu", "khoa@mokio.test", DEMO_PASSWORD, "developer", "khoa");
  // Match the original's avatar tones.
  const tones: Record<string, number> = { linh: 0, minh: 1, hoa: 3, khoa: 2 };
  for (const [id, t] of Object.entries(tones)) db.prepare("UPDATE users SET tone = ? WHERE id = ?").run(t, id);
}
