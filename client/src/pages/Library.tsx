import { useRef, useState } from "react";
import { Plus, Sparkles, Copy, CopyPlus, Undo2, X, Check, Monitor, Smartphone, Sun, Moon } from "lucide-react";
import type { DesignSystem, Project } from "../lib/types";
import { can, WHY_NOT, type Kind } from "../lib/catalog";
import { SAMPLE, adjustSystem, canUndoAdjust, captureSystem, duplicateSystem, patchSystem, pinToken, setThemes, undoAdjust } from "../lib/actions";
import { cx, go, toast, useData, useMe } from "../lib/store";
import { TOKENS, contrast, tokens, tokensCss } from "../lib/theme";
import { Preview } from "../components/Preview";
import { AiHint, Btn, Chip, Empty, Link, Seg, useMode } from "../components/ui";
import { Fit } from "./Project";

const SOURCE: Record<string, string> = { project: "Taken from a project", website: "Captured from a website", prompt: "Described in words", code: "Read from source code", screenshot: "Read from a screenshot" };
const KINDS = [
  { value: "website", label: "Website", field: "Address", placeholder: "https://example.com" },
  { value: "prompt", label: "Prompt", field: "Describe the look", placeholder: "Calm and editorial, forest green accent, sharp corners, compact" },
  { value: "code", label: "Source code", field: "Folder", placeholder: "C:\\projects\\shop\\src" },
  { value: "screenshot", label: "Screenshot", field: "Image file", placeholder: "dashboard.png" },
];
const STEPS = ["Reading colours, type and spacing", "Grouping colours into roles", "Naming the tokens", "Generating the dark theme and checking contrast"];
const FONTS = ["Hanken Grotesk", "Inter", "Instrument Sans", "Space Grotesk", "Bricolage Grotesque"], MONOS = ["DM Mono", "JetBrains Mono"];
const ASKS = ["Warmer neutrals", "Rounder corners", "Higher contrast", "Calmer accent", "Teal accent, more compact"];

const Strip = ({ ds, mode }: { ds: DesignSystem; mode: "light" | "dark" }) => {
  const t = tokens(ds, mode);
  return <div className="strip">{(["bg", "surface", "line", "muted", "ink", "accent", "accentSoft"] as const).map((k) => <i key={k} style={{ background: t[k] }} />)}</div>;
};

