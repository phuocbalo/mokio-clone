import { useRef, useState } from "react";
import { Plus, Search, FolderGit2, MoreHorizontal, Globe, Monitor, Smartphone, Sparkles, Check, X, MessageSquare } from "lucide-react";
import { go, useData, useMe, toast, useAi } from "../lib/store";
import { WHY_NOT, can } from "../lib/catalog";
import { archiveProject, cloneRepo, createProject, duplicateProject } from "../lib/actions";
import type { Platform, Project } from "../lib/types";
import { Btn, Chip, Dialog, Empty, Link, Menu, MenuItem, Seg, SysDot, useKeys } from "../components/ui";

export const PLATFORMS: Record<Platform, { label: string; icon: React.ReactNode }> = {
  web: { label: "Web", icon: <Globe /> }, desktop: { label: "Desktop", icon: <Monitor /> }, mobile: { label: "Mobile", icon: <Smartphone /> },
};
export const FRAMEWORKS: Record<Platform, string[]> = {
  web: ["React + Tailwind (web)"], desktop: ["Tauri + React (desktop)"], mobile: ["React Native (mobile)", "Flutter (mobile)"],
};

/** A strip of screen statuses: the prototype's thumbnail. */
const Strip = ({ project }: { project: Project }) => (
  <div className="rbar">{project.screens.map((s) => <i key={s.id} className={s.status} />)}</div>
);

const STEPS = ["Receiving objects", "Reading the manifest, the spec and the seed table", "Drawing the screens"];
const EXAMPLES = ["git@github.com:ralts/shiftly-prototype.git", "https://gitlab.com/hugepigstudio/ledgerly-prototype.git"];

function CloneDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [addr, setAddr] = useState(""), [step, setStep] = useState(-1);
  const ok = /^(git@[\w.-]+:[\w./-]+|https:\/\/[\w.-]+\/[\w./-]+)$/.test(addr.trim());
  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    STEPS.forEach((_, i) => window.setTimeout(() => setStep(i), 500 * i));
    window.setTimeout(() => {
      const id = cloneRepo(addr.trim());
      setStep(-1); setAddr(""); onClose(); go(`/p/${id}`);
      toast("Cloned. The history, branches and spec came with it.");
    }, 500 * STEPS.length + 200);
    setStep(0);
  };
  return (
    <Dialog open={open} onClose={onClose} label="Clone a prototype" className="clone">
      <form onSubmit={start} noValidate>
        <div className="toolbar"><h2>Clone a prototype</h2><span className="toolbar-space" /><button type="button" className="btn ghost icon-only" aria-label="Close" onClick={onClose}><X /></button></div>
        <label className="field"><span>Repository address</span>
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="git@github.com:team/app-prototype.git" autoFocus disabled={step >= 0} aria-invalid={!!addr && !ok} />
        </label>
        {addr && !ok && <p className="err">Use an SSH address (git@host:team/repo.git) or an HTTPS one.</p>}
        {step < 0 ? (
          <div className="picks">{EXAMPLES.map((x) => <button key={x} type="button" className="pick" onClick={() => setAddr(x)}>{x.replace(/^git@|^https:\/\//, "")}</button>)}</div>
        ) : (
          <ol className="steps">{STEPS.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "now" : undefined}><span className="step-mark">{i < step ? <Check /> : i === step ? <span className="spin" /> : i + 1}</span>{s}</li>)}</ol>
        )}
        <p className="fine">Cloning is simulated in this version: Mokio makes a prototype named after the repository with the standard template.</p>
        <div className="form-actions">
          <Btn type="submit" variant="primary" icon={<FolderGit2 />} busy={step >= 0} disabled={!ok}>Clone</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Dialog>
  );
}

export function Projects() {
  const d = useData(), me = useMe();
  const [q, setQ] = useState(""), [platform, setPlatform] = useState<"all" | Platform>("all"), [cloning, setCloning] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const may = can(me.role, "create");
  useKeys({ n: () => (may ? go("/projects/new") : toast(WHY_NOT.create)), "/": () => search.current?.focus() });
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = d.projects.filter((p) => (platform === "all" || p.platform === platform) && words.every((w) => `${p.name} ${p.tagline}`.toLowerCase().includes(w)));
  const drafts = (id: string) => d.comments.filter((c) => c.projectId === id && c.status === "draft").length;
  return (
    <div className="page">
      <CloneDialog open={cloning} onClose={() => setCloning(false)} />
      <div className="page-head">
        <h1>Prototypes</h1>
        <span className="toolbar-space" />
        <Btn icon={<FolderGit2 />} disabled={!may} why={WHY_NOT.create} onClick={() => setCloning(true)}>Clone</Btn>
        <Btn variant="primary" className="new-prototype" icon={<Plus />} kbd="N" disabled={!may} why={WHY_NOT.create} onClick={() => go("/projects/new")}>New prototype</Btn>
      </div>
      {d.projects.length === 0 ? (
        <Empty title="No prototypes yet" action={<Btn variant="primary" icon={<Plus />} disabled={!may} why={WHY_NOT.create} onClick={() => go("/projects/new")}>Start from a brief</Btn>}>
          Write a brief, pick a design system, and Claude drafts the first screens. Or clone a prototype someone already started.
        </Empty>
      ) : (
        <>
          <div className="toolbar">
            <label className="search"><Search /><input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prototypes" aria-label="Search prototypes" /><kbd className="search-kbd">/</kbd></label>
            <Seg label="Platform" value={platform} onChange={setPlatform} options={[{ value: "all", label: "All" }, ...(Object.keys(PLATFORMS) as Platform[]).map((k) => ({ value: k, label: PLATFORMS[k].label }))]} />
            <span className="toolbar-note num">{list.length} of {d.projects.length}</span>
          </div>
          {list.length === 0 ? (
            <Empty title={q ? `Nothing matches "${q}"` : `No ${platform} prototypes yet`}>{q ? "Check the spelling, or clear the search." : "Start one from a brief and choose this platform; the framework and device frame follow."}</Empty>
          ) : (
            <ul className="plist">{list.map((p) => {
              const ds = d.systems.find((s) => s.id === p.dsId), n = drafts(p.id);
              const approved = p.screens.filter((s) => s.status === "approved").length;
              return (
                <li key={p.id} className="prow">
                  <Link to={`/p/${p.id}`} className="prow-thumb" tabIndex={-1} aria-hidden="true">{p.drafting ? <span className="drafting"><Sparkles /></span> : <Strip project={p} />}</Link>
                  <div className="prow-main">
                    <Link to={`/p/${p.id}`} className="prow-name">{p.name}</Link>
                    <span className="prow-tag">{p.tagline}</span>
                    <span className="prow-meta">
                      <span>{PLATFORMS[p.platform].icon}{PLATFORMS[p.platform].label}</span>
                      <span><SysDot ds={ds} />{ds?.name ?? "No design system"}</span>
                      {p.drafting ? <span>Claude is drafting, {p.screens.length - p.drafting} of {p.screens.length}</span> : <span className="num">{approved} of {p.screens.length} screens approved</span>}
                    </span>
                  </div>
                  <div className="prow-review">{n > 0 ? <Link to={`/p/${p.id}/review`}><Chip tone="warn"><MessageSquare />{n} draft {n === 1 ? "comment" : "comments"}</Chip></Link> : <span className="muted">No draft comments</span>}</div>
                  <span className="prow-when">{p.updated}</span>
                  <Menu className="btn ghost icon-only" label={`Actions for ${p.name}`} align="end" button={<MoreHorizontal />}>
                    {(close) => <>
                      <MenuItem onClick={() => { close(); go(`/p/${p.id}`); }}>Open screen map</MenuItem>
                      <MenuItem onClick={() => { close(); go(`/p/${p.id}/review`); }}>Review</MenuItem>
                      <MenuItem onClick={() => { close(); go(`/p/${p.id}/spec`); }}>Spec</MenuItem>
                      <MenuItem onClick={() => { close(); go(`/p/${p.id}/history`); }}>History</MenuItem>
                      <div className="menu-sep" />
                      <MenuItem onClick={() => { close(); duplicateProject(p.id); }}>Duplicate</MenuItem>
                      <MenuItem danger onClick={() => { close(); archiveProject(p.id); }}>Archive</MenuItem>
                    </>}
                  </Menu>
                </li>
              );
            })}</ul>
          )}
        </>
      )}
    </div>
  );
}

const IDEAS = [
  "A shift-swap app for a chain of cafés. Staff see the rota, offer shifts and accept swaps; managers approve.",
  "An internal tool for the finance team to chase unpaid invoices, with reminders and a ledger per client.",
];

export function NewProject() {
  const d = useData(), me = useMe(), s = useAi();
  const [name, setName] = useState(""), [brief, setBrief] = useState(""), [platform, setPlatform] = useState<Platform>("web");
  const [dsId, setDsId] = useState(d.systems[0]?.id ?? ""), [framework, setFramework] = useState(FRAMEWORKS.web[0]), [tried, setTried] = useState(false);
  const may = can(me.role, "create");
  const errs = {
    name: !name.trim() ? "Give the prototype a name." : d.projects.some((p) => p.name.toLowerCase() === name.trim().toLowerCase()) ? "A prototype with this name already exists." : "",
    brief: brief.trim().length < 20 ? "Write a sentence or two, so Claude knows what to draft." : "",
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTried(true);
    if (!may || errs.name || errs.brief) return;
    go(`/p/${createProject({ name, brief, platform, dsId, framework })}`);
  };
  return (
    <div className="page">
      <div className="page-head"><div className="crumb"><Link to="/projects">Prototypes</Link></div><h1>Start from a brief</h1></div>
      <form className="form narrow" onSubmit={submit} noValidate>
        {!may && <p className="notice warn">{WHY_NOT.create}</p>}
        {!s.on && <p className="notice">{s.why} The prototype starts from the template, with nothing drafted from the brief.</p>}
        <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shiftly" autoFocus aria-invalid={tried && !!errs.name} />{tried && errs.name && <small className="err">{errs.name}</small>}</label>
        <label className="field"><span>Brief</span><textarea rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Who uses it, what they do, and anything it must not do." aria-invalid={tried && !!errs.brief} />
          {tried && errs.brief ? <small className="err">{errs.brief}</small> : <small className="muted">Claude drafts the screens, flows, roles and sample records from this.</small>}
        </label>
        <div className="ideas">{IDEAS.map((x) => <button key={x} type="button" className="idea" onClick={() => setBrief(x)}>{x}</button>)}</div>
        <div className="field"><span>Platform</span>
          <Seg label="Platform" value={platform} onChange={(v) => { setPlatform(v); setFramework(FRAMEWORKS[v][0]); }} options={(Object.keys(PLATFORMS) as Platform[]).map((k) => ({ value: k, label: PLATFORMS[k].label, icon: PLATFORMS[k].icon }))} />
        </div>
        <fieldset className="field"><legend>Design system</legend>
          <div className="picks">{d.systems.map((x) => (
            <label key={x.id} className={`pick${x.id === dsId ? " on" : ""}`}>
              <input type="radio" name="ds" checked={x.id === dsId} onChange={() => setDsId(x.id)} /><SysDot ds={x} />
              <span className="pick-text"><b>{x.name}</b><small>{x.sans}, {x.radius}px corners</small></span>
            </label>
          ))}</div>
        </fieldset>
        <label className="field"><span>Framework</span><select value={framework} onChange={(e) => setFramework(e.target.value)}>{FRAMEWORKS[platform].map((f) => <option key={f}>{f}</option>)}</select>
          <small className="muted">Uses the house toolkit. The standard shell is added for you: themes, zoom, density, personas, flows and the command palette.</small>
        </label>
        <div className="form-actions">
          <Btn type="submit" variant="primary" icon={<Sparkles />} disabled={!may} why={WHY_NOT.create}>{s.on ? "Create and draft with Claude" : "Create from template"}</Btn>
          <Btn variant="ghost" onClick={() => go("/projects")}>Cancel</Btn>
        </div>
      </form>
    </div>
  );
}
