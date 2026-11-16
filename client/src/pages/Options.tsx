import { useEffect, useState } from "react";
import { Plus, Sparkles, Star, Check, Sun, Moon, Monitor, Smartphone } from "lucide-react";
import type { Project, Round, Option } from "../lib/types";
import { LAYOUTS, NAV_INFO, can, WHY_NOT } from "../lib/catalog";
import { cx, go, person, useData, useMe, usePrefs } from "../lib/store";
import { applyOption, moreLikeThis, newRound, patchOption, pickOption } from "../lib/actions";
import { Preview } from "../components/Preview";
import { Btn, Chip, Empty, Link, Seg, useKeys, useMode } from "../components/ui";
import { Fit } from "./Project";

const LETTERS = "ABCDEFGHI";
const PROMPTS = ["Less chrome, more content on a laptop", "Comfortable one-handed on a phone", "Denser, for people who live in it all day"];

function NewRound({ project: p, onCancel }: { project: Project; onCancel?: () => void }) {
  const me = useMe(), prefs = usePrefs();
  const pinned = prefs.pins[p.id]?.[0];
  const [screenId, setScreenId] = useState(pinned ?? p.screens.find((s) => s.kind !== "auth")?.id ?? p.screens[0]?.id);
  const [prompt, setPrompt] = useState(""), [want, setWant] = useState("3"), [tried, setTried] = useState(false);
  const may = can(me.role, "pick");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTried(true);
    if (!prompt.trim() || !screenId) return;
    const id = await newRound({ projectId: p.id, screenId, prompt: prompt.trim(), want: Number(want), by: me.id });
    if (id) go(`/p/${p.id}/options/${id}`);
  };
  return (
    <form className="form narrow" onSubmit={submit} noValidate>
      <h2>Ask for options</h2>
      <p className="lede">Claude drafts several takes on one screen. You compare them side by side, pick one, and it is applied to the whole prototype.</p>
      <label className="field"><span>Screen</span><select value={screenId} onChange={(e) => setScreenId(e.target.value)}>{p.screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field"><span>What do you want to explore?</span>
        <textarea rows={3} value={prompt} autoFocus onChange={(e) => setPrompt(e.target.value)} placeholder="Say what you are unsure about, so the options differ in the right way." aria-invalid={tried && !prompt.trim()} />
        {tried && !prompt.trim() && <small className="err">Say what you are unsure about, so the options differ in the right way.</small>}
      </label>
      <div className="ideas">{PROMPTS.map((x) => <button key={x} type="button" className="idea" onClick={() => setPrompt(x)}>{x}</button>)}</div>
      <div className="field"><span>How many</span><Seg label="How many options" value={want} onChange={setWant} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} /></div>
      <div className="form-actions">
        <Btn type="submit" variant="primary" ai icon={<Sparkles />} disabled={!may} why={WHY_NOT.pick}>Draw options</Btn>
        {onCancel && <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>}
      </div>
    </form>
  );
}

