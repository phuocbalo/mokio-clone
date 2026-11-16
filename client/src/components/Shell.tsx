import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LayoutGrid, Palette as PaletteIcon, Component, Package, Settings, LogOut, PanelLeftClose, PanelLeftOpen, Pin, ChevronDown, Route,
  Database, Monitor, Tablet, Smartphone, SlidersHorizontal, Command, Sun, Moon, SunMoon, Minus, Plus, Maximize, Link2,
  Keyboard, RefreshCw, Sparkles, X, Eye,
} from "lucide-react";
import {
  ACCENTS, SCENARIOS, ZOOMS, account, cx, dropToast, go, openKeys, openPalette, pinsOf, prefs, resetData, setPrefs, toast,
  useAccount, useAi, useData, useMe, usePrefs, useRoute, useUi, HOUSE_SYSTEM,
} from "../lib/store";
import { logout } from "../lib/api";
import { ROLE_LABEL, type Role } from "../lib/catalog";
import { tokens } from "../lib/theme";
import { Avatar, Dialog, Glyph, Kbd, Link, Menu, MenuItem, Seg, SysDot, fireKey, useKeys, useMode } from "./ui";

// Every page in Mokio, for "Jump to a screen". Planned ones show what is coming.
export const APP_SCREENS: { id: string; title: string; group: string; path: string; planned?: string[] }[] = [
  { id: "signin", title: "Sign in", group: "Anywhere", path: "/signin" },
  { id: "projects", title: "Prototypes", group: "Anywhere", path: "/projects" },
  { id: "new", title: "Start from a brief", group: "Anywhere", path: "/projects/new" },
  { id: "map", title: "Screen map", group: "Inside a prototype", path: "/p/:p" },
  { id: "review", title: "Review", group: "Inside a prototype", path: "/p/:p/review" },
  { id: "options", title: "Options board", group: "Inside a prototype", path: "/p/:p/options" },
  { id: "spec", title: "Spec", group: "Inside a prototype", path: "/p/:p/spec" },
  { id: "briefs", title: "Briefs", group: "Inside a prototype", path: "/p/:p/briefs" },
  { id: "history", title: "History: commits", group: "Inside a prototype", path: "/p/:p/history" },
  { id: "changes", title: "Uncommitted changes", group: "Inside a prototype", path: "/p/:p/history/changes" },
  { id: "branches", title: "Branches", group: "Inside a prototype", path: "/p/:p/history/branches" },
  { id: "prs", title: "Pull requests", group: "Inside a prototype", path: "/p/:p/history/prs" },
  { id: "plan", title: "Build plan", group: "Inside a prototype", path: "/p/:p/plan", planned: [
    "A plan generated from the manifest: one milestone per flow, each with the screens it covers.",
    "\"Done when\" tests per milestone that an agent can run.",
    "A running list of differences between the prototype and the spec, each waiting for a decision.",
    "Export as prompts for the build session.",
  ] },
  { id: "audit", title: "Audit", group: "Inside a prototype", path: "/p/:p/audit", planned: [
    "List the controls that only pretend, screen by screen, so they cannot leak into the build.",
    "Find gaps: flows that dead-end, roles with no screen, empty and error states that were never drawn.",
    "Check that names, counts and dates from the seed table agree across screens.",
  ] },
  { id: "ds", title: "Design systems", group: "Library", path: "/library/design-systems" },
  { id: "ds-new", title: "Capture a design system", group: "Library", path: "/library/design-systems/new" },
  { id: "toolkits", title: "UI toolkits", group: "Library", path: "/library/toolkits", planned: [
    "Capture a set of widgets and its guidelines from a reference: an online kit, a website or source code.",
    "Keep several approaches to the same widget, for example five date pickers, and compare them side by side.",
    "Design a new widget together with Claude, then restyle it in any design system from the library.",
  ] },
  { id: "frameworks", title: "UI frameworks", group: "Library", path: "/library/frameworks", planned: [
    "Pre-customised starting points for web, desktop and mobile.",
    "Each one packs a design system and a toolkit into a project an agent can build on.",
    "Version them, so a prototype records which framework it was built with.",
  ] },
  { id: "settings", title: "Settings and AI connection", group: "Anywhere", path: "/settings" },
];

