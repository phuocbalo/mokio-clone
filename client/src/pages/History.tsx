import { useEffect, useState } from "react";
import { GitBranch, GitCommitHorizontal, GitPullRequest, GitMerge, ArrowDown, ArrowUp, RefreshCw, Crosshair, Trash2, Sparkles, Check, X, Plus } from "lucide-react";
import type { Change, Commit, Project, PR } from "../lib/types";
import { can, WHY_NOT } from "../lib/catalog";
import { cx, go, person, useAi, useData, useMe } from "../lib/store";
import {
  changeKey, checkout, commit, discard, draftCommitMessage, fetchRemote, fixFinding, merge, newBranch, openPR, pull, push,
  repoView, reviewPR, setFinding, toggleApproval, unpushed, updateFromBase, useGitBusy,
} from "../lib/actions";
import { Avatar, Btn, Chip, Empty, Glyph, Link, Seg, useKeys } from "../components/ui";
import { BeforeAfter } from "./Briefs";
import { SpecChanges } from "./Spec";

function CommitRow({ project: p, c, dim }: { project: Project; c: Commit; dim?: boolean }) {
  const by = person(c.by);
  return (
    <li className={cx("commit", dim && "dim", c.by === "claude" && "claude")}>
      <span className="commit-ico">{c.merge ? <GitMerge /> : <GitCommitHorizontal />}</span>
      <div className="commit-row">
        <span className="commit-msg">{c.msg}</span>
        <span className="commit-meta"><Avatar p={by} size="sm" />{by.name.split(" ")[0]}, {c.when.toLowerCase()} <code>{c.id}</code>{!c.pushed && <Chip tone="warn">Not pushed</Chip>}</span>
        {c.changes.length > 0 && <ul className="change">{c.changes.slice(0, 6).map((x, i) => (
          <li key={i} className="change-row"><code>{x.file}</code><span className="change-what">{x.what}</span>{x.screenId && p.screens.some((s) => s.id === x.screenId) && <Link to={`/p/${p.id}/review/${x.screenId}`} className="link"><Crosshair /></Link>}</li>
        ))}{c.changes.length > 6 && <li className="muted">and {c.changes.length - 6} more</li>}</ul>}
      </div>
    </li>
  );
}

function SyncBar({ project: p }: { project: Project }) {
  const d = useData(), me = useMe(), busy = useGitBusy();
  const r = repoView(d, p), b = r.branches.find((x) => x.name === r.current);
  const ahead = b ? unpushed(b) : 0, behind = b?.incoming.length ?? 0, may = can(me.role, "commit");
  return (
    <div className="sync-bar">
      <span className="meta mono" title="Checked-out branch"><GitBranch />{r.current}</span>
      <span className="sync-remote mono muted" title="Remote">{r.remote}</span>
      <span className="muted">Fetched {r.fetched.toLowerCase()}</span>
      <span className="toolbar-space" />
      <Btn size="sm" mock icon={<RefreshCw />} busy={busy === "fetch"} onClick={() => fetchRemote(p.id)}>Fetch</Btn>
      <Btn size="sm" mock icon={<ArrowDown />} busy={busy === "pull"} disabled={!may} why={WHY_NOT.commit} onClick={() => pull(p.id)}>Pull{behind ? ` ${behind}` : ""}</Btn>
      <Btn size="sm" mock variant={ahead && !behind ? "primary" : "default"} icon={<ArrowUp />} busy={busy === "push"} disabled={!may || behind > 0} why={!may ? WHY_NOT.commit : "Pull first: origin has commits this branch does not."} onClick={() => push(p.id)}>
        {b?.remote ? `Push${ahead ? ` ${ahead}` : ""}` : "Publish branch"}
      </Btn>
    </div>
  );
}

function Commits({ project: p }: { project: Project }) {
  const d = useData(), r = repoView(d, p), b = r.branches.find((x) => x.name === r.current)!;
  const base = b && b.base !== b.name ? r.branches.find((x) => x.name === b.base) : undefined;
  return (
    <div className="hist-col">
      {b.incoming.length > 0 && <><h3 className="hist-h">On origin, not pulled yet <Chip tone="warn">{b.incoming.length} to pull</Chip></h3>
        <ul className="commits incoming">{b.incoming.map((c) => <CommitRow key={c.id} project={p} c={c} />)}</ul></>}
      <h3 className="hist-h">Commits on <code>{b.name}</code> <span className="num muted">{b.commits.length}</span></h3>
      {b.commits.length === 0 ? <p className="commit-none muted">No commits yet. This branch is the same as {b.base}.</p> : <ul className="commits">{b.commits.map((c) => <CommitRow key={c.id} project={p} c={c} />)}</ul>}
      {base && <><h3 className="hist-h hist-base">Before that, on <code>{base.name}</code> {b.behind > 0 && <Chip tone="warn">{b.behind} behind</Chip>}</h3>
        <ul className="commits">{base.commits.slice(b.behind).slice(0, 4).map((c) => <CommitRow key={c.id} project={p} c={c} dim />)}</ul></>}
    </div>
  );
}

