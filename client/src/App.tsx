import { useEffect, type CSSProperties } from "react";
import { Bar, Overlays, Side, useGlobalKeys, APP_SCREENS } from "./components/Shell";
import { Empty, Kbd, Link, useMode } from "./components/ui";
import { ACCENTS, HOUSE_SYSTEM, go, setPrefs, useAccount, useData, usePrefs, useRoute } from "./lib/store";
import { tokens } from "./lib/theme";
import { SignIn } from "./pages/SignIn";
import { Settings } from "./pages/Settings";
import { Projects, NewProject } from "./pages/Projects";
import { ProjectPage } from "./pages/Project";
import { Run } from "./pages/Run";
import { DesignSystems, DesignSystemEditor, CaptureSystem } from "./pages/Library";

export function Planned({ id, back }: { id: string; back: { to: string; label: string } }) {
  const s = APP_SCREENS.find((x) => x.id === id)!;
  return (
    <div className="page">
      <div className="page-head"><h1>{s.title}</h1><span className="chip">Planned</span></div>
      <p className="lede">Not built yet. This is what it is meant to do.</p>
      <ul className="planned-list">{s.planned?.map((x) => <li key={x}>{x}</li>)}</ul>
      <p><Link to={back.to} className="link">{back.label}</Link></p>
    </div>
  );
}

function Routes() {
  const r = useRoute(), d = useData();
  const [a, b, c] = r.parts;
  if (a === "settings") return <Settings />;
  if (a === "library") {
    if (b === "design-systems" && c === "new") return <CaptureSystem />;
    if (b === "design-systems" && c) return <DesignSystemEditor id={c} />;
    if (b === "toolkits") return <Planned id="toolkits" back={{ to: "/library/design-systems", label: "Back to design systems" }} />;
    if (b === "frameworks") return <Planned id="frameworks" back={{ to: "/library/design-systems", label: "Back to design systems" }} />;
    return <DesignSystems />;
  }
  if (a === "p" && b) {
    const p = d.projects.find((x) => x.id === b);
    if (!p) return (
      <div className="page"><Empty title="This prototype is not in the current scenario" action={<Link to="/projects" className="btn">Back to prototypes</Link>}>
        The link points at a prototype the loaded sample data does not contain. Switch scenario from the bar at the top, or reset the sample data.
      </Empty></div>
    );
    return <ProjectPage project={p} parts={r.parts} />;
  }
  if (a === "projects" && b === "new") return <NewProject />;
  return <Projects />;
}

export function App() {
  const { user, ready } = useAccount(), p = usePrefs(), r = useRoute(), mode = useMode();
  useGlobalKeys();
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = mode;
    el.dataset.density = p.density === "compact" ? "compact" : "";
    el.style.zoom = String(p.zoom / 100);
    const accent = ACCENTS.find((x) => x.id === p.accent);
    const t = accent?.hue != null ? tokens(HOUSE_SYSTEM, mode, accent.hue) : null;
    for (const k of ["--accent", "--accent-soft", "--accent-line", "--accent-ink"]) el.style.removeProperty(k);
    if (t) { el.style.setProperty("--accent", t.accent); el.style.setProperty("--accent-soft", t.accentSoft); el.style.setProperty("--accent-line", t.accentLine); el.style.setProperty("--accent-ink", t.accentInk); }
  }, [mode, p.density, p.zoom, p.accent]);
  useEffect(() => {
    if (!ready) return;
    if (!user && r.parts[0] !== "signin") go("/signin");
    else if (user && (r.parts[0] === "signin" || r.path === "/")) go("/projects");
  }, [ready, user, r.path]);

  const run = r.parts[0] === "p" && r.parts[2] === "run";
  let body;
  if (!ready) body = <div className="page"><p className="muted">Loading…</p></div>;
  else if (!user) body = <SignIn />;
  else if (run) body = <Run parts={r.parts} />;
  else body = <Side><Routes /></Side>;
  return (
    <div className="proto" data-zen={p.zen || undefined} data-mock={p.showMock || undefined} style={{} as CSSProperties}>
      {!p.zen && !run && <Bar />}
      {p.zen && !run && <button type="button" className="zen-exit btn sm" onClick={() => setPrefs({ zen: false })}>Exit zen mode <Kbd k="Z" /></button>}
      {body}
      <Overlays />
    </div>
  );
}