export const KEY_FLOWS: { id: string; title: string; about: string; path: string; as?: Role; scenario?: string }[] = [
  { id: "f1", title: "Start a prototype from a brief", about: "Fill the brief, pick a design system, watch Claude draft the screens", path: "/projects/new", as: "designer" },
  { id: "f2", title: "Review screens and send one round", about: "Pin comments to elements, then send them to Claude together", path: "/p/tazko/review/board", as: "designer", scenario: "mid" },
  { id: "f3", title: "Check Claude's replies", about: "Round 3 is back; accept each reply or reopen it", path: "/p/tazko/review/board/sent", as: "reviewer", scenario: "after-review" },
  { id: "f4", title: "Compare options and apply one", about: "Three takes on the board, side by side", path: "/p/tazko/options/r2", as: "owner", scenario: "mid" },
  { id: "f5", title: "Redesign with one big brief", about: "Write a long request; Claude plans it against the spec before changing anything", path: "/p/tazko/briefs/new", as: "designer", scenario: "mid" },
  { id: "f6", title: "Change the spec by asking Claude", about: "Say it in words; Claude asks when a rule clashes, then proposes the edits", path: "/p/tazko/spec", as: "owner", scenario: "mid" },
  { id: "f7", title: "Answer Claude's question in a review", about: "Round 3 asks what the card activity should log; the answer goes into the spec", path: "/p/tazko/review/card-detail/sent", as: "designer", scenario: "after-review" },
  { id: "f8", title: "Review and merge a pull request", about: "Ask Claude to review #14, then fix, approve and merge", path: "/p/tazko/history/pr/14", as: "owner", scenario: "mid" },
  { id: "f9", title: "Commit, pull and push", about: "Two uncommitted changes, one commit to push, two to pull", path: "/p/tazko/history/changes", as: "designer", scenario: "mid" },
  { id: "f10", title: "See a screen at full size", about: "The board fills the window, with Mokio out of the way", path: "/p/tazko/run/board", scenario: "mid" },
  { id: "f11", title: "Retheme a design system", about: "Move the generator, ask Claude, check contrast in both themes", path: "/library/design-systems/tazko-indigo", as: "owner" },
  { id: "f12", title: "Read the review as a developer", about: "Khoa can comment but cannot send or approve", path: "/p/tazko/review/card-detail", as: "developer", scenario: "mid" },
  { id: "f13", title: "First run, with nothing yet", about: "Empty states for prototypes and the library", path: "/projects", scenario: "first-run" },
];

export function runFlow(f: (typeof KEY_FLOWS)[number]) {
  const me = useAccountSnapshot();
  const patch: Partial<ReturnType<typeof prefs.get>> = {};
  if (f.scenario) patch.scenario = f.scenario;
  if (f.as && me?.role === "owner") patch.viewAs = f.as === "owner" ? null : f.as;
  setPrefs(patch);
  go(f.path);
  if (f.as && me?.role !== "owner" && f.as !== me?.role) toast(`This flow is written for a ${ROLE_LABEL[f.as].toLowerCase()}. Your role may hide some controls.`);
}
const useAccountSnapshot = () => account.get().user;

const currentProject = () => { const parts = location.hash.replace(/^#/, "").split("?")[0].split("/").filter(Boolean); return parts[0] === "p" && parts[1] ? parts[1] : "tazko"; };
const screenPath = (s: (typeof APP_SCREENS)[number]) => s.path.replace(":p", currentProject());

export function copyStateLink(path: string) {
  const p = prefs.get(), q = new URLSearchParams({ theme: p.theme, device: p.device, density: p.density, zoom: String(p.zoom), scenario: p.scenario });
  const url = `${location.href.split("#")[0]}#${path}?${q}`;
  navigator.clipboard?.writeText(url).then(() => toast("Link to this exact state copied: screen, scenario, theme and device."), () => toast(url));
}
function zoom(step: number) {
  const i = ZOOMS.indexOf(prefs.get().zoom);
  setPrefs({ zoom: ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + step))] });
}
const DEVICES = [
  { value: "desktop" as const, label: "Desktop", icon: <Monitor /> },
  { value: "tablet" as const, label: "Tablet", icon: <Tablet /> },
  { value: "phone" as const, label: "Phone", icon: <Smartphone /> },
];

