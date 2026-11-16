// Draws a prototype screen from the house toolkit. Every part a reviewer can comment on carries data-el.
import { useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Bell, Search, Plus, Filter, Home, Layers, Users, Settings, BarChart3, Inbox } from "lucide-react";
import type { Project, Screen, DesignSystem } from "../lib/types";
import { cssVars } from "../lib/theme";
import { HOUSE_SYSTEM, cx } from "../lib/store";

const PEOPLE = ["An", "Bao", "Chi", "Dung", "Giang", "Hanh"];
const STAGES = ["Open", "In review", "Done", "Blocked"];
const DATES = ["12 Nov", "14 Nov", "18 Nov", "21 Nov", "2 Dec", "9 Dec"];
const ICONS = [Home, Layers, Search, Users, Settings, BarChart3, Inbox];
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const item = (p: Project, i: number) => p.items[i % p.items.length] ?? "Item";

export function El({ id, label, className, style, children }: { id: string; label: string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return <div data-el={id} data-label={label} className={className} style={style}>{children}</div>;
}
const Av = ({ n }: { n: number }) => <span className={`pv-av t${n % 5}`}>{PEOPLE[n % PEOPLE.length][0]}</span>;
const Tag = ({ n, children }: { n: number; children: ReactNode }) => <span className={`pv-tag t${n % 5}`}>{children}</span>;
const Lines = ({ n }: { n: number }) => <div className="pv-lines">{range(n).map((i) => <i key={i} style={{ width: i === n - 1 ? "60%" : i % 2 ? "92%" : "100%" }} />)}</div>;

function Card({ p, n }: { p: Project; n: number }) {
  return (
    <El id={`board.card.${n}`} label="Card" className="pv-card">
      <div className="pv-card-t">{item(p, n)}</div>
      <div className="pv-row"><Tag n={n}>{STAGES[n % 4]}</Tag><span className="pv-mono pv-push">{DATES[n % DATES.length]}</span><Av n={n} /></div>
    </El>
  );
}

function Board({ p, v }: { p: Project; v: number }) {
  if (v === 1) return (
    <div className="pv-lanes">{range(4).map((l) => (
      <div key={l} className="pv-lane">
        <El id={`board.col.${l}.head`} label={`${PEOPLE[l]}'s lane header`} className="pv-lane-head"><Av n={l} /><b>{PEOPLE[l]}</b><span className="pv-count">{4 - l}</span></El>
        <El id={`board.col.${l}`} label={`${PEOPLE[l]}'s lane`} className="pv-lane-cards">{range(4 - l).map((i) => <Card key={i} p={p} n={l * 4 + i} />)}</El>
      </div>))}
    </div>
  );
  if (v === 2) return (
    <div className="pv-panel pv-scroll">{["Doing", "Backlog", "Done"].map((g, gi) => (
      <El key={g} id={`board.col.${gi}`} label={`${g} group`}>
        <El id={`board.col.${gi}.head`} label={`${g} group header`} className="pv-group-head"><b>{g}</b><span className="pv-count">{4 - gi}</span></El>
        {range(4 - gi).map((i) => (
          <div key={i} className="pv-tr"><span className="pv-check" /><span className="pv-grow pv-clip">{item(p, gi * 4 + i)}</span><Tag n={gi + i}>{STAGES[(gi + i) % 4]}</Tag><span className="pv-mono pv-muted">{DATES[i]}</span><Av n={i} /></div>
        ))}
      </El>))}
    </div>
  );
  const counts = [3, 2, 3, 1];
  return (
    <div className="pv-board">{STAGES.map((s, ci) => (
      <El key={s} id={`board.col.${ci}`} label={`${s} column`} className="pv-col">
        <El id={`board.col.${ci}.head`} label={`${s} column header`} className="pv-col-head"><b>{s}</b><span className="pv-count">{counts[ci]}</span></El>
        {range(counts[ci]).map((i) => <Card key={i} p={p} n={ci * 3 + i} />)}
        <El id={`board.col.${ci}.add`} label="Add card" className="pv-add">+ Add card</El>
      </El>))}
    </div>
  );
}

function Rows({ p, n, sel }: { p: Project; n: number; sel?: number }) {
  return (
    <El id="table.grid" label="Table" className="pv-panel pv-scroll">
      <div className="pv-tr pv-th"><span className="pv-check" /><span className="pv-grow">Name</span><span className="pv-c2 pv-hide-phone">Owner</span><span className="pv-c2">Status</span><span className="pv-c3 pv-hide-phone">Updated</span></div>
      {range(n).map((i) => (
        <El key={i} id={`table.row.${i}`} label="Row" className={cx("pv-tr pv-tall", i === sel && "sel")}>
          <span className="pv-check" /><span className="pv-grow pv-clip pv-strong">{item(p, i)}</span>
          <span className="pv-c2 pv-hide-phone pv-row"><Av n={i} />{PEOPLE[i % PEOPLE.length]}</span>
          <span className="pv-c2"><Tag n={i}>{STAGES[i % 4]}</Tag></span><span className="pv-c3 pv-mono pv-muted pv-hide-phone">{DATES[i % DATES.length]}</span>
        </El>))}
    </El>
  );
}
function Table({ p, v }: { p: Project; v: number }) {
  if (v === 2) return (
    <div className="pv-gallery">{range(8).map((i) => (
      <El key={i} id={`table.row.${i}`} label="Gallery card" className="pv-panel">
        <div className={`pv-cover t${i % 5}`} /><div className="pv-pad pv-stack"><b className="pv-clip">{item(p, i)}</b><div className="pv-row"><Tag n={i}>{STAGES[i % 4]}</Tag><span className="pv-mono pv-muted pv-push">{DATES[i % 6]}</span></div></div>
      </El>))}
    </div>
  );
  if (v === 1) return (
    <div className="pv-split"><div className="pv-grow"><Rows p={p} n={8} sel={2} /></div>
      <El id="table.panel" label="Record panel" className="pv-panel pv-side pv-hide-phone pv-pad pv-stack">
        <div className="pv-h2">{item(p, 2)}</div>
        <div className="pv-fields">{[["Status", <Tag n={2}>In review</Tag>], ["Owner", <span className="pv-row"><Av n={2} />{PEOPLE[2]}</span>], ["Labels", <Tag n={3}>Design</Tag>], ["Due", <span className="pv-mono">{DATES[3]}</span>]].map(([k, val], i) => <div key={i} className="pv-field"><span className="pv-muted">{k}</span>{val}</div>)}</div>
        <Lines n={4} />
      </El>
    </div>
  );
  return <Rows p={p} n={10} />;
}

const ACTS = ["moved this to In review", "left a comment", "changed the due date", "attached a file"];
function Activity({ p, n }: { p: Project; n: number }) {
  return (
    <El id="detail.activity" label="Activity" className="pv-stack">
      <div className="pv-h3">Activity</div>
      {range(n).map((i) => <div key={i} className="pv-row pv-top"><Av n={i + 1} /><div className="pv-grow"><b>{PEOPLE[(i + 1) % PEOPLE.length]}</b> <span className="pv-muted">{ACTS[i % ACTS.length]}</span><div className="pv-mono pv-muted">{DATES[i]}</div>{i % 2 === 1 && <Lines n={2} />}</div></div>)}
    </El>
  );
}
function Detail({ p, v }: { p: Project; v: number }) {
  const title = <El id="detail.title" label="Title" className="pv-h1">{item(p, 0)}</El>;
  const fields = (
    <El id="detail.fields" label="Details panel" className="pv-fields">
      {[["Assignee", <span className="pv-row"><Av n={0} />{PEOPLE[0]}</span>], ["Due date", <span className="pv-mono">{DATES[2]}</span>], ["Status", <Tag n={1}>In review</Tag>], ["Labels", <span className="pv-row"><Tag n={2}>Design</Tag><Tag n={3}>Q4</Tag></span>]].map(([k, val], i) => <div key={i} className="pv-field"><span className="pv-muted">{k}</span>{val}</div>)}
    </El>
  );
  const body = <El id="detail.body" label="Description" className="pv-stack"><Lines n={5} /><div className="pv-row"><span className="pv-btn">Draft the change</span><span className="pv-btn">Review with the team</span></div></El>;
  if (v === 1) return (
    <div className="pv-panel pv-pad pv-narrow pv-stack">{title}
      <El id="detail.tabs" label="Tabs" className="pv-tabsrow"><span className="on">Overview</span><span>Activity</span><span>Files</span></El>
      <div className="pv-fields inline">{fields}</div>{body}
    </div>
  );
  if (v === 2) return (
    <div className="pv-split"><div className="pv-panel pv-pad pv-grow pv-stack">{title}{fields}{body}</div><div className="pv-panel pv-side pv-pad pv-hide-phone"><Activity p={p} n={4} /></div></div>
  );
  return (
    <div className="pv-split"><div className="pv-panel pv-pad pv-grow pv-stack">{title}{body}<Activity p={p} n={2} /></div><div className="pv-panel pv-side pv-pad pv-stack pv-hide-phone"><div className="pv-h3">Details</div>{fields}</div></div>
  );
}

function Row({ p, i, wide }: { p: Project; i: number; wide?: boolean }) {
  return (
    <El id={`inbox.row.${i}`} label="List row" className={cx("pv-tr pv-tall", i === 0 && "sel")}>
      <Av n={i} /><div className="pv-grow pv-clip"><div className="pv-row"><b className={cx(i > 2 && "pv-muted")}>{PEOPLE[i % PEOPLE.length]}</b><span className="pv-mono pv-muted pv-push">{DATES[i % 6]}</span></div><div className="pv-clip">{item(p, i)}</div></div>
      {wide && <Tag n={i}>{STAGES[i % 4]}</Tag>}
    </El>
  );
}
function InboxScreen({ p, v }: { p: Project; v: number }) {
  if (v === 1) return <El id="inbox.list" label="List" className="pv-panel pv-list">{range(8).map((i) => <Row key={i} p={p} i={i} wide />)}</El>;
  if (v === 2) return (
    <El id="inbox.list" label="List" className="pv-panel pv-scroll">{["Today", "Yesterday", "Earlier this week"].map((g, gi) => (
      <div key={g}><div className="pv-group-head"><b>{g}</b></div>{range(3).map((i) => <Row key={i} p={p} i={gi * 3 + i} />)}</div>))}
    </El>
  );
  return (
    <div className="pv-split">
      <El id="inbox.list" label="List" className="pv-panel pv-list">{range(7).map((i) => <Row key={i} p={p} i={i} />)}</El>
      <El id="inbox.reader" label="Reading pane" className="pv-panel pv-pad pv-grow pv-stack pv-hide-phone"><div className="pv-h1">{item(p, 0)}</div><div className="pv-row"><Av n={0} /><b>{PEOPLE[0]}</b><span className="pv-mono pv-muted pv-push">{DATES[0]}</span></div><Lines n={5} /><Lines n={3} /></El>
    </div>
  );
}

function ListPanel({ p, id, label, title, from }: { p: Project; id: string; label: string; title: string; from: number }) {
  return (
    <El id={id} label={label} className="pv-panel pv-pad pv-stack pv-grow">
      <div className="pv-h3">{title}</div>
      {range(5).map((i) => <div key={i} className="pv-row"><span className={`pv-dot t${(i + from) % 5}`} /><span className="pv-grow pv-clip">{item(p, i + from)}</span><span className="pv-mono pv-muted">{DATES[(i + from) % 6]}</span></div>)}
    </El>
  );
}
function Dashboard({ p, v }: { p: Project; v: number }) {
  const lists = <div className="pv-split"><ListPanel p={p} id="dash.attention" label="Needs attention" title="Needs attention" from={0} /><ListPanel p={p} id="dash.activity" label="Recent activity" title="Recent activity" from={3} /></div>;
  const chart = (
    <El id="dash.chart" label="Chart" className="pv-panel pv-pad">
      <div className="pv-row"><b>Activity, last 12 weeks</b><span className="pv-mono pv-muted pv-push">+18% on the quarter</span></div>
      <div className="pv-bars">{[30, 42, 38, 50, 46, 58, 52, 64, 60, 72, 68, 80].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
    </El>
  );
  const tiles = (
    <El id="dash.recent" label="Recent items" className="pv-tiles">
      {range(4).map((i) => <div key={i} className="pv-panel pv-pad pv-stack"><div className={`pv-cover t${i}`} /><b className="pv-clip">{item(p, i)}</b><span className="pv-muted pv-row"><Av n={i} />{STAGES[i]}</span></div>)}
    </El>
  );
  if (v === 1) return <div className="pv-stack">{lists}<ListPanel p={p} id="dash.recent" label="Recent items" title="Assigned to you" from={5} /></div>;
  if (v === 2) return <div className="pv-stack">{chart}{lists}</div>;
  return <div className="pv-stack">{tiles}{lists}</div>;
}

function Form({ cols }: { cols?: boolean }) {
  return (
    <div className={cx("pv-form", cols && "cols")}>
      <label>Name<span className="pv-input">Tazko group</span></label>
      <label>Contact email<span className="pv-input pv-mono">ops@company.com</span></label>
      <label>Time zone<span className="pv-input pv-select">Asia/Ho_Chi_Minh</span></label>
      <label>Language<span className="pv-input pv-select">English</span></label>
      <label className="wide">Description<span className="pv-input pv-tallinput" /></label>
      <label className="wide pv-row"><span className="pv-switch on" /> Email a weekly digest</label>
    </div>
  );
}
function SettingsScreen({ v }: { v: number }) {
  const sections = ["General", "Members", "Integrations", "Danger zone"];
  const danger = <El id="settings.danger" label="Danger zone" className="pv-danger"><div className="pv-grow"><b>Archive this project</b><div className="pv-muted">Archived projects are read-only.</div></div><span className="pv-btn bad">Archive</span></El>;
  const form = <El id="settings.form" label="Form" className="pv-panel pv-pad pv-stack pv-grow"><div className="pv-h2">General</div><Form cols={v === 2} />{danger}</El>;
  if (v === 1) return <div className="pv-narrow pv-stack">{form}</div>;
  if (v === 2) return <div className="pv-stack"><El id="settings.sections" label="Section tabs" className="pv-tabsrow">{sections.map((s, i) => <span key={s} className={cx(i === 0 && "on")}>{s}</span>)}</El>{form}</div>;
  return <div className="pv-split"><El id="settings.sections" label="Section list" className="pv-sections pv-hide-phone">{sections.map((s, i) => <span key={s} className={cx("pv-navitem", i === 0 && "on")}>{s}</span>)}</El>{form}</div>;
}

function Auth({ p, v }: { p: Project; v: number }) {
  const form = (
    <div className="pv-authform pv-stack">
      <div className="pv-brand"><span className="pv-logo" />{p.name}</div>
      <El id="auth.title" label="Heading" className="pv-h1">Sign in to {p.name}</El>
      <div className="pv-muted">Use your company account. New here? Ask an admin for an invite.</div>
      <El id="auth.submit" label="Sign-in button" className="pv-btn pri pv-block">Continue with Google</El>
      <div className="pv-or">or</div>
      <El id="auth.email" label="Email field" className="pv-input">you@company.com</El>
      <span className="pv-btn pv-block">Email me a link</span>
    </div>
  );
  if (v === 1) return (
    <div className="pv-auth split">
      <El id="auth.brand" label="Brand panel" className="pv-authbrand pv-hide-phone"><div className="pv-authbig">Everything your team is working on, in one place.</div><div>Self-hosted. Your data stays on your servers.</div></El>
      <div className="pv-authside">{form}</div>
    </div>
  );
  if (v === 2) return <div className="pv-auth plain">{form}</div>;
  return <div className="pv-auth"><div className="pv-panel pv-pad pv-authcard">{form}</div></div>;
}

export const PREVIEW_SIZE = { desktop: { w: 1080, h: 675 }, tablet: { w: 768, h: 1024 }, phone: { w: 390, h: 780 } } as const;

const BODY = { board: Board, table: Table, detail: Detail, inbox: InboxScreen, dashboard: Dashboard, settings: ({ v }: { p: Project; v: number }) => <SettingsScreen v={v} />, auth: Auth };

export function Preview(props: {
  project: Project; screen: Screen; ds?: DesignSystem; mode: "light" | "dark"; device: "desktop" | "tablet" | "phone";
  nav?: Project["nav"]; variant?: number; className?: string; style?: CSSProperties; picking?: boolean;
}) {
  const { project: p, screen: s, mode, device } = props;
  const ds = props.ds ?? HOUSE_SYSTEM;
  const nav = props.nav ?? p.nav, v = props.variant ?? s.variant;
  const Body = BODY[s.kind];
  const phone = device === "phone";
  const label = `${s.name} screen of ${p.name}, ${mode} theme, ${device}`;
  // Draw at the device's natural size, then scale to the width of the wrapper.
  const { w, h } = PREVIEW_SIZE[device];
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / w);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  const content = s.kind === "auth" ? <Body p={p} v={v} /> : (
    <div className={cx("pv-app", phone && "phone")}>
      {!phone && nav !== "top" && (
        <El id="nav" label="Navigation" className={nav === "rail" ? "pv-rail" : "pv-sidebar"}>
          <div className="pv-brand"><span className="pv-logo" /><span className="pv-navlabel">{p.name}</span></div>
          {p.navItems.map((n, i) => { const I = ICONS[i % ICONS.length]; return <El key={n} id={`nav.item.${i}`} label={`${n} in navigation`} className={cx("pv-navitem", i === 1 && "on")}><I className="pv-ico" /><span className="pv-navlabel">{n}</span></El>; })}
          <div className="pv-me pv-row"><Av n={0} /><span className="pv-navlabel">An Nguyen</span></div>
        </El>
      )}
      {!phone && nav === "top" && (
        <El id="nav" label="Navigation" className="pv-topbar">
          <div className="pv-brand"><span className="pv-logo" />{p.name}</div>
          {p.navItems.map((n, i) => <El key={n} id={`nav.item.${i}`} label={`${n} in navigation`} className={cx("pv-navitem", i === 1 && "on")}>{n}</El>)}
          <span className="pv-push" /><Av n={0} />
        </El>
      )}
      {phone && <El id="appbar" label="App bar" className="pv-appbar"><div className="pv-title">{s.name}</div><Bell className="pv-ico" /></El>}
      <div className="pv-main">
        {!phone && (
          <El id="head" label="Screen header" className="pv-head">
            <div className="pv-title">{s.name}</div>
            <span className="pv-search pv-hide-phone"><Search className="pv-ico" />Search</span>
            <span className="pv-push" />
            <El id="secondary" label="Secondary action" className="pv-btn"><Filter className="pv-ico" />Filter</El>
            <El id="primary" label="Primary action" className="pv-btn pri"><Plus className="pv-ico" />New</El>
          </El>
        )}
        <div className="pv-body"><Body p={p} v={v} /></div>
      </div>
      {phone && <El id="nav" label="Navigation" className="pv-tabbar">{p.navItems.slice(0, 4).map((n, i) => { const I = ICONS[i % ICONS.length]; return <span key={n} className={cx("pv-navitem", i === 1 && "on")}><I className="pv-ico" />{n}</span>; })}</El>}
    </div>
  );
  return (
    <div ref={wrap} className={cx("pv-wrap", props.picking && "picking", props.className)} style={{ aspectRatio: `${w} / ${h}`, ...props.style }}>
      <div className="pv" data-nav={nav} data-device={device} data-el="screen" data-label="Whole screen" role="img" aria-label={label}
        style={{ width: w, height: h, transform: `scale(${scale})`, ...cssVars(ds, mode) } as CSSProperties}>
        {content}
      </div>
    </div>
  );
}