function Changes({ project: p }: { project: Project }) {
  const d = useData(), me = useMe(), s = useAi(), r = repoView(d, p), may = can(me.role, "commit");
  const [picked, setPicked] = useState<string[]>(() => r.working.map(changeKey));
  const [msg, setMsg] = useState(""), [by, setBy] = useState<"you" | "ai" | "">(""), [drafting, setDrafting] = useState(false);
  useEffect(() => setPicked((x) => { const keys = r.working.map(changeKey); return [...new Set([...x.filter((k) => keys.includes(k)), ...keys.filter((k) => !x.includes(k))])]; }), [r.working.length]);
  const sel = r.working.filter((c) => picked.includes(changeKey(c)));
  const write = async () => { setDrafting(true); const m = await draftCommitMessage(sel); setDrafting(false); if (m) { setMsg(m); setBy("ai"); } };
  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (!msg.trim() || !sel.length) return; commit(p.id, msg, sel.map(changeKey), me.id); setMsg(""); setBy(""); };
  useKeys({ "mod+enter": () => submit() });
  if (!r.working.length) return <Empty title="Nothing to commit" action={<Link to={`/p/${p.id}/history`} className="btn">See the commits</Link>}>Changes from review rounds, options, briefs and the spec collect here until you commit them on <code>{r.current}</code>.</Empty>;
  return (
    <div className="two-col history-two">
      <div>
        <h3 className="hist-h">Uncommitted changes <span className="num muted">{r.working.length}</span></h3>
        <ul className="change">{r.working.map((c: Change) => {
          const k = changeKey(c);
          return (
            <li key={k} className="change-row">
              <label className="check"><input type="checkbox" checked={picked.includes(k)} aria-label={`Include ${c.what}`} onChange={() => setPicked((x) => x.includes(k) ? x.filter((y) => y !== k) : [...x, k])} /><code>{c.file}</code><span className="change-what">{c.what}</span></label>
              {c.screenId && <Link to={`/p/${p.id}/review/${c.screenId}`} className="btn ghost sm icon-only" aria-label="Open screen"><Crosshair /></Link>}
              <button type="button" className="btn ghost sm icon-only" aria-label={`Discard: ${c.what}`} title="Discard this change" disabled={!may} onClick={() => discard(p.id, k)}><Trash2 /></button>
              {c.spec && <SpecChanges changes={[c]} />}
            </li>
          );
        })}</ul>
      </div>
      <form className="commit-form" onSubmit={submit}>
        <h3>Commit to <code>{r.current}</code></h3>
        <label className="field"><span>Message</span><input value={msg} onChange={(e) => { setMsg(e.target.value); setBy("you"); }} placeholder="What changed, in one line" /></label>
        <small className="muted">{by === "ai" ? "AI drafted this from what changed. Edit it if it is wrong." : by === "you" ? "Written by you." : s.on ? "" : "AI is off, so write the message yourself."}</small>
        <div className="form-actions">
          <Btn ai variant="ghost" icon={<Sparkles />} busy={drafting} disabled={!sel.length} onClick={write}>Let AI write the message</Btn>
          <Btn type="submit" variant="primary" icon={<GitCommitHorizontal />} kbd="Ctrl Enter" disabled={!may || !msg.trim() || !sel.length} why={!may ? WHY_NOT.commit : undefined}>Commit {sel.length} {sel.length === 1 ? "change" : "changes"}</Btn>
        </div>
      </form>
    </div>
  );
}

