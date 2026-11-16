import { useState } from "react";
import { Plus, Sparkles, Check, Trash2, GitPullRequest, GitBranch, ArrowRight } from "lucide-react";
import type { Brief, LayoutRef, Project, Screen } from "../lib/types";
import { can, WHY_NOT } from "../lib/catalog";
import { cx, go, person, pinsOf, useData, useMe, usePrefs } from "../lib/store";
import { answerPlan, checkout, planBrief, removeBrief, repoView, runBrief, specView, toggleRule, toggleStep } from "../lib/actions";
import { Preview } from "../components/Preview";
import { Btn, Chip, Empty, Glyph, Link, Seg, useKeys, useMode } from "../components/ui";
import { Fit } from "./Project";
import { SECTIONS } from "./Spec";

/** Two small previews of a screen: before and after a change. */
export function BeforeAfter({ project: p, screen, from, to }: { project: Project; screen: Screen; from?: LayoutRef; to?: LayoutRef }) {
  const d = useData(), mode = useMode(), ds = d.systems.find((s) => s.id === p.dsId);
  return (
    <div className="pair">
      {from ? <figure><figcaption>Before</figcaption><Fit device="desktop"><Preview project={p} screen={screen} ds={ds} mode={mode} device="desktop" nav={from.nav} variant={from.variant} /></Fit></figure>
        : <figure><figcaption>New</figcaption><div className="skel-box" /></figure>}
      <ArrowRight className="diff-arrow" />
      <figure><figcaption>After</figcaption><Fit device="desktop"><Preview project={p} screen={screen} ds={ds} mode={mode} device="desktop" nav={to?.nav} variant={to?.variant} /></Fit></figure>
    </div>
  );
}

const STATUS: Record<Brief["status"], { label: string; tone?: string }> = {
  planning: { label: "Claude is planning" }, planned: { label: "Plan waits for you", tone: "warn" }, running: { label: "Claude is working", tone: "accent" }, done: { label: "Done", tone: "ok" },
};
const IDEAS = [
  "Redesign the whole app for people who use it on a laptop all day. Less chrome, more content.",
  "Rework this flow so a new person can finish it without help.",
  "Add an onboarding step and a reports area. Only owners may see reports.",
];

function NewBrief({ project: p }: { project: Project }) {
  const d = useData(), me = useMe(), prefs = usePrefs();
  const pins = pinsOf(prefs, p.id), flows = [...new Set(p.screens.map((s) => s.flow))];
  const [text, setText] = useState(""), [scope, setScope] = useState<Brief["scope"]>(prefs.focus && pins.length ? "pins" : "app");
  const [flow, setFlow] = useState(flows[0] ?? ""), [tried, setTried] = useState(false);
  const may = can(me.role, "brief"), spec = specView(d, p), ds = d.systems.find((s) => s.id === p.dsId);
  const inScope = scope === "app" ? p.screens : scope === "flow" ? p.screens.filter((s) => s.flow === flow) : p.screens.filter((s) => pins.includes(s.id));
  const short = text.trim().length < 40, drafts = d.comments.filter((c) => c.projectId === p.id && c.status === "draft").length;
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault(); setTried(true);
    if (short || !inScope.length || !may) return;
    const id = planBrief({ projectId: p.id, text, scope, flow, pins, by: me.id });
    if (id) go(`/p/${p.id}/briefs/${id}`);
  };
  useKeys({ "mod+enter": () => submit() });
  return (
    <form className="brief-new form" onSubmit={submit} noValidate>
      <h2>Write a brief</h2>
      {!may && <p className="notice warn">{WHY_NOT.brief}</p>}
      <textarea className="brief-text" rows={12} autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-invalid={tried && short}
        placeholder="Paste notes, a meeting summary or a long prompt. There is no length limit." />
      {tried && short && <small className="err">{text.trim() ? "Say a little more, so Claude can plan it." : "Write the brief first."}</small>}
      <div className="ideas">{IDEAS.map((x) => <button key={x} type="button" className="idea" onClick={() => setText(x)}>{x.split(".")[0]}</button>)}</div>
      <div className="brief-scope">
        <Seg label="Scope" value={scope} onChange={setScope} options={[{ value: "app", label: "Whole app" }, { value: "flow", label: "One flow" }, { value: "pins", label: `Pinned screens (${pins.length})` }]} />
        {scope === "flow" && <select value={flow} onChange={(e) => setFlow(e.target.value)} aria-label="Flow">{flows.map((f) => <option key={f}>{f}</option>)}</select>}
      </div>
      {tried && !inScope.length ? <p className="err">No screens in this scope. Pin a screen or pick another scope.</p> : <p className="muted">In scope: {inScope.map((s) => s.name).join(", ")}</p>}
      <div className="brief-reads">
        <b>Claude reads before planning:</b>
        <ul>
          <li><Link to={`/p/${p.id}/spec`} className="link">The spec</Link>: {spec.entries.filter((e) => e.status === "agreed").length} agreed entries, {spec.entries.filter((e) => e.kind === "question").length} open questions</li>
          <li>{ds?.name ?? "The design system"} and the house toolkit</li>
          <li>{inScope.length} {inScope.length === 1 ? "screen" : "screens"} in scope and their review status</li>
          {drafts > 0 && <li>{drafts} draft review comments, so the plan does not undo them</li>}
        </ul>
      </div>
      <div className="form-actions"><Btn type="submit" variant="primary" ai icon={<Sparkles />} kbd="Ctrl Enter" disabled={!may} why={WHY_NOT.brief}>Plan with AI</Btn></div>
    </form>
  );
}