/** The prototype shell bar. Everything in it is for trying Mokio out; it does not ship. */
export function Bar() {
  const p = usePrefs(), r = useRoute(), { user } = useAccount(), me = useMe();
  const scenario = SCENARIOS.find((s) => s.id === p.scenario) ?? SCENARIOS[0];
  const groups = [...new Set(APP_SCREENS.map((s) => s.group))];
  return (
    <header className="bar">
      <span className="bar-tag" title="Everything in this bar belongs to the prototype shell. It does not ship."><Glyph size={16} />Prototype</span>
      <Menu className="bar-btn bar-wide" label="Jump to a screen" button={<><LayoutGrid /><span>Prototypes</span><ChevronDown className="chev" /></>}>
        {(close) => groups.map((g) => (
          <div key={g}>
            <div className="menu-label">{g}</div>
            {APP_SCREENS.filter((s) => s.group === g).map((s) => (
              <MenuItem key={s.id} on={r.path === screenPath(s)} hint={s.planned ? "Planned" : undefined} onClick={() => { close(); go(screenPath(s)); }}>{s.title}</MenuItem>
            ))}
          </div>
        ))}
      </Menu>
      <Menu className="bar-btn bar-wide" label="Jump to a key flow" wide button={<><Route /><span>Flows</span><ChevronDown className="chev" /></>}>
        {(close) => KEY_FLOWS.map((f) => (
          <MenuItem key={f.id} hint={f.as ? ROLE_LABEL[f.as] : undefined} onClick={() => { close(); runFlow(f); }}>
            <b>{f.title}</b><small className="muted"> {f.about}</small>
          </MenuItem>
        ))}
      </Menu>
      <span className="bar-space" />
      <Menu className="bar-btn" label="View as another role" align="end" button={user ? <><Avatar p={me} size="sm" /><span className="bar-wide">{user.name.split(" ")[0]}{p.viewAs ? ` as ${ROLE_LABEL[p.viewAs].toLowerCase()}` : ""}</span><ChevronDown className="chev" /></> : <span>Signed out</span>}>
        {(close) => user ? (
          <>
            <div className="menu-label">{user.name} · {ROLE_LABEL[user.role]}</div>
            {user.role === "owner" && <>
              <div className="menu-label">Preview Mokio as</div>
              {(["owner", "designer", "reviewer", "developer"] as Role[]).map((role) => (
                <MenuItem key={role} on={(p.viewAs ?? "owner") === role} icon={<Eye />} onClick={() => { close(); setPrefs({ viewAs: role === "owner" ? null : role }); }}>{ROLE_LABEL[role]}</MenuItem>
              ))}
            </>}
            <div className="menu-sep" />
            <MenuItem icon={<LogOut />} onClick={() => { close(); void logout(); }}>Sign out</MenuItem>
          </>
        ) : <MenuItem onClick={() => { close(); go("/signin"); }}>Sign in</MenuItem>}
      </Menu>
      <Menu className="bar-btn" label="Scenario: which sample data is loaded" wide align="end" button={<><Database /><span className="bar-wide">{scenario.name}</span><ChevronDown className="chev" /></>}>
        {(close) => SCENARIOS.map((s) => (
          <MenuItem key={s.id} on={s.id === p.scenario} onClick={() => { close(); setPrefs({ scenario: s.id }); }}><b>{s.name}</b><small className="muted"> {s.about}</small></MenuItem>
        ))}
      </Menu>
      <Seg className="bar-seg bar-narrow" label="Device" iconOnly value={p.device} onChange={(v) => setPrefs({ device: v })} options={DEVICES} />
      <Menu className="bar-btn icon" label="Display settings" wide align="end" button={<SlidersHorizontal />}>
        {(close) => <DisplayMenu close={close} />}
      </Menu>
      <button type="button" className="bar-btn" onClick={() => openPalette()} title="Command palette"><Command /><Kbd k="Ctrl K" /></button>
    </header>
  );
}