function Branches({ project: p }: { project: Project }) {
  const d = useData(), me = useMe(), r = repoView(d, p), may = can(me.role, "commit");
  const [name, setName] = useState(""), [err, setErr] = useState("");
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!newBranch(p.id, name, me.id)) return setErr(`A branch called ${name.trim()} already exists.`);
    setName(""); setErr("");
  };
  return (
    <div>
      <form className="branch-new field-row" onSubmit={create}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name a new branch, for example compact-board" aria-label="New branch name" disabled={!may} />
        <Btn type="submit" icon={<Plus />} disabled={!may || !name.trim()} why={WHY_NOT.commit}>Branch from {r.current}</Btn>
      </form>
      {err && <p className="err">{err}</p>}
      {!may && <p className="notice">{WHY_NOT.commit}</p>}
      <ul className="plist">{r.branches.map((b) => {
        const pr = r.prs.find((x) => x.from === b.name);
        return (
          <li key={b.name} className="brow">
            <div className="prow-main">
              <span className="brow-name mono"><GitBranch />{b.name}{b.name === r.current && <Chip tone="accent">Checked out</Chip>}{!b.remote && <Chip>Local only</Chip>}{b.merged && <Chip tone="ok">Merged</Chip>}</span>
              <span className="brow-by muted">{person(b.by).name.split(" ")[0]}{b.commits[0] && `, ${b.commits[0].msg}, ${b.commits[0].when.toLowerCase()}`}</span>
              <span className="brow-sync muted">{b.name === b.base ? "Base branch" : <>{b.commits.length} ahead of {b.base}{b.behind > 0 && `, ${b.behind} behind`}</>}</span>
            </div>
            <div className="brow-act">
              {pr ? <Link to={`/p/${p.id}/history/pr/${pr.id}`} className="chip-link"><GitPullRequest />#{pr.id}</Link>
                : b.name !== b.base && b.commits.length > 0 && !b.merged && <Btn size="sm" icon={<GitPullRequest />} disabled={!may} why={WHY_NOT.commit}
                  onClick={() => go(`/p/${p.id}/history/pr/${openPR(p.id, { from: b.name, title: b.commits[0].msg, about: `${b.commits.length} commits from ${b.name}.`, by: me.id })}`)}>Open pull request</Btn>}
              {b.behind > 0 && <Btn size="sm" disabled={!may} why={WHY_NOT.commit} onClick={() => updateFromBase(p.id, b.name)}>Update from {b.base}</Btn>}
              {b.name !== r.current && !b.merged && <Btn size="sm" variant="ghost" disabled={!may} why={WHY_NOT.commit} onClick={() => checkout(p.id, b.name)}>Check out</Btn>}
            </div>
          </li>
        );
      })}</ul>
    </div>
  );
}

const count = (pr: PR) => ({ block: pr.findings.filter((f) => f.state === "open" && f.level === "block").length, warn: pr.findings.filter((f) => f.state === "open" && f.level === "warn").length, note: pr.findings.filter((f) => f.state === "open" && f.level === "note").length });
const KIND: Record<string, string> = { conflict: "Conflict", rule: "Spec rule", pattern: "Inconsistent pattern", gap: "Design gap", incomplete: "Incomplete", direction: "Direction" };
const LEVEL: Record<string, { label: string; tone?: string }> = { block: { label: "Must fix", tone: "bad" }, warn: { label: "Worth a look", tone: "warn" }, note: { label: "Note" } };

function Prs({ project: p }: { project: Project }) {
  const d = useData(), r = repoView(d, p);
  if (!r.prs.length) return <Empty title="No pull requests yet" action={<Link to={`/p/${p.id}/history/branches`} className="btn">See the branches</Link>}>Open one from a branch, or run a brief that lands on a new branch.</Empty>;
  return (
    <ul className="plist">{r.prs.map((x) => {
      const n = count(x);
      return (
        <li key={x.id} className="prow pr">
          <div className="prow-main">
            <Link to={`/p/${p.id}/history/pr/${x.id}`} className="prow-name">{x.status === "merged" ? <GitMerge /> : <GitPullRequest />} {x.title} <span className="muted">#{x.id}</span></Link>
            <span className="prow-meta mono">{x.from} → {x.into}</span>
            <span className="prow-meta"><Avatar p={person(x.by)} size="sm" />{person(x.by).name.split(" ")[0]}, {x.when.toLowerCase()}</span>
          </div>
          <div className="prow-review">
            {x.status === "merged" ? <Chip tone="ok">Merged</Chip> : x.review === "none" ? <Chip>Not reviewed by Claude yet</Chip> : x.review === "running" ? <Chip tone="accent">Claude is reviewing</Chip>
              : n.block ? <Chip tone="bad">{n.block} must fix, {n.warn} worth a look</Chip> : n.warn ? <Chip tone="warn">{n.warn} worth a look</Chip> : <Chip tone="ok">Review is clean</Chip>}
            {x.approvals.length > 0 && <Chip tone="ok"><Check />{x.approvals.length} approved</Chip>}
          </div>
        </li>
      );
    })}</ul>
  );
}