function Plan({ project: p, brief: b }: { project: Project; brief: Brief }) {
  const d = useData(), me = useMe(), repo = repoView(d, p), spec = specView(d, p);
  const may = can(me.role, "brief"), locked = b.status !== "planned";
  const on = b.steps.filter((s) => s.on), done = b.steps.filter((s) => s.done).length;
  const rules = b.rules.filter((r) => r.on).length, toBranch = b.questions.find((q) => q.key === "land")?.a !== 1;
  const pr = b.pr ? repo.prs.find((x) => x.id === b.pr) : undefined;
  useKeys({ "mod+enter": () => runBrief(b.id) });
  return (
    <div className="brief">
      <header className="brief-head">
        <h2>{b.title}</h2>
        <span className="muted">{person(b.by).name.split(" ")[0]}, {b.when.toLowerCase()}, {b.scope === "app" ? "Whole app" : b.scope === "flow" ? `${b.flow} flow` : "Pinned screens"}</span>
        <Chip tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Chip>
        {b.status === "done" && (pr ? <Link to={`/p/${p.id}/history/pr/${pr.id}`} className="chip-link"><GitPullRequest />#{pr.id} on <code>{b.branch}</code></Link>
          : <span className="muted"><GitBranch /> Applied on <code>{b.branch}</code></span>)}
        {b.status === "done" && b.branch && repo.current !== b.branch && pr?.status === "open" && <Btn size="sm" onClick={() => can(me.role, "commit") ? (checkout(p.id, b.branch!), go(`/p/${p.id}`)) : undefined}>Check out to try it</Btn>}
      </header>
      <blockquote className="brief-quote">{b.text}</blockquote>
      <section className="plan-sec"><h3>What Claude read</h3>
        {b.reading.length === 0 ? <p className="muted">{b.status === "planning" ? <><span className="spin" /> Reading the spec, the design system and the screens in scope</> : "The spec has no agreed rule that touches these screens."}</p>
          : <ul className="plan-list">{b.reading.map((id) => { const e = spec.entries.find((x) => x.id === id); return <li key={id}><code>{id}</code> {e?.title ?? <span className="muted">No longer in the spec</span>}</li>; })}</ul>}
      </section>
      <section className="plan-sec"><h3>Screens {b.steps.length > 0 && <span className="num">{on.length} of {b.steps.length}</span>}</h3>
        {b.steps.length === 0 ? <p className="muted">{b.status === "planning" ? "Planning the screens…" : "Nothing to change."}</p> : (
          <ul className="plan-steps">{b.steps.map((s, i) => {
            const screen = s.add ?? p.screens.find((x) => x.id === s.screenId);
            return (
              <li key={s.screenId} className={cx("plan-step", !s.on && "off")}>
                <label className="check"><input type="checkbox" checked={s.on} disabled={locked} onChange={(e) => toggleStep(b.id, i, e.target.checked)} />
                  <b>{s.name}</b>{s.add && <Chip tone="accent">New</Chip>}{s.done && <Chip tone="ok"><Check />Done</Chip>}
                  {b.status === "running" && !s.done && s.on && <span className="spin" />}
                  <span className="muted">{s.what.charAt(0).toUpperCase() + s.what.slice(1)}</span></label>
                {screen && s.on && <BeforeAfter project={p} screen={screen} from={s.from} to={s.to} />}
              </li>
            );
          })}</ul>
        )}
      </section>
      {b.rules.length > 0 && <section className="plan-sec plan-rules"><h3>Goes into the spec <span className="num">{rules} of {b.rules.length}</span></h3>
        <ul>{b.rules.map((r, i) => <li key={i}><label className="check"><input type="checkbox" checked={r.on} disabled={locked} onChange={(e) => toggleRule(b.id, i, e.target.checked)} /><Chip>{SECTIONS.find((x) => x.kind === r.kind)?.one}</Chip><span>{r.text}</span></label></li>)}</ul>
      </section>}
      {b.questions.length > 0 && <section className="plan-sec"><h3>Decide first</h3>
        {b.questions.map((q, qi) => (
          <div key={q.key} className="plan-q"><p>{q.q}</p>
            <div className="plan-opts" role="radiogroup" aria-label={q.q}>{q.options.map((o, i) => (
              <label key={o} className={cx("check", q.a === i && "on")}><input type="radio" name={`${b.id}-${q.key}`} checked={q.a === i} disabled={locked} onChange={() => answerPlan(b.id, qi, i)} />{o}</label>
            ))}</div>
          </div>
        ))}
      </section>}
      {(b.status === "planned" || b.status === "running") && (
        <div className="plan-foot">
          <span className="muted"><b>{on.length}</b> {on.length === 1 ? "screen" : "screens"}, <b>{rules}</b> spec {rules === 1 ? "entry" : "entries"}, {toBranch ? <>on a new branch with a pull request</> : <>straight onto <code>{repo.current}</code></>}</span>
          <span className="toolbar-space" />
          <Btn variant="ghost" icon={<Trash2 />} disabled={b.status === "running"} onClick={() => { removeBrief(b.id); go(`/p/${p.id}/briefs`); }}>Remove</Btn>
          <Btn variant="primary" ai mock kbd="Ctrl Enter" busy={b.status === "running"} disabled={!may || !on.length} why={may ? "Turn on at least one screen." : WHY_NOT.brief} onClick={() => runBrief(b.id)}>
            {b.status === "running" ? `Working, ${done} of ${on.length}` : "Run the plan"}
          </Btn>
        </div>
      )}
    </div>
  );
}

