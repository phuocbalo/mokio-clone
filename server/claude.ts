// Runs Claude Code on this computer in print mode and returns structured JSON.
// AI work counts against the signed-in Claude subscription's usage limits.
import { spawn, execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const isWin = process.platform === "win32";
// A neutral working folder, so Claude Code does not pick up this repo's context.
const WORKDIR = mkdtempSync(join(tmpdir(), "mokio-claude-"));

let resolved: string | null = null;
function claudeCommand(): Promise<string | null> {
  if (resolved) return Promise.resolve(resolved);
  return new Promise((res) => {
    execFile(isWin ? "where" : "which", ["claude"], (err, out) => {
      if (err) return res(null);
      const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // Prefer a real executable on Windows; .cmd shims need a shell.
      resolved = lines.find((l) => /\.exe$/i.test(l)) ?? lines.find((l) => /\.cmd$/i.test(l)) ?? lines[0] ?? null;
      res(resolved);
    });
  });
}

function run(args: string[], input?: string, timeoutMs = 240_000): Promise<{ code: number; out: string; err: string }> {
  return claudeCommand().then(
    (cmd) =>
      new Promise((res) => {
        if (!cmd) return res({ code: 127, out: "", err: "Claude Code is not installed." });
        const shell = isWin && /\.cmd$/i.test(cmd);
        const quoted = shell ? args.map((a) => `"${a.replace(/"/g, '\\"')}"`) : args;
        const child = spawn(shell ? `"${cmd}"` : cmd, quoted, { cwd: WORKDIR, shell, windowsHide: true });
        let out = "", err = "";
        const timer = setTimeout(() => child.kill(), timeoutMs);
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", (e) => { clearTimeout(timer); res({ code: 1, out, err: String(e) }); });
        child.on("close", (code) => { clearTimeout(timer); res({ code: code ?? 1, out, err }); });
        if (input != null) child.stdin.end(input);
        else child.stdin.end();
      }),
  );
}

export interface ClaudeStatus {
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  authMethod?: string;
}

export async function claudeStatus(): Promise<ClaudeStatus> {
  const v = await run(["--version"], undefined, 20_000);
  if (v.code !== 0) return { installed: false, loggedIn: false };
  const version = v.out.trim().split(/\s/)[0];
  const a = await run(["auth", "status"], undefined, 20_000);
  try {
    const j = JSON.parse(a.out);
    return { installed: true, version, loggedIn: !!j.loggedIn, authMethod: j.authMethod };
  } catch {
    return { installed: true, version, loggedIn: a.code === 0 };
  }
}

export class ClaudeError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

/** Ask Claude for JSON that matches `schema`. No tools: it only reads the prompt. */
export async function askClaude<T>(system: string, prompt: string, schema: object): Promise<T> {
  const args = [
    "-p",
    "--output-format", "json",
    "--tools", "",
    "--append-system-prompt", system,
    "--json-schema", JSON.stringify(schema),
  ];
  if (process.env.MOKIO_MODEL) args.push("--model", process.env.MOKIO_MODEL);
  const r = await run(args, prompt);
  if (r.code === 127) throw new ClaudeError("Claude Code is not installed on this computer.", 503);
  let j: any;
  try {
    j = JSON.parse(r.out);
  } catch {
    const msg = (r.err || r.out).trim().slice(0, 400);
    if (/log ?in|auth|sign/i.test(msg)) throw new ClaudeError("Claude Code is not signed in. Run `claude` and sign in.", 503);
    throw new ClaudeError(msg || "Claude Code did not answer.");
  }
  if (j.is_error) {
    const msg = String(j.result ?? j.subtype ?? "Claude Code reported an error.");
    if (/limit/i.test(msg)) throw new ClaudeError(`Claude Code reported a usage limit: ${msg}`, 429);
    throw new ClaudeError(msg);
  }
  if (j.structured_output) return j.structured_output as T;
  try {
    return JSON.parse(String(j.result).replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
  } catch {
    throw new ClaudeError("Claude Code answered, but not in the expected shape.");
  }
}
