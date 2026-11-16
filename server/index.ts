import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROLES, type Role, type User, listUsers, findUserByEmail, createUser, setRole, getUser,
  checkPassword, createSession, sessionUser, dropSession, seedDemoTeam,
} from "./db.ts";
import { claudeStatus, askClaude, ClaudeError } from "./claude.ts";
import { TASKS, SYSTEM_PROMPT } from "./ai.ts";
import { can } from "../client/src/lib/catalog.ts";

seedDemoTeam();

const app = express();

// The hosted site (GitHub Pages) may call this server on the visitor's own computer.
// Only these origins may; add more with MOKIO_ALLOWED_ORIGINS (comma-separated).
const ALLOWED = new Set(
  (process.env.MOKIO_ALLOWED_ORIGINS ?? "https://phuocbalo.github.io").split(",").map((s) => s.trim()).filter(Boolean),
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    // Chrome asks before a public site reaches a server on this computer.
    if (req.headers["access-control-request-private-network"]) res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (req.method === "OPTIONS") return res.sendStatus(origin && ALLOWED.has(origin) ? 204 : 403);
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

const COOKIE = "mokio_session";
type Authed = Request & { user: User };

/** A session comes from the cookie (same site) or a bearer token (the hosted site). */
function tokenOf(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return req.cookies?.[COOKIE];
}

function auth(req: Request, res: Response, next: NextFunction) {
  const user = sessionUser(tokenOf(req));
  if (!user) return res.status(401).json({ error: "Sign in first." });
  (req as Authed).user = user;
  next();
}

function startSession(res: Response, userId: string) {
  const token = createSession(userId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 });
  return token;
}

// ---- Accounts ------------------------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const row = email && findUserByEmail(String(email));
  if (!row || !checkPassword(row.password_hash, String(password ?? ""))) {
    return res.status(401).json({ error: "That email and password do not match an account." });
  }
  const token = startSession(res, row.id);
  res.json({ user: getUser(row.id), token });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email ?? "")) return res.status(400).json({ error: "Give your name and a valid email." });
  if (String(password ?? "").length < 8) return res.status(400).json({ error: "Use a password of at least 8 characters." });
  if (findUserByEmail(email)) return res.status(409).json({ error: "An account with that email already exists." });
  // New people start as developers (read and comment). An owner can change the role.
  const user = createUser(name, email, password, listUsers().length ? "developer" : "owner");
  const token = startSession(res, user.id);
  res.json({ user, token });
});

app.post("/api/auth/logout", (req, res) => {
  const t = tokenOf(req);
  if (t) dropSession(t);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: sessionUser(tokenOf(req)) });
});

// Public: the sign-in screen lists the team, like the original's "Who are you today?".
app.get("/api/team", (_req, res) => {
  res.json({ users: listUsers() });
});

app.patch("/api/users/:id", auth, (req, res) => {
  const me = (req as Authed).user;
  if (!can(me.role, "team")) return res.status(403).json({ error: "Only owners can change someone's role." });
  const role = req.body?.role as Role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Unknown role." });
  const id = String(req.params.id);
  if (id === me.id && role !== "owner" && listUsers().filter((u) => u.role === "owner").length === 1) {
    return res.status(400).json({ error: "You are the only owner. Make someone else an owner first." });
  }
  setRole(id, role);
  res.json({ user: getUser(id) });
});

// ---- Claude Code ---------------------------------------------------------
app.get("/api/claude/status", auth, async (_req, res) => {
  res.json(await claudeStatus());
});

app.post("/api/ai/:task", auth, async (req, res) => {
  const me = (req as Authed).user;
  const task = TASKS[String(req.params.task)];
  if (!task) return res.status(404).json({ error: "Unknown AI task." });
  if (!can(me.role, task.action)) return res.status(403).json({ error: "Your role cannot do this." });
  try {
    const out = await askClaude(SYSTEM_PROMPT, task.prompt(req.body ?? {}), task.schema);
    res.json(out);
  } catch (e) {
    const err = e instanceof ClaudeError ? e : new ClaudeError(String(e));
    console.error(`[ai:${req.params.task}]`, err.message);
    res.status(err.status).json({ error: err.message });
  }
});

// ---- Built web app (npm run build, then npm start) -----------------------
const dist = resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
}

// Its own variable: dev tools often set PORT for the web server.
const port = Number(process.env.MOKIO_API_PORT ?? 8787);
app.listen(port, () => console.log(`Mokio API on http://localhost:${port}`));