function PrPage({ project: p, pr }: { project: Project; pr: PR }) {
  const d = useData(), me = useMe(), r = repoView(d, p);
  const from = r.branches.find((b) => b.name === pr.from);
  const changes = [...(from?.commits ?? [])].reverse().flatMap((c) => c.changes);
  const screens = [...new Set(changes.filter((c) => c.screenId).map((c) => c.screenId!))].map((id) => {
    const cs = changes.filter((c) => c.screenId === id), screen = p.screens.find((s) => s.id === id) ?? cs.find((c) => c.add)?.add;
    return screen ? { screen, what: [...new Set(cs.map((c) => c.what))], from: cs.find((c) => c.from)?.from, to: [...cs].reverse().find((c) => c.to)?.to, isNew: cs.some((c) => c.add) } : null;
  }).filter(Boolean) as { screen: NonNullable<ReturnType<typeof p.screens.find>>; what: string[]; from?: Change["from"]; to?: Change["to"]; isNew: boolean }[];
  const n = count(pr), merged = pr.status === "merged", mine = pr.approvals.includes(me.id);
  const mayCommit = can(me.role, "commit"), mayApprove = can(me.role, "approve"), mayMerge = can(me.role, "merge");
  const checks: [boolean, string][] = [
    [pr.review === "done", pr.review === "done" ? "Claude has reviewed it" : "Claude has not reviewed it"],
    [n.block === 0, n.block ? `${n.block} must-fix ${n.block === 1 ? "finding is" : "findings are"} open` : "No must-fix finding is open"],
    [pr.approvals.length > 0, pr.approvals.length ? `Approved by ${pr.approvals.map((a) => person(a).name.split(" ")[0]).join(", ")}` : "Nobody has approved it"],
    [!from?.behind, from?.behind ? `${from.behind} behind ${pr.into}` : `Up to date with ${pr.into}`],
  ];
  const ready = checks.every(([ok]) => ok);
  return (
    <div className="page wide">
      <div className="crumb"><Link to={`/p/${p.id}/history/prs`}>Pull requests</Link></div>
      <div className="pr-title">
        <h2>{pr.title} <span className="muted">#{pr.id}</span></h2>
        <span className="mono"><code>{pr.from}</code> → <code>{pr.into}</code></span>
        <span className="muted">{person(pr.by).name.split(" ")[0]}, {pr.when.toLowerCase()}</span>
        {merged ? <Chip tone="ok"><GitMerge />Merged</Chip> : <Chip tone={n.block ? "bad" : ready ? "ok" : undefined}>{n.block ? "Blocked" : ready ? "Ready to merge" : "Open"}</Chip>}
      </div>
      <p>{pr.about}</p>
      <section className="findings">
        <div className="toolbar"><h3><Glyph size={16} /> Claude's review</h3>
          {pr.review === "done" && <span className="muted">{n.block} must fix, {n.warn} worth a look, {n.note} {n.note === 1 ? "note" : "notes"}</span>}
          <span className="toolbar-space" />
          {!merged && <Btn ai mock icon={<Sparkles />} busy={pr.review === "running"} disabled={!mayApprove} why={WHY_NOT.approve} onClick={() => void reviewPR(p.id, pr.id)}>{pr.review === "running" ? "Reviewing" : pr.review === "done" ? "Review again" : "Ask AI to review"}</Btn>}
        </div>
        {pr.review === "none" && <p className="muted">Claude checks the branch against {pr.into}, the spec and the toolkit: conflicts, broken rules, inconsistent patterns and missing states.</p>}
        {pr.review === "running" && <p className="muted"><span className="spin" /> Claude is reading the branch, the spec and the screens.</p>}
        <ul>{pr.findings.map((f) => {
          const s = p.screens.find((x) => x.id === f.screenId);
          return (
            <li key={f.id} className={cx("finding", f.level, f.state)}>
              <div className="finding-head"><Chip tone={LEVEL[f.level].tone}>{LEVEL[f.level].label}</Chip><span className="finding-kind">{KIND[f.kind]}</span><b>{f.title}</b>
                {f.state === "fixed" && <Chip tone="ok"><Check />Fixed</Chip>}{f.state === "waived" && <Chip>Left as is</Chip>}</div>
              <p>{f.detail}</p>
              <div className="entry-meta">{s && <Link to={`/p/${p.id}/review/${s.id}`} className="entry-screen"><Crosshair />{s.name}</Link>}{f.ruleId && <Link to={`/p/${p.id}/spec`} className="entry-screen">{f.ruleId} in the spec</Link>}</div>
              {f.state === "open" && !merged && (f.fix || f.level !== "note") && (
                <div className="entry-act">
                  {f.fix && <Btn size="sm" mock ai icon={<Sparkles />} disabled={!mayCommit} why={WHY_NOT.commit} title={f.fix} onClick={() => fixFinding(p.id, pr.id, f.id)}>Fix: {f.fix.charAt(0).toLowerCase() + f.fix.slice(1).replace(/\.$/, "")}</Btn>}
                  {f.level !== "note" && <Btn size="sm" variant="ghost" disabled={!mayApprove} why={WHY_NOT.approve} onClick={() => setFinding(p.id, pr.id, f.id)}>Leave as is</Btn>}
                </div>
              )}
              {f.state !== "open" && !merged && <button type="button" className="link" onClick={() => setFinding(p.id, pr.id, f.id, "open")}>Reopen</button>}
            </li>
          );
        })}</ul>
      </section>
      <section><h3 className="hist-h">Screens changed <span className="num muted">{screens.length}</span></h3>
        <ul className="pr-screens">{screens.map((x) => (
          <li key={x.screen.id}><div className="toolbar"><b>{x.screen.name}</b>{x.isNew && <Chip tone="accent">New</Chip>}<span className="muted">{x.what.join("; ")}</span><span className="toolbar-space" />{!x.isNew && <Link to={`/p/${p.id}/review/${x.screen.id}`} className="link">Open</Link>}</div>
            {(x.from || x.isNew) && <BeforeAfter project={p} screen={x.screen} from={x.from} to={x.to} />}</li>
        ))}</ul>
      </section>
      {changes.some((c) => c.spec) && <section><h3 className="hist-h">Spec changes <span className="num muted">{changes.filter((c) => c.spec).length}</span></h3><SpecChanges changes={changes.filter((c) => c.spec)} /></section>}
      <section><h3 className="hist-h">Commits <span className="num muted">{from?.commits.length ?? 0}</span></h3><ul className="commits">{from?.commits.map((c) => <CommitRow key={c.id} project={p} c={c} />)}</ul></section>
      {!merged && (
        <section className="merge-box">
          <ul className="merge-checks">{checks.map(([ok, t]) => <li key={t} className={ok ? "ok" : "no"}>{ok ? <Check /> : <X />}{t}</li>)}</ul>
          <div className="form-actions">
            <Btn variant={mine ? "default" : "primary"} icon={<Check />} disabled={!mayApprove} why={WHY_NOT.approve} onClick={() => toggleApproval(p.id, pr.id, me.id)}>{mine ? "Withdraw my approval" : "Approve"}</Btn>
            <Btn variant={ready ? "primary" : "default"} mock icon={<GitMerge />} disabled={!mayMerge} why={WHY_NOT.merge} onClick={() => merge(p.id, pr.id, me.id)}>Merge into {pr.into}</Btn>
            {r.current !== pr.from && <Btn variant="ghost" disabled={!mayCommit} why={WHY_NOT.commit} onClick={() => { checkout(p.id, pr.from); go(`/p/${p.id}`); }}>Check out to try it</Btn>}
          </div>
        </section>
      )}
    </div>
  );
}

