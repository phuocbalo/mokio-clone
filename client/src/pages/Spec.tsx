import { useRef, useState } from "react";
import { Plus, Sparkles, FileText, GitBranch, MoreHorizontal, Crosshair, Check, X } from "lucide-react";
import type { Change, Entry, EntryKind, Note, Project } from "../lib/types";
import { can, WHY_NOT } from "../lib/catalog";
import { cx, firstName, person, pinsOf, toast, useData, useMe, usePrefs } from "../lib/store";
import {
  addEntry, answerNote, answerQuestion, applyNote, askSpec, branchSnapshot, changeKey, discardNote, editEntry, editIntro,
  removeEntry, repoView, specDiff, specMarkdown, specView,
} from "../lib/actions";
import { Avatar, Btn, Chip, Glyph, Link, Menu, MenuItem } from "../components/ui";

export const SECTIONS: { kind: EntryKind; title: string; one: string; about: string }[] = [
  { kind: "term", title: "Glossary", one: "Term", about: "The words the product uses, so screens and people mean the same thing." },
  { kind: "role", title: "Roles", one: "Role", about: "Who uses it and what each role may see and do." },
  { kind: "business", title: "Business rules", one: "Business rule", about: "What must hold, whatever the screen looks like." },
  { kind: "design", title: "Design rules", one: "Design rule", about: "How the screens look and behave, across the app." },
  { kind: "flow", title: "Flows", one: "Flow", about: "The paths people take through the screens." },
  { kind: "decision", title: "Decisions", one: "Decision", about: "What was chosen and why, so it is not argued again." },
  { kind: "question", title: "Open questions", one: "Question", about: "What still needs deciding." },
];
const IDEAS = ["Observers can comment on cards", "Rename board to project everywhere", "Agree DR-3", "Overdue cards show the due date in red"];
const scrollTo = (id: string) => { try { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* ignore */ } };

/** A list of spec edits: what is added, reworded or removed. */
export function SpecChanges({ changes }: { changes: Change[] }) {
  return (
    <ul className="diff">{changes.filter((c) => c.spec).map((c) => {
      const s = c.spec!;
      return (
        <li key={changeKey(c)} className="diff-row">
          {s.put ? <><Chip tone={s.prev ? "warn" : "ok"}>{s.prev ? "Changed" : "New"}</Chip><b>{s.put.id}</b> {s.put.title}
            {s.prev && s.prev.text !== s.put.text && <div className="spec-cmp"><del>{s.prev.text}</del><ins>{s.put.text}</ins></div>}
            {!s.prev && <p className="muted">{s.put.text}</p>}</>
            : s.drop ? <><Chip tone="bad">Removed</Chip><b>{s.drop}</b> {s.prev?.title}</> : <><Chip>Overview</Chip>{c.what}</>}
        </li>
      );
    })}</ul>
  );
}

function EntryForm({ project: p, kind, entry, onDone }: { project: Project; kind: EntryKind; entry?: Entry; onDone: () => void }) {
  const me = useMe();
  const [title, setTitle] = useState(entry?.title ?? ""), [text, setText] = useState(entry?.text ?? "");
  const [screens, setScreens] = useState<string[]>(entry?.screens ?? []);
  const one = SECTIONS.find((s) => s.kind === kind)!.one;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;
    if (entry) editEntry(p.id, entry.id, { title: title.trim(), text: text.trim(), screens });
    else toast(`${addEntry(p.id, { kind, title: title.trim(), text: text.trim(), screens, status: kind === "question" ? "open" : "agreed", source: `Written by ${firstName(me.id)}` })} added to the spec.`);
    onDone();
  };
  return (
    <form className="entry-form" onSubmit={save}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "question" ? "What needs deciding?" : "A short name"} aria-label="Title" autoFocus />
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "question" ? "The question in full" : "The rule in one or two sentences"} aria-label="Text" />
      <details><summary>Applies to {screens.length ? `${screens.length} ${screens.length === 1 ? "screen" : "screens"}` : "the whole app"}</summary>
        <div className="picks">{p.screens.map((s) => <label key={s.id} className="check"><input type="checkbox" checked={screens.includes(s.id)} onChange={() => setScreens((x) => x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id])} />{s.name}</label>)}</div>
      </details>
      <div className="form-actions">
        <Btn type="submit" variant="primary" size="sm" disabled={!title.trim() || !text.trim()}>{entry ? "Save" : `Add ${one.toLowerCase()} to the spec`}</Btn>
        <Btn size="sm" variant="ghost" onClick={onDone}>Cancel</Btn>
      </div>
    </form>
  );
}

