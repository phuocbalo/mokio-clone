import { useEffect, useState, type ReactNode } from "react";
import { GitBranch, ChevronDown, Pin, PinOff, Maximize2, MessageSquare, Crosshair, Sun, Moon, Monitor, Smartphone, Tablet, ArrowDown, ArrowUp, Plus, GitCommitHorizontal } from "lucide-react";
import type { Project, Screen } from "../lib/types";
import { LAYOUTS, can, WHY_NOT } from "../lib/catalog";
import { cx, go, pinsOf, setPrefs, togglePin, toast, useData, useMe, usePrefs } from "../lib/store";
import { checkout, pull, push, repoView, setProjectSystem, unpushed, useGitBusy } from "../lib/actions";
import { Preview, PREVIEW_SIZE } from "../components/Preview";
import { Btn, Chip, Link, Menu, MenuItem, Seg, StatusChip, SysDot, useMode } from "../components/ui";
import { PLATFORMS } from "./Projects";
import { Review } from "./Review";
import { Options } from "./Options";
import { SpecPage } from "./Spec";
import { Briefs } from "./Briefs";
import { History } from "./History";
import { Planned } from "../App";

export const DEVICE_SIZE = PREVIEW_SIZE;

/** Previews scale themselves; on a phone they also keep to a phone's width. */
export function Fit({ children, device, className }: { children: ReactNode; device: keyof typeof PREVIEW_SIZE; className?: string }) {
  return <div className={cx(device === "phone" && "pv-phone-fit", className)}>{children}</div>;
}