export function DesignSystems() {
  const d = useData(), me = useMe(), mode = useMode(), may = can(me.role, "create");
  return (
    <div className="page">
      <div className="page-head"><h1>Design systems</h1><span className="toolbar-space" /><Btn variant="primary" icon={<Plus />} disabled={!may} why={WHY_NOT.create} onClick={() => go("/library/design-systems/new")}>Capture from a reference</Btn></div>
      {d.systems.length === 0 ? <Empty title="The library is empty">Capture a design system from a website, a prompt, source code or a screenshot.</Empty> : (
        <ul className="dslist">{d.systems.map((s) => {
          const used = d.projects.filter((p) => p.dsId === s.id);
          return (
            <li key={s.id} className="dsrow">
              <Link to={`/library/design-systems/${s.id}`} className="dsrow-strip" tabIndex={-1}><Strip ds={s} mode="light" /><Strip ds={s} mode="dark" /></Link>
              <div className="dsrow-main">
                <Link to={`/library/design-systems/${s.id}`} className="prow-name">{s.name}</Link>
                <span className="muted">{s.note}</span>
                <span className="dsrow-facts">{s.display} with {s.sans} · {s.radius}px corners · {s.density}{s.themes.length > 0 && ` · ${s.themes.length} theme ${s.themes.length === 1 ? "colour" : "colours"}`}</span>
                <span className="dsrow-src mono muted">{SOURCE[s.source.kind] ?? s.source.kind}: {s.source.ref}</span>
                <span className="dsrow-used muted">{used.length ? `Used by ${used.map((p) => p.name).join(", ")}` : "Not used yet"}</span>
              </div>
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}

export function CaptureSystem() {
  const d = useData(), me = useMe();
  const [kind, setKind] = useState("website"), [ref, setRef] = useState(""), [name, setName] = useState(""), [tried, setTried] = useState(false), [step, setStep] = useState(-1);
  const f = KINDS.find((k) => k.value === kind)!, may = can(me.role, "create");
  const errs = { ref: ref.trim() ? "" : `Add the ${f.field.toLowerCase()} to capture from.`, name: !name.trim() ? "Name it, so you can find it later." : d.systems.some((s) => s.name.toLowerCase() === name.trim().toLowerCase()) ? "A design system with this name already exists." : "" };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTried(true);
    if (errs.ref || errs.name || !may) return;
    setStep(0);
    const t = window.setInterval(() => setStep((x) => Math.min(STEPS.length - 1, x + 1)), 1500);
    try { const id = await captureSystem({ name, kind, ref }); if (id) go(`/library/design-systems/${id}`); }
    catch (x) { toast(x instanceof Error ? x.message : String(x)); }
    finally { window.clearInterval(t); setStep(-1); }
  };
  return (
    <div className="page">
      <div className="page-head"><div className="crumb"><Link to="/library/design-systems">Design systems</Link></div><h1>Capture a design system</h1></div>
      <form className="form narrow" onSubmit={submit} noValidate>
        {!may && <p className="notice warn">{WHY_NOT.create}</p>}
        <p className="lede">From a website, a prompt, source code or a screenshot. Claude reads it, names the tokens, and generates a dark theme that passes contrast.</p>
        <div className="field"><span>Capture from</span><Seg label="Capture from" value={kind} onChange={setKind} options={KINDS} /></div>
        <label className="field"><span>{f.field}</span>
          {kind === "prompt" ? <textarea rows={3} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={f.placeholder} aria-invalid={tried && !!errs.ref} /> : <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={f.placeholder} aria-invalid={tried && !!errs.ref} />}
          {tried && errs.ref && <small className="err">{errs.ref}</small>}
          {kind !== "prompt" && <small className="muted">Claude works from the reference as you describe it here; it does not open the site or files.</small>}
        </label>
        <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop Forest" aria-invalid={tried && !!errs.name} />{tried && errs.name && <small className="err">{errs.name}</small>}</label>
        <div className="form-actions"><Btn type="submit" variant="primary" ai mock icon={<Sparkles />} busy={step >= 0} disabled={!may} why={WHY_NOT.create}>Capture</Btn></div>
        {step >= 0 && <ol className="steps">{STEPS.map((s, i) => <li key={s} className={cx(step > i && "done", step === i && "now")}><span className="step-mark">{step > i ? <Check /> : step === i ? <span className="spin" /> : i + 1}</span>{s}</li>)}</ol>}
      </form>
    </div>
  );
}

function Slider(p: { label: string; min: number; max: number; step: number; value: number; show: string; hue?: boolean; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <label className={cx("slider", p.hue && "hue")}>
      <span>{p.label}</span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} disabled={p.disabled} onChange={(e) => p.onChange(Number(e.target.value))} />
      <output className="num">{p.show}</output>
    </label>
  );
}

const SAMPLE_PROJECT: Project = { ...SAMPLE, id: "sample", name: "Sample app" };
const SAMPLE_SCREENS: Record<string, { name: string; kind: Kind; variant: number }> = {
  Home: { name: "Home", kind: "dashboard", variant: 0 }, Board: { name: "Board", kind: "board", variant: 0 }, Table: { name: "Members", kind: "table", variant: 1 },
  Detail: { name: "Detail", kind: "detail", variant: 0 }, Form: { name: "Settings", kind: "settings", variant: 0 }, "Sign-in": { name: "Sign in", kind: "auth", variant: 1 },
};

export function DesignSystemEditor({ id }: { id: string }) {
  const d = useData(), me = useMe(), appMode = useMode();
  const s = d.systems.find((x) => x.id === id);
  const [ask, setAsk] = useState(""), [asking, setAsking] = useState(false), [hue, setHue] = useState<number | undefined>(undefined);
  const [theme, setTheme] = useState({ name: "", hue: 200 }), [sample, setSample] = useState("Home"), [mode, setMode] = useState<"light" | "dark">(appMode), [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const askRef = useRef<HTMLInputElement>(null);
  if (!s) return <div className="page"><Empty title="This design system is not in the library" action={<Link to="/library/design-systems" className="btn">Back to design systems</Link>}>It may belong to another scenario, or it was removed. Sample data can be restored from the display settings in the bar at the top.</Empty></div>;
  const may = can(me.role, "editLibrary"), used = d.projects.filter((p) => p.dsId === s.id);
  const patch = (x: Partial<DesignSystem>) => (may ? patchSystem(s.id, x) : toast(WHY_NOT.editLibrary));
  const focusAsk = (t: string) => { setAsk(t); window.setTimeout(() => askRef.current?.focus(), 0); };
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!ask.trim()) return; setAsking(true); await adjustSystem(s.id, ask); setAsking(false); setAsk(""); };
  const lightT = tokens(s, "light"), darkT = tokens(s, "dark");
  const failing = TOKENS.filter((t) => "text" in t).flatMap((t) => (["light", "dark"] as const).filter((m) => { const x = m === "light" ? lightT : darkT; return contrast(x[t.key], x[(t as { text: "surface" | "accent" }).text]) < 4.5; })).length;
  const css = tokensCss(s);
  const copy = () => navigator.clipboard?.writeText(css).then(() => toast("tokens.css copied."), () => toast("Copying is blocked here. Select the text below and copy it."));
  const sc = SAMPLE_SCREENS[sample];
  const preview = { ...SAMPLE_PROJECT, nav: "side" as const };
  return (
    <div className="page wide editor">
      <div className="page-head">
        <div className="crumb"><Link to="/library/design-systems">Design systems</Link></div>
        <h1>{s.name}</h1>
        <span className="toolbar-space" />
        <Btn icon={<CopyPlus />} onClick={() => { const n = duplicateSystem(s.id); if (n) go(`/library/design-systems/${n}`); }}>Duplicate</Btn>
        <Btn icon={<Copy />} onClick={copy}>Copy tokens.css</Btn>
      </div>
      <p className="lede">{s.note} <span className="muted">{SOURCE[s.source.kind] ?? s.source.kind}: <code>{s.source.ref}</code>. {used.length ? <>Used by {used.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link to={`/p/${p.id}`}>{p.name}</Link></span>)}.</> : "No prototype uses it yet."}</span></p>
      {!may && <p className="notice">{WHY_NOT.editLibrary}</p>}
      <div className="two-col">
        <div className="editor-form">
          <form className="ask field-row" onSubmit={submit}>
            <input ref={askRef} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Describe the change, for example: warmer neutrals and rounder corners" aria-label="Ask AI to adjust this design system" disabled={!may} />
            <Btn type="submit" ai icon={<Sparkles />} busy={asking} disabled={!may || !ask.trim()} why={WHY_NOT.editLibrary}>Adjust</Btn>
          </form>
          <div className="ideas">{ASKS.map((x) => <button key={x} type="button" className="idea" onClick={() => focusAsk(x)}>{x}</button>)}</div>
          {s.log.length > 0 && <ul className="log">{s.log.map((l) => (
            <li key={l.id}><p className="log-ask">{l.ask}</p><p className="log-reply">{l.reply} {canUndoAdjust(l.id) && <button type="button" className="link" onClick={() => undoAdjust(s.id, l.id)}><Undo2 /> Undo</button>}</p></li>
          ))}</ul>}

          <section className="ed"><h3>Colour <AiHint label="Colour: describe it to AI instead" onClick={() => focusAsk("Accent: ")} /></h3>
            <p className="muted">Six controls generate all ten tokens for both themes. Moving one releases any captured values it would otherwise hide.</p>
            <Slider label="Accent hue" hue min={0} max={360} step={1} value={s.accentHue} show={`${Math.round(s.accentHue)}°`} disabled={!may} onChange={(v) => patch({ accentHue: v })} />
            <Slider label="Accent strength" min={0.04} max={0.26} step={0.005} value={s.accentChroma} show={s.accentChroma.toFixed(3)} disabled={!may} onChange={(v) => patch({ accentChroma: v })} />
            <Slider label="Accent lightness" min={0.4} max={0.85} step={0.01} value={s.accentL} show={s.accentL.toFixed(2)} disabled={!may} onChange={(v) => patch({ accentL: v })} />
            <Slider label="Neutral tint" hue min={0} max={360} step={1} value={s.neutralHue} show={`${Math.round(s.neutralHue)}°`} disabled={!may} onChange={(v) => patch({ neutralHue: v })} />
            <Slider label="Neutral strength" min={0} max={0.03} step={0.001} value={s.neutralChroma} show={s.neutralChroma.toFixed(3)} disabled={!may} onChange={(v) => patch({ neutralChroma: v })} />
            <Slider label="Contrast" min={0} max={1} step={0.05} value={s.contrast} show={s.contrast === 0 ? "Standard" : `+${Math.round(s.contrast * 100)}%`} disabled={!may} onChange={(v) => patch({ contrast: v })} />
          </section>

          <section className="ed"><h3>Theme colours <AiHint label="Theme colours: describe it to AI instead" onClick={() => focusAsk("Add theme colours: ")} /></h3>
            <p className="muted">Alternative accents a prototype can offer in its display settings. Each is generated for light and dark.</p>
            <div className="themes" role="radiogroup" aria-label="Preview theme colour">
              <button type="button" role="radio" aria-checked={hue === undefined} className={cx("theme", hue === undefined && "on")} onClick={() => setHue(undefined)}><i style={{ background: tokens(s, mode).accent }} />Default</button>
              {s.themes.map((t) => (
                <span key={t.name} className={cx("theme", hue === t.hue && "on")}>
                  <button type="button" role="radio" aria-checked={hue === t.hue} onClick={() => setHue(t.hue)}><i style={{ background: tokens(s, mode, t.hue).accent }} />{t.name}</button>
                  {may && <button type="button" className="theme-x" aria-label={`Remove ${t.name}`} onClick={() => setThemes(s.id, s.themes.filter((x) => x !== t))}><X /></button>}
                </span>
              ))}
            </div>
            {may && <form className="field-row" onSubmit={(e) => { e.preventDefault(); if (theme.name.trim()) { setThemes(s.id, [...s.themes, { name: theme.name.trim(), hue: theme.hue }]); setTheme({ name: "", hue: 200 }); } }}>
              <input value={theme.name} onChange={(e) => setTheme({ ...theme, name: e.target.value })} placeholder="Add a theme colour" aria-label="Theme colour name" />
              <input type="range" min={0} max={360} value={theme.hue} onChange={(e) => setTheme({ ...theme, hue: Number(e.target.value) })} aria-label="Hue" style={{ accentColor: tokens(s, "light", theme.hue).accent }} />
              <Btn type="submit" size="sm" disabled={!theme.name.trim()}>Add</Btn>
            </form>}
          </section>

          <section className="ed"><h3>Tokens <AiHint label="Tokens: describe it to AI instead" onClick={() => focusAsk("Tokens: ")} /> <Chip tone={failing ? "warn" : "ok"}>{failing === 0 ? "All text pairs pass AA" : `${failing} text ${failing === 1 ? "pair is" : "pairs are"} below 4.5:1`}</Chip></h3>
            <div className="ttable" role="table" aria-label="Tokens">
              <div className="trow thead" role="row"><span role="columnheader">Token</span><span role="columnheader">Light</span><span role="columnheader">Dark</span><span role="columnheader">Contrast</span></div>
              {TOKENS.map((t) => (
                <div key={t.key} className="trow" role="row">
                  <span role="cell" className="tname"><code>{t.css}</code><small className="muted">{t.role}</small></span>
                  {(["light", "dark"] as const).map((m) => {
                    const v = (m === "light" ? lightT : darkT)[t.key], pinned = t.key in s.pins[m];
                    return (
                      <span key={m} role="cell" className="tval">
                        <input type="color" value={v.length === 7 ? v : "#000000"} disabled={!may} aria-label={`${t.css} in ${m}`} onChange={(e) => pinToken(s.id, m, t.key, e.target.value)} />
                        <code>{v}</code>
                        {pinned && <button type="button" className="unpin link" title="Captured value. Release it to use the generated one." aria-label={`Release ${t.css} in ${m}`} disabled={!may} onClick={() => pinToken(s.id, m, t.key, null)}>Release</button>}
                      </span>
                    );
                  })}
                  <span role="cell" className="tcon num">{"text" in t ? (["light", "dark"] as const).map((m) => { const x = m === "light" ? lightT : darkT; const c = contrast(x[t.key], x[(t as { text: "surface" | "accent" }).text]); return <span key={m} className={c < 4.5 ? "bad" : undefined}>{c.toFixed(1)} </span>; }) : <span className="muted">Not text</span>}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="ed"><h3>Type and shape <AiHint label="Type and shape: describe it to AI instead" onClick={() => focusAsk("Type and corners: ")} /></h3>
            <div className="grid3">
              <label className="field"><span>Headings</span><select value={s.display} disabled={!may} onChange={(e) => patch({ display: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
              <label className="field"><span>Text</span><select value={s.sans} disabled={!may} onChange={(e) => patch({ sans: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
              <label className="field"><span>Data</span><select value={s.mono} disabled={!may} onChange={(e) => patch({ mono: e.target.value })}>{MONOS.map((f) => <option key={f}>{f}</option>)}</select></label>
            </div>
            <Slider label="Corner radius" min={0} max={18} step={1} value={s.radius} show={`${s.radius}px`} disabled={!may} onChange={(v) => patch({ radius: v })} />
            <div className="field inline"><span>Density</span><Seg label="Density" value={s.density} onChange={(v) => patch({ density: v })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></div>
          </section>

          <section className="ed"><h3>tokens.css</h3><pre className="code">{css}</pre></section>
        </div>

        <aside className="editor-preview">
          <div className="toolbar">
            <select value={sample} onChange={(e) => setSample(e.target.value)} aria-label="Sample screen">{Object.keys(SAMPLE_SCREENS).map((k) => <option key={k} value={k}>{k} screen</option>)}</select>
            <span className="toolbar-space" />
            <Seg label="Preview theme" iconOnly value={mode} onChange={setMode} options={[{ value: "light", label: "Light", icon: <Sun /> }, { value: "dark", label: "Dark", icon: <Moon /> }]} />
            <Seg label="Preview device" iconOnly value={device} onChange={setDevice} options={[{ value: "desktop", label: "Desktop", icon: <Monitor /> }, { value: "phone", label: "Phone", icon: <Smartphone /> }]} />
          </div>
          <Fit device={device}><Preview project={preview} screen={{ id: sc.name, name: sc.name, flow: "Core", kind: sc.kind, variant: sc.variant, status: "unreviewed", mock: 0 }} ds={hue === undefined ? s : { ...s, accentHue: hue, pins: { light: {}, dark: {} } }} mode={mode} device={device} /></Fit>
          <div className="pair"><Strip ds={s} mode="light" /><Strip ds={s} mode="dark" /></div>
        </aside>
      </div>
    </div>
  );
}