function DisplayMenu({ close }: { close: () => void }) {
  const p = usePrefs(), mode = useMode();
  return (
    <div className="display">
      <div className="display-row"><span>Theme</span>
        <Seg label="Theme" value={p.theme} onChange={(v) => setPrefs({ theme: v })} options={[{ value: "system", label: "System", icon: <SunMoon /> }, { value: "light", label: "Light", icon: <Sun /> }, { value: "dark", label: "Dark", icon: <Moon /> }]} />
      </div>
      <div className="display-row"><span>Accent</span>
        <div className="swatches" role="radiogroup" aria-label="Accent">
          {ACCENTS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={a.id === p.accent} aria-label={a.name} title={a.name} className={cx("swatch", a.id === p.accent && "on")}
              style={{ background: tokens(HOUSE_SYSTEM, mode, a.hue ?? undefined).accent }} onClick={() => setPrefs({ accent: a.id })} />
          ))}
        </div>
      </div>
      <div className="display-row"><span>Zoom</span>
        <div className="stepper">
          <button type="button" className="btn ghost sm icon-only" aria-label="Zoom out" disabled={p.zoom === ZOOMS[0]} onClick={() => zoom(-1)}><Minus /></button>
          <button type="button" className="btn ghost sm" onClick={() => setPrefs({ zoom: 100 })}>{p.zoom}%</button>
          <button type="button" className="btn ghost sm icon-only" aria-label="Zoom in" disabled={p.zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => zoom(1)}><Plus /></button>
        </div>
      </div>
      <div className="display-row"><span>Density</span>
        <Seg label="Density" value={p.density} onChange={(v) => setPrefs({ density: v })} options={[{ value: "cozy", label: "Cozy" }, { value: "compact", label: "Compact" }]} />
      </div>
      <div className="display-row"><span>Device</span><Seg label="Device" iconOnly value={p.device} onChange={(v) => setPrefs({ device: v })} options={DEVICES} /></div>
      <label className="check"><input type="checkbox" checked={p.hints} onChange={(e) => setPrefs({ hints: e.target.checked })} /> Keyboard hints on buttons</label>
      <label className="check"><input type="checkbox" checked={p.showMock} onChange={(e) => setPrefs({ showMock: e.target.checked })} /> Mark controls that only pretend</label>
      <div className="menu-sep" />
      <MenuItem icon={<Maximize />} hint={<Kbd k="Z" />} onClick={() => { close(); setPrefs({ zen: true }); }}>Zen mode</MenuItem>
      <MenuItem icon={<Link2 />} onClick={() => { close(); copyStateLink(location.hash.replace(/^#/, "").split("?")[0] || "/"); }}>Copy link to this state</MenuItem>
      <MenuItem icon={<Keyboard />} hint={<Kbd k="?" />} onClick={() => { close(); openKeys(); }}>Keyboard shortcuts</MenuItem>
      <MenuItem icon={<RefreshCw />} onClick={() => { close(); resetData(); }}>Reset sample data</MenuItem>
    </div>
  );
}

function NavLink(p: { to: string; on: boolean; icon: ReactNode; label: string; sub?: string; planned?: boolean; kbd?: string }) {
  return (
    <Link to={p.to} className={cx("nav-link", p.on && "on")} aria-current={p.on ? "page" : undefined} title={p.sub ? `${p.label}, ${p.sub}` : p.label}>
      {p.icon}<span className="nav-text">{p.label}{p.sub && <small> {p.sub}</small>}</span>
      {p.planned && <span className="nav-planned">Planned</span>}
      {p.kbd && <Kbd k={p.kbd} />}
    </Link>
  );
}

/** Mokio's own navigation. */
export function Side({ children }: { children: ReactNode }) {
  const r = useRoute(), me = useMe(), d = useData(), p = usePrefs(), s = useAi(), { user } = useAccount();
  const folded = p.sideCollapsed, toggle = () => setPrefs({ sideCollapsed: !folded });
  useKeys({ b: toggle });
  const on = (x: string) => r.path.startsWith(x);
  const pinned = d.projects.flatMap((proj) => pinsOf(p, proj.id).map((id) => ({ proj, sc: proj.screens.find((x) => x.id === id) }))).filter((x) => x.sc);
  return (
    <div className="app" data-side={folded ? "rail" : undefined}>
      <aside className="side">
        <div className="side-top">
          <Link to="/projects" className="brand" title="Mokio"><Glyph size={22} /><span>Mokio</span></Link>
          <button type="button" className="btn ghost sm icon-only side-fold" aria-expanded={!folded} aria-label={folded ? "Expand navigation" : "Collapse navigation"} title={`${folded ? "Expand" : "Collapse"} navigation (B)`} onClick={toggle}>
            {folded ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>
        <nav className="side-nav" aria-label="Main">
          <NavLink to="/projects" on={on("/projects")} icon={<LayoutGrid />} kbd="G P" label="Prototypes" />
          <div className="side-label">Library</div>
          <NavLink to="/library/design-systems" on={on("/library/design-systems")} icon={<PaletteIcon />} kbd="G L" label="Design systems" />
          <NavLink to="/library/toolkits" on={on("/library/toolkits")} icon={<Component />} planned label="UI toolkits" />
          <NavLink to="/library/frameworks" on={on("/library/frameworks")} icon={<Package />} planned label="UI frameworks" />
          {pinned.length > 0 && <div className="side-label side-recent">Pinned screens</div>}
          {pinned.map(({ proj, sc }) => (
            <NavLink key={proj.id + sc!.id} to={`/p/${proj.id}/review/${sc!.id}`} on={r.parts[1] === proj.id && r.parts[3] === sc!.id} icon={<Pin />} label={sc!.name} sub={proj.name} />
          ))}
          {d.projects.length > 0 && <div className="side-label side-recent">Recent</div>}
          {d.projects.slice(0, 5).map((proj) => (
            <NavLink key={proj.id} to={`/p/${proj.id}`} on={r.parts[0] === "p" && r.parts[1] === proj.id && !pinned.some((x) => x.proj.id === proj.id && x.sc!.id === r.parts[3])} icon={<SysDot ds={d.systems.find((x) => x.id === proj.dsId)} />} label={proj.name} />
          ))}
        </nav>
        <nav className="side-nav side-end" aria-label="Settings">
          <NavLink to="/settings" on={on("/settings")} icon={<Settings />} label="Settings" sub={s.on ? undefined : "AI off"} />
        </nav>
        <div className="side-foot">
          <Avatar p={me} />
          <div className="side-who"><b>{user?.name}</b><small>{ROLE_LABEL[me.role]}{p.viewAs ? " (preview)" : ""}</small></div>
          <button type="button" className="btn ghost icon-only" aria-label="Sign out" title="Sign out" onClick={() => void logout()}><LogOut /></button>
        </div>
      </aside>
      <main className="main">
        {s.checked && !s.on && (
          <div className="ai-off-bar" role="status"><Sparkles /><span>{s.why.replace(/ (Settings shows how to fix it|Add one in Settings)\.$/, "")} Everything else works.</span><Link to="/settings" className="link">Open Settings</Link></div>
        )}
        {children}
      </main>
    </div>
  );
}

// ---- Command palette -----------------------------------------------------------------
interface Cmd { kind: string; text: string; run: () => void }
function useCommands(): Cmd[] {
  const d = useData(), { user } = useAccount();
  return useMemo(() => {
    const set = (x: Partial<ReturnType<typeof prefs.get>>) => setPrefs(x);
    const pid = currentProject();
    return [
      ...APP_SCREENS.map((s) => ({ kind: "Screen", text: `${s.title}${s.planned ? " (planned)" : ""}`, run: () => go(screenPath(s)) })),
      ...KEY_FLOWS.map((f) => ({ kind: "Flow", text: f.title, run: () => runFlow(f) })),
      ...d.projects.map((p) => ({ kind: "Prototype", text: `${p.name} ${p.tagline}`, run: () => go(`/p/${p.id}`) })),
      ...d.projects.find((p) => p.id === pid)?.screens.map((s) => ({ kind: "Review", text: s.name, run: () => go(`/p/${pid}/review/${s.id}`) })) ?? [],
      ...d.systems.map((s) => ({ kind: "Design system", text: s.name, run: () => go(`/library/design-systems/${s.id}`) })),
      ...(user?.role === "owner" ? (["owner", "designer", "reviewer", "developer"] as Role[]).map((r) => ({ kind: "View as", text: ROLE_LABEL[r], run: () => set({ viewAs: r === "owner" ? null : r }) })) : []),
      ...SCENARIOS.map((s) => ({ kind: "Scenario", text: s.name, run: () => set({ scenario: s.id }) })),
      ...(["system", "light", "dark"] as const).map((t) => ({ kind: "Theme", text: `Theme: ${t}`, run: () => set({ theme: t }) })),
      ...ACCENTS.map((a) => ({ kind: "Accent", text: a.name, run: () => set({ accent: a.id }) })),
      ...DEVICES.map((x) => ({ kind: "Device", text: x.label, run: () => set({ device: x.value }) })),
      { kind: "Display", text: "Density: compact", run: () => set({ density: prefs.get().density === "compact" ? "cozy" : "compact" }) },
      { kind: "Display", text: "Zoom in", run: () => zoom(1) },
      { kind: "Display", text: "Zoom out", run: () => zoom(-1) },
      { kind: "Display", text: "Zoom: reset to 100%", run: () => set({ zoom: 100 }) },
      { kind: "Display", text: "Collapse or expand Mokio navigation", run: () => set({ sideCollapsed: !prefs.get().sideCollapsed }) },
      { kind: "Display", text: "Focus on pinned screens", run: () => set({ focus: !prefs.get().focus }) },
      { kind: "Display", text: "Zen mode", run: () => set({ zen: !prefs.get().zen }) },
      { kind: "Display", text: "Mark controls that only pretend", run: () => set({ showMock: !prefs.get().showMock }) },
      { kind: "Action", text: "Copy link to this state", run: () => copyStateLink(location.hash.replace(/^#/, "").split("?")[0] || "/") },
      { kind: "Action", text: "Keyboard shortcuts", run: () => openKeys() },
      { kind: "Action", text: "Reset sample data", run: resetData },
      { kind: "Action", text: "Sign out", run: () => void logout() },
    ];
  }, [d.projects, d.systems, user]);
}

function Palette() {
  const { palette } = useUi(), cmds = useCommands();
  const [q, setQ] = useState(""), [i, setI] = useState(0);
  useEffect(() => { if (palette) { setQ(""); setI(0); } }, [palette]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = cmds.filter((c) => words.every((w) => `${c.kind} ${c.text}`.toLowerCase().includes(w))).slice(0, 40);
  const run = (c?: Cmd) => { if (!c) return; openPalette(false); c.run(); };
  return (
    <Dialog open={palette} onClose={() => openPalette(false)} label="Command palette" className="palette">
      <div className="palette-in">
        <Command />
        <input autoFocus value={q} placeholder="Go to a screen, start a flow, view as someone" aria-label="Command"
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); run(list[i]); }
          }} />
      </div>
      <ul className="palette-list" role="listbox" aria-label="Commands">
        {list.map((c, n) => (
          <li key={`${c.kind}${c.text}${n}`} role="option" aria-selected={n === i} className={cx(n === i && "on")} onMouseEnter={() => setI(n)} onClick={() => run(c)}>
            <span className="palette-kind">{c.kind}</span><span className="palette-text">{c.text}</span>
          </li>
        ))}
        {!list.length && <li className="palette-none">Nothing matches "{q}". Try a screen name, a role, "theme" or "device".</li>}
      </ul>
    </Dialog>
  );
}

const KEYS: [string, [string, string][]][] = [
  ["Anywhere", [["Ctrl K", "Command palette"], ["?", "This list"], ["G P", "Go to prototypes"], ["G L", "Go to the design system library"], ["G S", "Go to the screen map"], ["G R", "Go to review"], ["G O", "Go to the options board"], ["G E", "Go to the spec"], ["G B", "Go to briefs"], ["G H", "Go to history"], ["B", "Collapse or expand Mokio's navigation"]]],
  ["Prototype shell", [["Z", "Zen mode on or off"], ["T", "Theme: system, light, dark"], ["D", "Density: cozy or compact"], ["M", "Mark the controls that only pretend"], ["1 – 4", "Sign-in screen: pick an account"]]],
  ["Prototypes", [["N", "New prototype"], ["/", "Search"]]],
  ["Review", [["C", "Comment mode on or off"], ["[ ]", "Previous or next screen"], ["A", "Approve the screen"], ["P", "Pin or unpin the screen"], ["F", "Open the screen at full window size"], ["Ctrl Enter", "Send the round to Claude"]]],
  ["Full-window view", [["[ ]", "Previous or next screen"], ["L", "Light or dark"], ["H", "Hide or show the bar"], ["F", "Take over the whole display"], ["Esc", "Back to review"]]],
  ["Options board", [["1 – 9", "Pick an option"], ["L", "Preview in light or dark"]]],
  ["Briefs and history", [["Ctrl Enter", "Plan, run the plan, or commit"]]],
];
function KeysDialog() {
  const { keys } = useUi();
  return (
    <Dialog open={keys} onClose={() => openKeys(false)} label="Keyboard shortcuts">
      <div className="dialog-head"><h2>Keyboard shortcuts</h2><button type="button" className="btn ghost icon-only" aria-label="Close" onClick={() => openKeys(false)}><X /></button></div>
      <div className="keys-grid">
        {KEYS.map(([g, rows]) => (
          <section key={g}><h3>{g}</h3><dl>{rows.map(([k, t]) => <div key={k + t}><dt><span className="kbds">{k.split(" ").map((x, i) => <kbd key={i}>{x}</kbd>)}</span></dt><dd>{t}</dd></div>)}</dl></section>
        ))}
      </div>
      <p className="keys-note">Single-letter shortcuts are off while you type in a field.</p>
    </Dialog>
  );
}

function Toasts() {
  const { toasts } = useUi();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.undo && <button type="button" className="link" onClick={() => { t.undo!(); dropToast(t.id); }}>Undo</button>}
          {t.go && <button type="button" className="link" onClick={() => { go(t.go!.path); dropToast(t.id); }}>{t.go.label}</button>}
          <button type="button" className="toast-x btn ghost sm icon-only" aria-label="Dismiss" onClick={() => dropToast(t.id)}><X /></button>
        </div>
      ))}
    </div>
  );
}