function Header({ project: p, tab }: { project: Project; tab: string }) {
  const d = useData(), me = useMe(), busy = useGitBusy();
  const repo = repoView(d, p), ds = d.systems.find((s) => s.id === p.dsId);
  const branch = repo.branches.find((b) => b.name === repo.current);
  const ahead = branch ? unpushed(branch) : 0, behind = branch?.incoming.length ?? 0;
  const mayCommit = can(me.role, "commit");
  const drafts = d.comments.filter((c) => c.projectId === p.id && c.status === "draft").length;
  const openRounds = d.rounds.filter((r) => r.projectId === p.id && r.status !== "applied").length;
  const openPrs = repo.prs.filter((x) => x.status === "open").length;
  const tabs = [
    { id: "", label: "Screens", count: p.screens.length },
    { id: "review", label: "Review", count: drafts },
    { id: "options", label: "Options", count: openRounds },
    { id: "spec", label: "Spec" },
    { id: "briefs", label: "Briefs" },
    { id: "history", label: "History", count: repo.working.length + openPrs },
    { id: "plan", label: "Build plan", planned: true },
    { id: "audit", label: "Audit", planned: true },
  ];
  return (
    <div className="phead">
      <div className="phead-top">
        <div className="crumb"><Link to="/projects">Prototypes</Link></div>
        <h1 className="phead-title">{p.name}</h1>
        <div className="phead-meta">
          <span className="meta">{PLATFORMS[p.platform].icon}{p.framework || PLATFORMS[p.platform].label}</span>
          <Menu className="meta meta-btn" label="Design system for this prototype" button={<><SysDot ds={ds} />{ds?.name ?? "No design system"}<ChevronDown className="chev" /></>}>
            {(close) => <>
              <div className="menu-label">Design system</div>
              {d.systems.map((s) => <MenuItem key={s.id} on={s.id === p.dsId} icon={<SysDot ds={s} />} onClick={() => { close(); if (!can(me.role, "create")) return toast(WHY_NOT.create); setProjectSystem(p.id, s.id); toast(`${p.name} now uses ${s.name}. Every screen was restyled.`); }}>{s.name}</MenuItem>)}
              {ds && <><div className="menu-sep" /><MenuItem onClick={() => { close(); go(`/library/design-systems/${ds.id}`); }}>Open in the library</MenuItem></>}
            </>}
          </Menu>
          <Menu className="meta meta-btn mono" label="Branch: switch, pull or push" button={<><GitBranch />{repo.current}{ahead > 0 && <span className="num"> <ArrowUp />{ahead}</span>}{behind > 0 && <span className="num"> <ArrowDown />{behind}</span>}<ChevronDown className="chev" /></>}>
            {(close) => <>
              <div className="menu-label">Switch branch</div>
              {repo.branches.filter((b) => !b.merged).map((b) => <MenuItem key={b.name} on={b.name === repo.current} hint={b.name === repo.current ? "Checked out" : b.remote ? undefined : "Local only"} onClick={() => { close(); checkout(p.id, b.name); }}>{b.name}</MenuItem>)}
              <div className="menu-sep" />
              <MenuItem icon={<ArrowDown />} hint={behind ? `${behind} to pull` : "Up to date"} onClick={() => { close(); pull(p.id); }}>{busy === "pull" ? "Pulling…" : "Pull"}</MenuItem>
              <MenuItem icon={<ArrowUp />} hint={ahead ? `${ahead} to push` : "Nothing to push"} onClick={() => { close(); push(p.id); }}>{busy === "push" ? "Pushing…" : "Push"}</MenuItem>
              <MenuItem icon={<Plus />} onClick={() => { close(); mayCommit ? go(`/p/${p.id}/history/branches`) : toast(WHY_NOT.commit); }}>New branch</MenuItem>
              <MenuItem icon={<GitCommitHorizontal />} hint={repo.working.length ? `${repo.working.length} uncommitted` : undefined} onClick={() => { close(); go(`/p/${p.id}/history/changes`); }}>Commit changes</MenuItem>
            </>}
          </Menu>
        </div>
      </div>
      <nav className="tabs" aria-label={`${p.name} sections`}>
        {tabs.map((t) => (
          <Link key={t.id} to={`/p/${p.id}${t.id ? `/${t.id}` : ""}`} className={cx("tab", tab === t.id && "on")} aria-current={tab === t.id ? "page" : undefined} title={t.planned ? "Planned" : undefined}>
            {t.label}{!!t.count && <span className="tab-count">{t.count}</span>}{t.planned && <span className="tab-planned">Planned</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ScreenMap({ project: p }: { project: Project }) {
  const d = useData(), prefs = usePrefs(), appMode = useMode();
  const [mode, setMode] = useState<"light" | "dark">(appMode);
  const [device, setDevice] = useState<"desktop" | "tablet" | "phone">(prefs.device);
  useEffect(() => setDevice(prefs.device), [prefs.device]);
  const ds = d.systems.find((s) => s.id === p.dsId);
  const pins = pinsOf(prefs, p.id), focus = prefs.focus && pins.length > 0;
  const shown = focus ? p.screens.filter((s) => pins.includes(s.id)) : p.screens;
  const flows = [...new Set(shown.map((s) => s.flow))];
  const comments = (s: Screen) => d.comments.filter((c) => c.projectId === p.id && c.screenId === s.id && c.status === "draft").length;
  const approved = p.screens.filter((s) => s.status === "approved").length;
  return (
    <div className="page wide">
      <div className="toolbar">
        <span className="summary num">{p.screens.length} screens, {approved} approved</span>
        <span className="toolbar-space" />
        <Btn icon={<Crosshair />} className={focus ? "on" : undefined} aria-pressed={focus} disabled={!pins.length} why="Pin a screen first." onClick={() => setPrefs({ focus: !prefs.focus })}>
          {focus ? `Focus on pinned ${pins.length}` : "Focus on pinned"}
        </Btn>
        <Seg label="Preview theme" iconOnly value={mode} onChange={setMode} options={[{ value: "light", label: "Light", icon: <Sun /> }, { value: "dark", label: "Dark", icon: <Moon /> }]} />
        <Seg label="Preview device" iconOnly value={device} onChange={setDevice} options={[{ value: "desktop", label: "Desktop", icon: <Monitor /> }, { value: "tablet", label: "Tablet", icon: <Tablet /> }, { value: "phone", label: "Phone", icon: <Smartphone /> }]} />
      </div>
      {p.drafting ? <p className="notice"><span className="spin" /> Claude is drafting from your brief: {p.screens.length - p.drafting} of {p.screens.length} screens.</p> : null}
      {focus && <p className="focus-note"><Crosshair /> Showing {pins.length} pinned {pins.length === 1 ? "screen" : "screens"} only. Review, the full-window view and new briefs follow the same focus. <button type="button" className="link" onClick={() => setPrefs({ focus: false })}>Show all {p.screens.length}</button></p>}
      {flows.map((f) => (
        <section key={f} className="sgroup">
          <h2>{f}</h2>
          <ul className={cx("tiles", device === "phone" && "phone")}>
            {shown.filter((s) => s.flow === f).map((s) => {
              const pinned = pins.includes(s.id), n = comments(s);
              return (
                <li key={s.id} className={cx("tile", pinned && "pinned")}>
                  <div className="tile-tools">
                    <button type="button" className="btn sm icon-only" aria-pressed={pinned} aria-label={pinned ? `Unpin ${s.name}` : `Pin ${s.name}`} title={pinned ? "Unpin" : "Pin this screen"} onClick={() => toast(togglePin(p.id, s.id) ? `${s.name} pinned. It stays in Mokio's navigation.` : `${s.name} unpinned.`)}>{pinned ? <PinOff /> : <Pin />}</button>
                    <Link to={`/p/${p.id}/run/${s.id}`} className="btn sm icon-only" aria-label={`Open ${s.name} at full window size`} title="Open at full window size"><Maximize2 /></Link>
                  </div>
                  <Link to={`/p/${p.id}/review/${s.id}`} className="tile-link" aria-label={`Review ${s.name}`}>
                    {p.drafting && p.screens.indexOf(s) >= p.screens.length - p.drafting
                      ? <div className="skeleton"><div className="skel-box" /><div className="skel-line" /></div>
                      : <Fit device={device}><Preview project={p} screen={s} ds={ds} mode={mode} device={device} /></Fit>}
                  </Link>
                  <div className="tile-row"><b>{s.name}</b><StatusChip status={s.status} /></div>
                  <div className="tile-meta">
                    <span>{LAYOUTS[s.kind][s.variant].name}</span>
                    {n > 0 && <span className="tile-comments"><MessageSquare />{n}</span>}
                    {s.mock > 0 && <span title="Controls on this screen that only pretend" className="muted">{s.mock} pretend</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!p.screens.length && <Chip>No screens yet</Chip>}
    </div>
  );
}

export function ProjectPage({ project, parts }: { project: Project; parts: string[] }) {
  const tab = parts[2] ?? "";
  let body: ReactNode;
  if (tab === "review") body = <Review project={project} screenId={parts[3]} sent={parts[4] === "sent"} />;
  else if (tab === "options") body = <Options project={project} roundId={parts[3]} />;
  else if (tab === "spec") body = <SpecPage project={project} />;
  else if (tab === "briefs") body = <Briefs project={project} briefId={parts[3]} />;
  else if (tab === "history") body = <History project={project} parts={parts.slice(3)} />;
  else if (tab === "plan" || tab === "audit") body = <Planned id={tab} back={{ to: `/p/${project.id}`, label: "Back to the screen map" }} />;
  else body = <ScreenMap project={project} />;
  return <><Header project={project} tab={["review", "options", "spec", "briefs", "history", "plan", "audit"].includes(tab) ? tab : ""} />{body}</>;
}