function Apply({ round: r, project: p, option: o, letter }: { round: Round; project: Project; option: Option; letter: string }) {
  const me = useMe(), screen = p.screens.find((s) => s.id === r.screenId)!;
  const same = p.screens.filter((s) => s.kind === screen.kind);
  const [nav, setNav] = useState(o.nav !== p.nav), [picked, setPicked] = useState<string[]>([screen.id]);
  useEffect(() => { setNav(o.nav !== p.nav); setPicked([screen.id]); }, [o.id]);
  const n = (nav && o.nav !== p.nav ? p.screens.length : 0) + (nav && o.nav !== p.nav ? 0 : picked.filter((id) => p.screens.find((s) => s.id === id)!.variant !== o.variant).length);
  return (
    <section className="apply">
      <h3>Apply option {letter} to {p.name}</h3>
      {o.nav !== p.nav && <label className="check"><input type="checkbox" checked={nav} onChange={(e) => setNav(e.target.checked)} />Navigation: {NAV_INFO[p.nav].name} to {NAV_INFO[o.nav].name}, on all {p.screens.length} screens</label>}
      <p className="muted">Layout "{LAYOUTS[screen.kind][o.variant].name}" on screens of the same kind:</p>
      {same.map((s) => (
        <label key={s.id} className="check"><input type="checkbox" checked={picked.includes(s.id)} onChange={() => setPicked((x) => x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id])} />
          {s.name} <small className="muted">{s.variant === o.variant ? "Already like this" : `Now ${LAYOUTS[s.kind][s.variant].name.toLowerCase()}`}</small></label>
      ))}
      <div className="apply-foot">
        <span className="muted">{n === 0 ? "Nothing would change." : `${n} ${n === 1 ? "screen changes and goes" : "screens change and go"} back to review.`} The board is kept as a record.</span>
        <Btn variant="primary" busy={r.status === "applying"} disabled={n === 0 || !can(me.role, "apply")} why={n === 0 ? undefined : WHY_NOT.apply} onClick={() => applyOption(r.id, { nav, screens: picked })}>
          {r.status === "applying" ? "Applying" : "Apply to prototype"}
        </Btn>
      </div>
    </section>
  );
}