function EntryRow({ project: p, e, may, dirty, onAsk }: { project: Project; e: Entry; may: boolean; dirty: boolean; onAsk: (t: string) => void }) {
  const [editing, setEditing] = useState(false), [answer, setAnswer] = useState("");
  const shown = e.screens.slice(0, 3).map((id) => p.screens.find((s) => s.id === id)).filter(Boolean);
  if (editing) return <li className="entry"><EntryForm project={p} kind={e.kind} entry={e} onDone={() => setEditing(false)} /></li>;
  return (
    <li id={`entry-${e.id}`} className={cx("entry", e.status)}>
      <span className="entry-id mono">{e.id}</span>
      <div className="entry-body">
        <div className="entry-head"><b>{e.title}</b>
          {e.status === "proposed" && <Chip tone="warn">Proposed</Chip>}
          {e.status === "open" && <Chip tone="warn">{e.kind === "question" ? "Open" : "Not written yet"}</Chip>}
          {dirty && <Chip title="Changed and not committed yet">Uncommitted</Chip>}</div>
        <p>{e.text}</p>
        <div className="entry-meta">
          <span className="entry-src">{e.auto && <Glyph size={12} />}{e.source}</span>
          {e.screens.length === 0 ? <span className="muted">Whole app</span> : <>{shown.map((s) => <Link key={s!.id} to={`/p/${p.id}/review/${s!.id}`} className="entry-screen"><Crosshair />{s!.name}</Link>)}{e.screens.length > 3 && <span className="muted">and {e.screens.length - 3} more</span>}</>}
        </div>
        {e.kind === "question" && may && (
          <form className="field-row" onSubmit={(x) => { x.preventDefault(); if (answer.trim()) { answerQuestion(p.id, e.id, answer); setAnswer(""); } }}>
            <input value={answer} onChange={(x) => setAnswer(x.target.value)} placeholder="Your answer becomes a decision" aria-label={`Answer to ${e.id}`} />
            <Btn size="sm" type="submit" disabled={!answer.trim()}>Decide</Btn>
            <Btn size="sm" variant="ghost" ai icon={<Sparkles />} onClick={() => onAsk(`Answer ${e.id}: ${answer.trim()}`)}>Work out with AI</Btn>
          </form>
        )}
        {e.status === "proposed" && may && (
          <div className="entry-act">
            <Btn size="sm" icon={<Check />} onClick={() => editEntry(p.id, e.id, { status: "agreed" })}>Agree</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit first</Btn>
            <Btn size="sm" variant="ghost" onClick={() => removeEntry(p.id, e.id)}>Dismiss</Btn>
          </div>
        )}
      </div>
      <Menu className="btn ghost sm icon-only" label={`Actions for ${e.id}`} align="end" button={<MoreHorizontal />}>
        {(close) => <>
          <MenuItem icon={<Sparkles />} onClick={() => { close(); onAsk(`${e.id}: `); }}>Ask AI</MenuItem>
          <MenuItem onClick={() => { close(); may ? setEditing(true) : toast(WHY_NOT.spec); }}>Edit</MenuItem>
          {e.status === "agreed" && <MenuItem onClick={() => { close(); may ? editEntry(p.id, e.id, { status: "proposed" }) : toast(WHY_NOT.spec); }}>Reopen for discussion</MenuItem>}
          <MenuItem danger onClick={() => { close(); may ? removeEntry(p.id, e.id) : toast(WHY_NOT.spec); }}>Remove</MenuItem>
        </>}
      </Menu>
    </li>
  );
}

