import { useLayoutEffect, useRef, useState } from "react";
import { Pin, PinOff, Maximize2, MessageSquarePlus, Send, Check, Trash2, Crosshair, Sun, Moon, Monitor, Tablet, Smartphone, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, MousePointerClick } from "lucide-react";
import type { Comment, CommentKind, Project } from "../lib/types";
import { can, WHY_NOT } from "../lib/catalog";
import { cx, go, person, pinsOf, setPrefs, togglePin, toast, useData, useMe, usePrefs } from "../lib/store";
import { acceptReply, acceptRound, addComment, decide, editComment, removeComment, reopen, sendRound, setScreenStatus, useReviewBusy } from "../lib/actions";
import { Preview } from "../components/Preview";
import { Avatar, Btn, Chip, Glyph, Link, Menu, MenuItem, Seg, StatusChip, useKeys, useMode } from "../components/ui";
import { DEVICE_SIZE } from "./Project";

const KINDS: { value: CommentKind; label: string }[] = [{ value: "fix", label: "Fix" }, { value: "change", label: "Change" }, { value: "question", label: "Question" }];
const stateText = (c: Comment) => `${c.state.mode}, ${c.state.device}, as ${c.state.as.toLowerCase()}`;

function AskBox({ c, may }: { c: Comment; may: boolean }) {
  const [other, setOther] = useState("");
  return (
    <div className="decide">
      <div className="decide-opts">{c.ask!.options.map((o) => <Btn key={o} size="sm" disabled={!may} why={WHY_NOT.comment} onClick={() => decide(c.id, o)}>{o}</Btn>)}</div>
      <form className="field-row" onSubmit={(e) => { e.preventDefault(); if (other.trim()) decide(c.id, other.trim()); }}>
        <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Something else" aria-label="Another answer" />
        <Btn size="sm" type="submit" disabled={!other.trim()}>Answer</Btn>
      </form>
      <small className="muted">The answer is recorded as a decision in the spec.</small>
    </div>
  );
}