/** Global keys: palette, shortcuts, "g x" jumps, and single letters routed to the current page. */
export function useGlobalKeys() {
  useEffect(() => {
    let g = false, gt = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { if (fireKey("mod+enter")) e.preventDefault(); return; }
      if (document.querySelector("dialog[open]") || typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") { if (prefs.get().zen) setPrefs({ zen: false }); else fireKey("escape"); return; }
      const k = e.key.toLowerCase();
      if (g) {
        g = false; clearTimeout(gt);
        const pid = currentProject();
        const to: Record<string, string> = { p: "/projects", l: "/library/design-systems", s: `/p/${pid}`, r: `/p/${pid}/review`, o: `/p/${pid}/options`, e: `/p/${pid}/spec`, b: `/p/${pid}/briefs`, h: `/p/${pid}/history` };
        if (to[k]) { e.preventDefault(); go(to[k]); }
        return;
      }
      if (k === "g") { g = true; gt = window.setTimeout(() => (g = false), 1200); return; }
      if (e.key === "?") { openKeys(); return; }
      if (fireKey(e.key === "[" || e.key === "]" ? e.key : k)) { e.preventDefault(); return; }
      if (k === "z") setPrefs({ zen: !prefs.get().zen });
      else if (k === "t") setPrefs({ theme: ({ system: "light", light: "dark", dark: "system" } as const)[prefs.get().theme] });
      else if (k === "d") setPrefs({ density: prefs.get().density === "compact" ? "cozy" : "compact" });
      else if (k === "m") setPrefs({ showMock: !prefs.get().showMock });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function Overlays() {
  return <><Palette /><KeysDialog /><Toasts /></>;
}