function NoteRow({ n, may }: { n: Note; may: boolean }) {
  const who = person(n.by);
  if (n.kind === "record") return (
    <li className="note record"><Glyph size={14} /><div className="note-body"><p>{n.text}</p><span className="note-meta">{n.when}{n.branch && <code>{n.branch}</code>}{n.link && <Link to={n.link} className="link">Open</Link>}</span></div></li>
  );
  return (
    <li className={cx("note ask", n.status)}>
      <div className="note-you"><Avatar p={who} size="sm" /><div><p>{n.text}</p><small className="muted">{who.name.split(" ")[0]}, {n.when.toLowerCase()}</small></div></div>
      {n.dialog.map((q, i) => (
        <div key={i} className="note-claude"><Glyph size={12} /><div><p>{q.q}</p>
          {q.picked == null ? <div className="decide-opts">{q.options.map((o, j) => <Btn key={o} size="sm" ai disabled={!may} why={WHY_NOT.spec} onClick={() => answerNote(n.id, j)}>{o}</Btn>)}</div>
            : <Chip tone="accent">{q.options[q.picked]}</Chip>}</div></div>
      ))}
      {n.status === "thinking" && <p className="cmt-wait"><span className="spin" /> Claude is reading the spec</p>}
      {n.reply && <div className="note-claude"><Glyph size={12} /><p>{n.reply}</p></div>}
      {n.changes.length > 0 && n.status !== "discarded" && <SpecChanges changes={n.changes} />}
      {n.status === "proposed" && (
        <div className="entry-act">
          <Btn size="sm" variant="primary" icon={<Check />} disabled={!may} why={WHY_NOT.spec} onClick={() => applyNote(n.id)}>Apply {n.changes.length} {n.changes.length === 1 ? "edit" : "edits"}</Btn>
          <Btn size="sm" variant="ghost" icon={<X />} onClick={() => discardNote(n.id)}>Discard</Btn>
        </div>
      )}
      {n.status === "applied" && <Chip tone="ok">Applied on {n.branch}</Chip>}
      {n.status === "discarded" && <Chip>Discarded</Chip>}
    </li>
  );
}