export function Review({ project: p, screenId, sent }: { project: Project; screenId?: string; sent: boolean }) {
  const d = useData(), me = useMe(), prefs = usePrefs(), appMode = useMode(), busy = useReviewBusy();
  const pins = pinsOf(prefs, p.id), focus = prefs.focus && pins.length > 0;
  const screens = focus ? p.screens.filter((s) => pins.includes(s.id)) : p.screens;
  const screen = p.screens.find((s) => s.id === screenId) ?? screens[0] ?? p.screens[0];
  const [mode, setMode] = useState<"light" | "dark">(appMode);
  const [device, setDevice] = useState<"desktop" | "tablet" | "phone">(prefs.device);
  const [as, setAs] = useState(p.roles[Math.min(2, p.roles.length - 1)] ?? "Member");
  const [picking, setPicking] = useState(false);
  const [draftAt, setDraftAt] = useState<{ el: string; label: string; x: number; y: number } | null>(null);
  const [text, setText] = useState(""), [kind, setKind] = useState<CommentKind>("change");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const canvas = useRef<HTMLDivElement>(null);
  const mayComment = can(me.role, "comment"), mayApprove = can(me.role, "approve"), maySend = can(me.role, "send");

  const mine = d.comments.filter((c) => c.projectId === p.id);
  const drafts = mine.filter((c) => c.status === "draft");
  const sentList = mine.filter((c) => c.status !== "draft");
  const here = [...drafts, ...sentList.filter((c) => c.status === "done" || c.status === "asking")].filter((c) => c.screenId === screen?.id);
  const number = new Map(drafts.map((c, i) => [c.id, i + 1]));
  const base = `/p/${p.id}/review`;
  const open = (id: string, s = sent) => go(`${base}/${id}${s ? "/sent" : ""}`);
  const idx = screen ? screens.findIndex((s) => s.id === screen.id) : -1;
  const step = (n: number) => { if (screens.length) open(screens[(idx + n + screens.length) % screens.length].id); };

  // Place a numbered pin on each commented element that this layout and device draw.
  const elKey = here.map((c) => c.el).join("|");
  useLayoutEffect(() => {
    const box = canvas.current?.querySelector(".pv") as HTMLElement | null;
    if (!box) return;
    const b = box.getBoundingClientRect(), next: Record<string, { x: number; y: number }> = {};
    for (const el of new Set(here.map((c) => c.el))) {
      const n = el === "screen" ? box : (box.querySelector(`[data-el="${CSS.escape(el)}"]`) as HTMLElement | null);
      if (!n) continue;
      const r = n.getBoundingClientRect();
      next[el] = { x: ((r.left - b.left + 8) / b.width) * 100, y: ((r.top - b.top + 8) / b.height) * 100 };
    }
    setPos(next);
  }, [elKey, screen?.id, device, p.nav, screen?.variant, mode]);

  const away = here.filter((c) => c.screenId === screen?.id && c.el !== "screen" && !pos[c.el]);
  const onCanvasClick = (e: React.MouseEvent) => {
    if (!picking) return;
    e.preventDefault();
    const box = canvas.current?.querySelector(".pv") as HTMLElement | null;
    const target = (e.target as HTMLElement).closest("[data-el]") as HTMLElement | null;
    if (!box) return;
    const b = box.getBoundingClientRect();
    setDraftAt({
      el: target?.dataset.el ?? "screen", label: target?.dataset.label ?? "Whole screen",
      x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100,
    });
    setText("");
  };
  const add = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draftAt || !text.trim() || !screen) return;
    addComment({ projectId: p.id, screenId: screen.id, el: draftAt.el, elLabel: draftAt.label, kind, author: me.id, state: { mode, device, as }, text: text.trim() });
    setDraftAt(null); setText(""); setPicking(false);
    if (sent) open(screen.id, false);
  };
  const approve = () => {
    if (!screen) return;
    if (!mayApprove) return toast(WHY_NOT.approve);
    setScreenStatus(p.id, screen.id, screen.status === "approved" ? "unreviewed" : "approved");
  };
  const pinned = !!screen && pins.includes(screen.id);
  useKeys({
    c: () => { setPicking((x) => !x); setDraftAt(null); },
    "[": () => step(-1), "]": () => step(1), a: approve,
    p: () => screen && toast(togglePin(p.id, screen.id) ? `${screen.name} pinned.` : `${screen.name} unpinned.`),
    f: () => screen && go(`/p/${p.id}/run/${screen.id}`),
    "mod+enter": () => void sendRound(p.id),
    escape: () => { setDraftAt(null); setPicking(false); },
  });
  if (!screen) return <div className="page"><p className="muted">No screens to review yet.</p></div>;

  const rounds = [...new Set(sentList.map((c) => c.round ?? 0))].sort((a, b) => b - a);
  const size = DEVICE_SIZE[device];
  return (
    <div className="review">
      <nav className="review-list" aria-label="Screens">
        {focus && <div className="focus-note"><Crosshair />{pins.length} pinned <button type="button" className="link" onClick={() => setPrefs({ focus: false })}>Show all</button></div>}
        {[...new Set(screens.map((s) => s.flow))].map((f) => (
          <div key={f}>
            <div className="side-label">{f}</div>
            {screens.filter((s) => s.flow === f).map((s) => {
              const n = drafts.filter((c) => c.screenId === s.id).length;
              return (
                <Link key={s.id} to={`${base}/${s.id}${sent ? "/sent" : ""}`} className={cx("rl-item", s.id === screen.id && "on")} aria-current={s.id === screen.id ? "page" : undefined}>
                  <i className={cx("dot", s.status)} /><span>{s.name}</span>{pins.includes(s.id) && <Pin className="rl-pin" />}{n > 0 && <span className="num">{n}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="review-main">
        <div className="review-bar">
          <select className="review-pick" value={screen.id} onChange={(e) => open(e.target.value)} aria-label="Screen">{screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <b>{screen.name}</b><StatusChip status={screen.status} />
          <span className="toolbar-space" />
          <Btn size="sm" icon={pinned ? <PinOff /> : <Pin />} className={pinned ? "on" : undefined} aria-pressed={pinned} aria-label={pinned ? "Unpin this screen" : "Pin this screen"} title={`${pinned ? "Unpin" : "Pin"} (P)`} onClick={() => toast(togglePin(p.id, screen.id) ? `${screen.name} pinned. It stays in Mokio's navigation.` : `${screen.name} unpinned.`)} />
          <Btn size="sm" icon={<Maximize2 />} aria-label="Open at full window size (F)" title="Open at full window size (F)" onClick={() => go(`/p/${p.id}/run/${screen.id}`)} />
          <Seg label="Preview theme" iconOnly value={mode} onChange={setMode} options={[{ value: "light", label: "Light", icon: <Sun /> }, { value: "dark", label: "Dark", icon: <Moon /> }]} />
          <Seg label="Preview device" iconOnly value={device} onChange={setDevice} options={[{ value: "desktop", label: "Desktop", icon: <Monitor /> }, { value: "tablet", label: "Tablet", icon: <Tablet /> }, { value: "phone", label: "Phone", icon: <Smartphone /> }]} />
          <Menu className="btn sm" label="Role the prototype is viewed as" align="end" button={<><span>As {as.toLowerCase()}</span><ChevronDown className="chev" /></>}>
            {(close) => p.roles.map((r) => <MenuItem key={r} on={r === as} onClick={() => { close(); setAs(r); }}>{r}</MenuItem>)}
          </Menu>
          <Btn size="sm" variant={picking ? "primary" : "default"} icon={<MessageSquarePlus />} kbd="C" aria-pressed={picking} disabled={!mayComment} why={WHY_NOT.comment} onClick={() => { setPicking((x) => !x); setDraftAt(null); }}>Comment</Btn>
        </div>

        <div className="canvas" ref={canvas} onClickCapture={onCanvasClick}>
          <div className={cx("canvas-box", device === "phone" && "phone")} style={{ width: device === "tablet" ? Math.min(size.w, 560) : undefined }}>
            <Preview project={p} screen={screen} ds={d.systems.find((s) => s.id === p.dsId)} mode={mode} device={device} picking={picking} />
            {here.map((c) => {
              const at = c.el === "screen" ? { x: 1, y: 1 } : pos[c.el];
              if (!at) return null;
              const n = number.get(c.id);
              return (
                <button key={c.id} type="button" className={cx("pin", c.status !== "draft" && "sent", focusId === c.id && "on")} title={`${c.elLabel}: ${c.text}`}
                  style={{ left: `clamp(1rem, ${at.x}%, calc(100% - 1rem))`, top: `max(1rem, ${at.y}%)` }} onClick={(e) => { e.stopPropagation(); setFocusId(c.id); }}>
                  {n ?? <Glyph size={12} />}
                </button>
              );
            })}
            {draftAt && (
              <>
                <span className="pin ghost" style={{ left: `clamp(1rem, ${draftAt.x}%, calc(100% - 1rem))`, top: `max(1rem, ${draftAt.y}%)` }}>+</span>
                <form className="composer" onSubmit={add} onClick={(e) => e.stopPropagation()}
                  style={{ left: `clamp(0rem, ${draftAt.x}%, calc(100% - 20rem))`, ...(draftAt.y > 60 ? { bottom: `calc(${100 - draftAt.y}% + .5rem)` } : { top: `calc(${draftAt.y}% + 2.25rem)` }) }}>
                  <div className="composer-head"><b>{draftAt.label}</b><small className="muted">{mode}, {device}, as {as.toLowerCase()}</small></div>
                  <textarea autoFocus rows={3} value={text} placeholder="What should change?" onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setDraftAt(null); else if (e.key === "Enter" && !e.shiftKey) add(e as unknown as React.FormEvent); }} />
                  <div className="composer-foot">
                    <Seg label="Kind of comment" value={kind} onChange={setKind} options={KINDS} />
                    <span className="toolbar-space" />
                    <Btn size="sm" variant="ghost" onClick={() => setDraftAt(null)}>Cancel</Btn>
                    <Btn size="sm" variant="primary" type="submit" disabled={!text.trim()}>Add</Btn>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
        {away.length > 0 && <p className="notice">{away.length} {away.length === 1 ? "comment is" : "comments are"} anchored to an element this layout or device does not show. They stay in the draft.</p>}
        <div className="review-foot">
          <Btn size="sm" variant="ghost" icon={<ChevronLeft />} aria-label="Previous screen ( [ )" onClick={() => step(-1)} />
          <span className="num muted">{idx + 1} / {screens.length}</span>
          <Btn size="sm" variant="ghost" icon={<ChevronRight />} aria-label="Next screen ( ] )" onClick={() => step(1)} />
          <Btn size="sm" variant="ghost" icon={<MousePointerClick />} disabled={!mayComment} onClick={() => { setDraftAt({ el: "screen", label: "Whole screen", x: 4, y: 4 }); setText(""); }}>Comment on the whole screen</Btn>
          {screen.mock > 0 && <span className="muted">{screen.mock} controls here only pretend</span>}
          <span className="toolbar-space" />
          <Btn variant={screen.status === "approved" ? "default" : "primary"} icon={<Check />} kbd="A" disabled={!mayApprove} why={WHY_NOT.approve} onClick={approve}>{screen.status === "approved" ? "Withdraw approval" : "Approve"}</Btn>
        </div>
      </div>

      <aside className="review-side">
        <Seg label="Comments" value={sent ? "sent" : "draft"} onChange={(v) => open(screen.id, v === "sent")} options={[{ value: "draft", label: `Draft ${drafts.length}` }, { value: "sent", label: `Sent ${sentList.length}` }]} />
        {sent ? (
          rounds.length === 0 ? <div className="side-empty"><h3>Nothing sent yet</h3><p>Rounds you send to Claude appear here with a reply for each comment and the files that changed.</p></div> : (
            <div className="rounds">{rounds.map((rn) => {
              const cs = sentList.filter((c) => (c.round ?? 0) === rn);
              const working = cs.filter((c) => c.status === "working" || c.status === "queued").length;
              const done = cs.filter((c) => c.status === "done").length;
              const files = new Set(cs.flatMap((c) => c.files ?? [])).size, asking = cs.filter((c) => c.status === "asking").length;
              return (
                <section key={rn} className="round">
                  <header>
                    <h3>Round {rn}</h3>
                    <small className="muted">{working ? `Claude is working, ${cs.length - working} of ${cs.length}` : `${cs.length} replies, ${files} files changed${asking ? `, ${asking} waiting for you` : ""}`}</small>
                    {done > 1 && !working && <Btn size="sm" disabled={!mayApprove} why={WHY_NOT.approve} onClick={() => acceptRound(p.id, rn)}>Accept all</Btn>}
                  </header>
                  <ul className="cmts">{cs.map((c) => (
                    <li key={c.id} className={cx("cmt", c.status)}>
                      <Avatar p={person(c.author)} size="sm" />
                      <div className="cmt-body">
                      <div className="cmt-head"><b>{c.elLabel}</b>
                        <Link to={`${base}/${c.screenId}/sent`} className="cmt-screen"><Crosshair />{p.screens.find((s) => s.id === c.screenId)?.name}</Link></div>
                      <p className="cmt-said">{c.text}</p>
                      {(c.status === "working" || c.status === "queued") && <p className="cmt-wait"><span className="spin" /> Claude is on it</p>}
                      {c.reply && <div className="reply"><Glyph size={16} /><div><p>{c.reply}</p>{c.files?.map((f) => <code key={f}>{f}</code>)}</div></div>}
                      {c.status === "asking" && c.ask && <AskBox c={c} may={mayComment} />}
                      {c.ask?.picked && <Chip tone="ok"><Check />{c.ask.picked}</Chip>}
                      {c.status === "done" && (
                        <div className="cmt-foot">
                          <Btn size="sm" icon={<Check />} disabled={!mayApprove} why={WHY_NOT.approve} onClick={() => acceptReply(c.id)}>Accept</Btn>
                          <Btn size="sm" variant="ghost" icon={<RotateCcw />} disabled={!mayComment} why={WHY_NOT.comment} onClick={() => { reopen(c.id); open(c.screenId, false); }}>Reopen</Btn>
                        </div>
                      )}
                      {c.status === "accepted" && <Chip tone="ok"><Check />Accepted</Chip>}
                      </div>
                    </li>
                  ))}</ul>
                </section>
              );
            })}</div>
          )
        ) : (
          <>
            {drafts.length === 0 ? (
              <div className="side-empty"><h3>The draft is empty</h3><p>Click any element in the preview to pin a comment to it. Comments collect here, across every screen, until you send them as one round.</p></div>
            ) : (
              <ul className="cmts">{drafts.map((c) => {
                const author = person(c.author), editable = c.author === me.id || maySend;
                return (
                  <li key={c.id} className={cx("cmt", focusId === c.id && "on", c.screenId !== screen.id && "away")} onClick={() => setFocusId(c.id)}>
                    <span className="pin static">{number.get(c.id)}</span>
                    <div className="cmt-body">
                      <div className="cmt-head"><b>{c.elLabel}</b>
                        {c.screenId !== screen.id && <Link to={`${base}/${c.screenId}`} className="cmt-screen"><Crosshair />{p.screens.find((s) => s.id === c.screenId)?.name}</Link>}</div>
                      <textarea className="cmt-text" rows={2} value={c.text} aria-label="Comment" readOnly={!editable} onChange={(e) => editComment(c.id, { text: e.target.value })} />
                      <div className="cmt-foot">
                        <Avatar p={author} size="sm" /><span className="cmt-state muted">{author.name.split(" ")[0]}, {stateText(c)}</span>
                        <select value={c.kind} aria-label="Kind of comment" disabled={!editable} onChange={(e) => editComment(c.id, { kind: e.target.value as CommentKind })}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
                        {editable && <button type="button" className="btn ghost sm icon-only" aria-label="Remove comment" onClick={() => removeComment(c.id)}><Trash2 /></button>}
                      </div>
                      {c.reopened && <Chip tone="warn">Reopened from round {c.round}</Chip>}
                    </div>
                  </li>
                );
              })}</ul>
            )}
            <div className="send">
              <Btn variant="primary" ai mock icon={<Send />} kbd="Ctrl Enter" busy={busy === p.id} disabled={!drafts.length || !maySend || !!busy} why={maySend ? undefined : WHY_NOT.send} onClick={() => void sendRound(p.id)}>
                {busy === p.id ? "Claude is on it" : `Send ${drafts.length || ""} to Claude`}
              </Btn>
              {!maySend && <small className="muted">{WHY_NOT.send}</small>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