export function History({ project: p, parts }: { project: Project; parts: string[] }) {
  const d = useData(), r = repoView(d, p), [view, id] = parts;
  if (view === "pr") {
    const pr = r.prs.find((x) => x.id === Number(id));
    return pr ? <PrPage project={p} pr={pr} /> : <div className="page"><Empty title="No such pull request" action={<Link to={`/p/${p.id}/history/prs`} className="btn">Pull requests</Link>}>It may be on another scenario.</Empty></div>;
  }
  const tab = (["changes", "branches", "prs"].includes(view) ? view : "commits") as "commits" | "changes" | "branches" | "prs";
  return (
    <div className="page wide">
      <div className="toolbar">
        <Seg label="Part of the history" value={tab} onChange={(v) => go(`/p/${p.id}/history${v === "commits" ? "" : `/${v}`}`)} options={[
          { value: "commits", label: "Commits" }, { value: "changes", label: `Uncommitted ${r.working.length || ""}`.trim() },
          { value: "branches", label: `Branches ${r.branches.length}` }, { value: "prs", label: `Pull requests ${r.prs.filter((x) => x.status === "open").length || ""}`.trim() },
        ]} />
      </div>
      <SyncBar project={p} />
      {tab === "changes" ? <Changes project={p} /> : tab === "branches" ? <Branches project={p} /> : tab === "prs" ? <Prs project={p} /> : <Commits project={p} />}
    </div>
  );
}