export function SpecPage({ project: p }: { project: Project }) {
  const d = useData(), me = useMe(), prefs = usePrefs();
  const spec = specView(d, p), repo = repoView(d, p), may = can(me.role, "spec");
  const pins = pinsOf(prefs, p.id);
  const [filter, setFilter] = useState(prefs.focus && pins.length ? "pinned" : "");
  const [adding, setAdding] = useState<EntryKind | null>(null), [raw, setRaw] = useState(false), [introEdit, setIntroEdit] = useState(false);
  const [purpose, setPurpose] = useState(spec.purpose), [users, setUsers] = useState(spec.users);
  const [ask, setAsk] = useState(""), [cmp, setCmp] = useState("");
  const askRef = useRef<HTMLTextAreaElement>(null);
  const focusAsk = (t: string) => { setAsk(t); window.setTimeout(() => { askRef.current?.focus(); askRef.current?.scrollIntoView({ block: "center" }); }, 0); };
  const shown = spec.entries.filter((e) => !filter || e.screens.length === 0 || (filter === "pinned" ? e.screens.some((s) => pins.includes(s)) : e.screens.includes(filter)));
  const waiting = spec.entries.filter((e) => e.status !== "agreed");
  const dirty = new Set(repo.working.filter((c) => c.spec).map((c) => c.spec!.put?.id ?? c.spec!.drop));
  const specEdits = repo.working.filter((c) => c.spec).length;
  const others = repo.branches.filter((b) => b.name !== repo.current && !b.merged);
  const diff = cmp ? specDiff(spec, branchSnapshot(d, p, cmp).spec) : null;
  const notes = d.notes.filter((n) => n.projectId === p.id);
  const submitAsk = (e?: React.FormEvent) => { e?.preventDefault(); if (ask.trim() && askSpec(p.id, ask, me.id)) setAsk(""); };

  return (
    <div className="spec has-ask">
      <nav className="spec-nav" aria-label="Sections of the spec">
        <a href="#spec-intro" onClick={(e) => { e.preventDefault(); scrollTo("spec-intro"); }}>Overview</a>
        {waiting.length > 0 && <a href="#spec-waiting" onClick={(e) => { e.preventDefault(); scrollTo("spec-waiting"); }}>Waiting for you <span className="num">{waiting.length}</span></a>}
        {SECTIONS.map((s) => <a key={s.kind} href={`#spec-${s.kind}`} onClick={(e) => { e.preventDefault(); scrollTo(`spec-${s.kind}`); }}>{s.title} <span className="num">{spec.entries.filter((e) => e.kind === s.kind).length}</span></a>)}
      </nav>
      <div className="spec-main">
        <div className="toolbar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show entries for">
            <option value="">All screens</option>{pins.length > 0 && <option value="pinned">Pinned screens</option>}
            {p.screens.map((s) => <option key={s.id} value={s.id}>Only {s.name}</option>)}
          </select>
          <span className="toolbar-space" />
          <Btn icon={<FileText />} aria-pressed={raw} className={raw ? "on" : undefined} onClick={() => setRaw((x) => !x)}>Markdown</Btn>
          <Btn variant="primary" ai icon={<Sparkles />} onClick={() => focusAsk(ask)}>Ask AI</Btn>
          <Menu className="btn" label="Add to the spec" align="end" button={<><Plus /><span>Add</span></>}>
            {(close) => SECTIONS.map((s) => <MenuItem key={s.kind} onClick={() => { close(); if (!may) return toast(WHY_NOT.spec); setAdding(s.kind); setRaw(false); window.setTimeout(() => scrollTo(`spec-${s.kind}`), 0); }}>{s.one}</MenuItem>)}
          </Menu>
        </div>
        <div className="spec-branch">
          <GitBranch /><span className="spec-branch-text">The spec on <code>{repo.current}</code>.
            {specEdits > 0 && <> {specEdits} {specEdits === 1 ? "edit is" : "edits are"} not committed yet. <Link to={`/p/${p.id}/history/changes`} className="link">Commit</Link></>}</span>
          {others.length > 0 && <select className="spec-vs" value={cmp} onChange={(e) => setCmp(e.target.value)} aria-label="Compare with another branch"><option value="">Compare with another branch</option>{others.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}</select>}
        </div>
        {diff && (
          <section className="spec-diff">
            <h3>{repo.current} compared with {cmp} <button type="button" className="btn ghost sm" onClick={() => setCmp("")}><X /> Close</button></h3>
            {!diff.onlyHere.length && !diff.onlyThere.length && !diff.changed.length && !diff.intro ? <p className="muted">The two branches have the same spec.</p> : (
              <ul className="diff">
                {diff.intro && <li><Chip tone="warn">Overview</Chip> The purpose or users differ.</li>}
                {diff.onlyThere.map((e) => <li key={`t${e.id}`}><Chip tone="ok">Only on {cmp}</Chip><b>{e.id}</b> {e.title}<p className="muted">{e.text}</p></li>)}
                {diff.onlyHere.map((e) => <li key={`h${e.id}`}><Chip>Only on {repo.current}</Chip><b>{e.id}</b> {e.title}<p className="muted">{e.text}</p></li>)}
                {diff.changed.map(({ here, there }) => <li key={`c${here.id}`}><Chip tone="warn">Different</Chip><b>{here.id}</b> {here.title}
                  {there.text === here.text ? <p className="muted">{here.status} here, {there.status} on {cmp}</p> : <div className="spec-cmp"><del>{here.text}</del><ins>{there.text}</ins></div>}</li>)}
              </ul>
            )}
          </section>
        )}
        {raw ? <pre className="spec-raw">{specMarkdown(p, spec)}</pre> : (
          <>
            {waiting.length > 0 && (
              <section id="spec-waiting" className="spec-sec waiting">
                <h2>Waiting for you <span className="num">{waiting.length}</span></h2>
                <ul className="entries">{waiting.map((e) => <EntryRow key={e.id} project={p} e={e} may={may} dirty={dirty.has(e.id)} onAsk={focusAsk} />)}</ul>
              </section>
            )}
            <section id="spec-intro" className="spec-intro">
              {introEdit ? (
                <form onSubmit={(e) => { e.preventDefault(); editIntro(p.id, { purpose: purpose.trim(), users: users.trim() }); setIntroEdit(false); }}>
                  <label className="field"><span>What it is for</span><textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
                  <label className="field"><span>Who uses it</span><textarea rows={2} value={users} onChange={(e) => setUsers(e.target.value)} /></label>
                  <div className="form-actions"><Btn type="submit" variant="primary" size="sm">Save</Btn><Btn size="sm" variant="ghost" ai icon={<Sparkles />} onClick={() => { setIntroEdit(false); focusAsk(`Change the overview: ${purpose.trim()}`); }}>Rewrite the overview with AI</Btn><Btn size="sm" variant="ghost" onClick={() => setIntroEdit(false)}>Cancel</Btn></div>
                </form>
              ) : (
                <>
                  <h2>What it is for</h2><p>{spec.purpose || <span className="muted">Not written yet.</span>}</p>
                  <h2>Who uses it</h2><p>{spec.users}</p>
                  <Btn size="sm" disabled={!may} why={WHY_NOT.spec} onClick={() => { setPurpose(spec.purpose); setUsers(spec.users); setIntroEdit(true); }}>Edit</Btn>
                </>
              )}
            </section>
            {SECTIONS.map((s) => {
              const list = shown.filter((e) => e.kind === s.kind && e.status === "agreed");
              return (
                <section key={s.kind} id={`spec-${s.kind}`} className="spec-sec">
                  <h2>{s.title} <span className="num">{list.length}</span>
                    <button type="button" className="btn ghost sm" onClick={() => (may ? setAdding(s.kind) : toast(WHY_NOT.spec))}><Plus /><span>Add</span></button></h2>
                  <p className="muted">{s.about}</p>
                  {adding === s.kind && <EntryForm project={p} kind={s.kind} onDone={() => setAdding(null)} />}
                  {list.length === 0 && adding !== s.kind ? <p className="spec-none">{filter ? "Nothing here for this screen." : `No ${s.title.toLowerCase()} written down yet.`}</p>
                    : <ul className="entries">{list.map((e) => <EntryRow key={e.id} project={p} e={e} may={may} dirty={dirty.has(e.id)} onAsk={focusAsk} />)}</ul>}
                </section>
              );
            })}
          </>
        )}
      </div>
      <aside className="spec-ask">
        <form className="ask-box" onSubmit={submitAsk}>
          <h2><Sparkles /> Ask AI to change the spec</h2>
          <textarea ref={askRef} rows={3} value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="Ask AI about the spec"
            placeholder="Say what should be true. AI finds the entries it touches, asks if something clashes, and shows the edits before anything changes."
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitAsk(); }} />
          <div className="ideas">{IDEAS.map((x) => <button key={x} type="button" className="idea" onClick={() => setAsk(x)}>{x}</button>)}</div>
          <Btn type="submit" variant="primary" ai icon={<Sparkles />} kbd="Ctrl Enter" disabled={!ask.trim() || !may} why={WHY_NOT.spec}>Ask</Btn>
        </form>
        {notes.length > 0 && <ul className="notes">{notes.map((n) => <NoteRow key={n.id} n={n} may={may} />)}</ul>}
      </aside>
    </div>
  );
}
