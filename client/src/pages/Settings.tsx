import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Sparkles } from "lucide-react";
import { checkClaude, changeRole } from "../lib/api";
import { toast, useAccount, useAi, useMe } from "../lib/store";
import { ROLE_LABEL, can, type Role } from "../lib/catalog";
import { Avatar, Btn, Chip } from "../components/ui";

const Check = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li className={ok ? "ok" : "bad"}>{ok ? <CheckCircle2 /> : <XCircle />}<span>{children}</span></li>
);

export function Settings() {
  const s = useAi(), me = useMe(), { team, user, demo } = useAccount();
  const [busy, setBusy] = useState(false);
  const again = async () => {
    setBusy(true);
    const on = await checkClaude();
    setBusy(false);
    toast(on ? "Claude Code is ready. AI is on." : "Still not ready. Do the step above, then check again.");
  };
  return (
    <div className="page settings">
      <div className="page-head"><h1>Settings</h1></div>

      <section className="conn">
        <h2><Sparkles /> AI <Chip tone={s.on ? "ok" : "warn"}>{s.on ? "On" : "Off"}</Chip></h2>
        <p className="lede">Mokio runs Claude Code on this computer. Drafting, review rounds, options, briefs, spec changes and pull request reviews all go through it.</p>
        {demo ? (
          <p className="notice">No Mokio server was found on this computer, so AI is off. To turn it on, clone the repository, run <code>npm install</code> and <code>npm run dev</code> on a computer with Claude Code signed in, then reload this page. This site then uses that server for sign-in and AI. Your browser may ask to allow access to devices on your local network: allow it.</p>
        ) : <>
        <ul className="steps">
          <Check ok={s.installed}>{s.installed ? <>Claude Code is installed {s.version && <span className="mono muted">{s.version}</span>}</> : <>Install Claude Code from <a className="link" href="https://claude.com/claude-code" target="_blank" rel="noreferrer">claude.com/claude-code</a>, then check again.</>}</Check>
          <Check ok={s.loggedIn}>{s.loggedIn ? "Claude Code is signed in to a Claude subscription" : <>Open a terminal, run <code>claude</code> and sign in with your Claude account. Then check again.</>}</Check>
        </ul>
        <Btn icon={<RefreshCw />} busy={busy} onClick={again}>Check again</Btn>
        </>}
        <p className="fine">AI work counts against your subscription's usage limits. When Claude Code reports a limit, the job stops and says so.</p>
      </section>

      <section>
        <h2>Team</h2>
        <p className="lede">Roles decide what each person can do. {can(user?.role, "team") ? "As an owner you can change them." : "Only owners can change them."}</p>
        <ul className="plist">
          {team.map((u) => (
            <li key={u.id} className="key-row">
              <Avatar p={u} />
              <span className="grow"><b>{u.name}</b> <small className="muted">{u.email}</small><br /><small className="muted">{u.does}</small></span>
              {can(user?.role, "team") ? (
                <select value={u.role} aria-label={`Role for ${u.name}`} onChange={(e) => changeRole(u.id, e.target.value).then(() => toast(`${u.name} is now ${ROLE_LABEL[e.target.value as Role].toLowerCase()}.`), (x) => toast(x.message))}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              ) : <Chip>{ROLE_LABEL[u.role]}</Chip>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>You</h2>
        <p>Signed in as <b>{user?.name}</b> ({user?.email}), {ROLE_LABEL[user?.role ?? "developer"].toLowerCase()}.
          {me.role !== user?.role && <> Previewing Mokio as a {ROLE_LABEL[me.role].toLowerCase()} from the bar at the top.</>}</p>
      </section>
    </div>
  );
}
