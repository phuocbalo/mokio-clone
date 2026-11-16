import { useRef, useState } from "react";
import { login, register } from "../lib/api";
import { useAccount } from "../lib/store";
import { ROLE_LABEL } from "../lib/catalog";
import { Avatar, Btn, Glyph, Kbd, useKeys } from "../components/ui";

/** Real sign-in. The team list mirrors the original's "Who are you today?" and fills the email. */
export function SignIn() {
  const { team, demo } = useAccount();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const pw = useRef<HTMLInputElement>(null);
  const pick = (e: string) => { setEmail(e); setMode("in"); setErr(""); window.setTimeout(() => pw.current?.focus(), 0); };
  useKeys(Object.fromEntries(team.slice(0, 9).map((u, i) => [String(i + 1), () => pick(u.email ?? "")])));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { mode === "in" ? await login(email, password) : await register(name, email, password); }
    catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  };
  return (
    <div className="signin">
      <div className="signin-col">
        <div className="brand big"><Glyph size={28} /><span>Mokio</span></div>
        <h1>{mode === "in" ? "Who are you today?" : "Create your account"}</h1>
        {mode === "in" ? (
          <>
            <p className="lede">Pick your account, then enter your password. Each person has a role that decides what they can do.</p>
            <ul className="persona-list">
              {team.map((u, i) => (
                <li key={u.id}>
                  <button type="button" className="persona" aria-pressed={email === u.email} onClick={() => pick(u.email ?? "")}>
                    <Avatar p={u} size="lg" />
                    <span className="persona-text"><b>{u.name}</b><small>{u.does}</small></span>
                    <span className="persona-role">{ROLE_LABEL[u.role]}</span>
                    <Kbd k={String(i + 1)} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="lede">New accounts start as developers: they read prototypes and comment. An owner can change your role in Settings.</p>}
        <form className="form" onSubmit={submit} noValidate>
          {mode === "up" && <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
          <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
          <label className="field"><span>Password</span><input ref={pw} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="form-actions">
            <Btn type="submit" variant="primary" busy={busy} disabled={!email || !password}>{mode === "in" ? "Sign in" : "Create account"}</Btn>
            {!demo && <button type="button" className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>
              {mode === "in" ? "New here? Create an account" : "I already have an account"}
            </button>}
          </div>
        </form>
        <p className="fine">{demo
          ? <>Hosted demo: pick an account and use the password <code>mokio-demo</code>. Everything is kept in this browser, and AI is off. Run Mokio on your computer with Claude Code to use AI and real accounts.</>
          : "Accounts are stored on this computer by the Mokio server. Prototype data is kept in this browser only."}</p>
      </div>
    </div>
  );
}