export function Briefs({ project: p, briefId }: { project: Project; briefId?: string }) {
  const d = useData();
  const list = d.briefs.filter((b) => b.projectId === p.id), brief = list.find((b) => b.id === briefId);
  return (
    <div className="page wide two-col">
      <aside className="olist">
        <div className="toolbar"><h2>Briefs</h2><span className="toolbar-space" /><Link to={`/p/${p.id}/briefs/new`} className="btn sm"><Plus /><span>New brief</span></Link></div>
        <ul>{list.map((b) => (
          <li key={b.id}><Link to={`/p/${p.id}/briefs/${b.id}`} className={cx("oitem", b.id === briefId && "on")}>
            <b>{b.title}</b><span className="oitem-prompt">{b.text}</span>
            <span className="oitem-meta"><Chip tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Chip><small className="muted">{b.when}</small></span>
          </Link></li>
        ))}</ul>
      </aside>
      <div>
        {briefId === "new" ? <NewBrief project={p} /> : brief ? <Plan project={p} brief={brief} /> : (
          <Empty title="One brief, many screens" action={<Link to={`/p/${p.id}/briefs/new`} className="btn primary"><Glyph size={16} /><span>Write a brief</span></Link>}>
            Write a long request. Claude reads the spec, plans the change screen by screen, asks what it needs, and only then does the work.
          </Empty>
        )}
      </div>
    </div>
  );
}