function Board({ project: p, round: r }: { project: Project; round: Round }) {
  const d = useData(), me = useMe(), appMode = useMode();
  const [mode, setMode] = useState<"light" | "dark">(appMode), [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const screen = p.screens.find((s) => s.id === r.screenId);
  const ds = d.systems.find((s) => s.id === p.dsId), may = can(me.role, "pick");
  useKeys({
    l: () => setMode((m) => (m === "light" ? "dark" : "light")),
    ...Object.fromEntries(r.options.slice(0, 9).map((o, i) => [String(i + 1), () => r.status === "open" && pickOption(r.id, r.picked === o.id ? undefined : o.id)])),
  });
  if (!screen) return <Empty title="This screen is gone">The screen this round explored is no longer in the prototype.</Empty>;
  const picked = r.options.find((o) => o.id === r.picked);
  return (
    <div className="options-main">
      <div className="toolbar top">
        <div><b>{screen.name}</b> <span className="muted">by {person(r.by).name.split(" ")[0]}, {r.when.toLowerCase()}</span><p className="oprompt">"{r.prompt}"</p></div>
        <span className="toolbar-space" />
        {r.status === "applied" && <Chip tone="ok"><Check />Applied option {LETTERS[r.options.findIndex((o) => o.id === r.picked)]}</Chip>}
        <Seg label="Preview theme" iconOnly value={mode} onChange={setMode} options={[{ value: "light", label: "Light", icon: <Sun /> }, { value: "dark", label: "Dark", icon: <Moon /> }]} />
        <Seg label="Preview device" iconOnly value={device} onChange={setDevice} options={[{ value: "desktop", label: "Desktop", icon: <Monitor /> }, { value: "phone", label: "Phone", icon: <Smartphone /> }]} />
      </div>
      <div className="board">
        <article className="opt current">
          <header><span className="opt-letter">Now</span><b>{NAV_INFO[p.nav].name}, {LAYOUTS[screen.kind][screen.variant].name.toLowerCase()}</b></header>
          <Fit device={device}><Preview project={p} screen={screen} ds={ds} mode={mode} device={device} /></Fit>
        </article>
        {r.options.map((o, i) => {
          const on = r.picked === o.id, navDiff = o.nav !== p.nav, layDiff = o.variant !== screen.variant;
          return (
            <article key={o.id} className={cx("opt", on && "picked")}>
              <header>
                <span className="opt-letter">{LETTERS[i]}</span>
                <b>{NAV_INFO[o.nav].name}, {LAYOUTS[screen.kind][o.variant].name.toLowerCase()}</b>
                <button type="button" className={cx("star btn ghost sm icon-only", o.starred && "on")} aria-pressed={o.starred} aria-label={o.starred ? "Remove star" : "Star this option"} title={o.starred ? "Starred" : "Star"} onClick={() => patchOption(r.id, o.id, { starred: !o.starred })}><Star /></button>
              </header>
              <Fit device={device}><Preview project={p} screen={screen} ds={ds} mode={mode} device={device} nav={o.nav} variant={o.variant} /></Fit>
              <p className="opt-why">{LAYOUTS[screen.kind][o.variant].why} {navDiff && NAV_INFO[o.nav].why}</p>
              <div className="opt-diff">{navDiff && <Chip>Navigation</Chip>}{layDiff && <Chip>Layout</Chip>}{!navDiff && !layDiff && <Chip>Same as now</Chip>}</div>
              <input className="opt-note" value={o.note} placeholder="Note for the team" aria-label={`Note on option ${LETTERS[i]}`} onChange={(e) => patchOption(r.id, o.id, { note: e.target.value })} />
              {r.status !== "applied" && (
                <div className="form-actions">
                  <Btn variant={on ? "primary" : "default"} size="sm" kbd={String(i + 1)} icon={on ? <Check /> : undefined} disabled={!may} why={WHY_NOT.pick} onClick={() => pickOption(r.id, on ? undefined : o.id)}>{on ? "Picked" : "Pick this"}</Btn>
                  <Btn size="sm" variant="ghost" ai icon={<Sparkles />} disabled={r.status !== "open" || !may} why={WHY_NOT.pick} onClick={() => void moreLikeThis(r.id, o.id)}>More like this</Btn>
                </div>
              )}
            </article>
          );
        })}
        {r.status === "generating" && Array.from({ length: Math.max(1, r.want - r.options.length) }, (_, i) => (
          <article key={i} className="opt skeleton" aria-hidden="true"><header><span className="opt-letter">{LETTERS[r.options.length + i]}</span></header><div className="skel-box" /><p className="muted"><span className="spin" /> Claude is drafting options for {screen.name}</p></article>
        ))}
      </div>
      {picked && r.status !== "applied" && <Apply round={r} project={p} option={picked} letter={LETTERS[r.options.indexOf(picked)]} />}
      {!picked && r.status === "open" && <p className="notice">Pick an option to see exactly which screens it would change before anything is applied.</p>}
    </div>
  );
}

export function Options({ project: p, roundId }: { project: Project; roundId?: string }) {
  const d = useData();
  const rounds = d.rounds.filter((r) => r.projectId === p.id);
  const round = rounds.find((r) => r.id === roundId);
  if (!p.screens.length) return <div className="page"><Empty title="No screens to explore yet">Options are drawn for one screen at a time. They appear once Claude has drafted the first screens.</Empty></div>;
  return (
    <div className="page wide options">
      <aside className="olist">
        <div className="toolbar"><h2>Option rounds</h2><span className="toolbar-space" /><Link to={`/p/${p.id}/options/new`} className="btn sm"><Plus /><span>New round</span></Link></div>
        <ul>{rounds.map((r) => (
          <li key={r.id}>
            <Link to={`/p/${p.id}/options/${r.id}`} className={cx("oitem", r.id === roundId && "on")}>
              <b>{p.screens.find((s) => s.id === r.screenId)?.name}</b>
              <span className="oitem-prompt">{r.prompt}</span>
              <span className="oitem-meta">
                {r.status === "applied" ? <Chip tone="ok">Applied</Chip> : r.status === "generating" ? <Chip>Drafting</Chip> : <Chip tone="accent">{r.picked ? "Picked, not applied" : `${r.options.length} options`}</Chip>}
                <small className="muted">{r.when}</small>
              </span>
            </Link>
          </li>
        ))}</ul>
      </aside>
      {round ? <Board project={p} round={round} /> : roundId === "new" || !rounds.length ? <NewRound project={p} onCancel={rounds.length ? () => go(`/p/${p.id}/options`) : undefined} />
        : <Empty title="Pick a round" action={<Link to={`/p/${p.id}/options/new`} className="btn primary"><Plus /><span>New round</span></Link>}>Open a round on the left to compare its options, or ask Claude for a new set.</Empty>}
    </div>
  );
}
