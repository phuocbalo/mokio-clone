import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Sun, Moon, Monitor, Tablet, Smartphone, Pin, PinOff, Maximize, MessageSquarePlus, EyeOff, Eye, ChevronDown } from "lucide-react";
import { go, pinsOf, togglePin, toast, useData, usePrefs } from "../lib/store";
import { Preview } from "../components/Preview";
import { Btn, Empty, Kbd, Link, Menu, MenuItem, Seg, StatusChip, useKeys, useMode } from "../components/ui";
import { DEVICE_SIZE } from "./Project";

/** One screen at full window size, with Mokio out of the way. */
export function Run({ parts }: { parts: string[] }) {
  const d = useData(), prefs = usePrefs(), appMode = useMode();
  const p = d.projects.find((x) => x.id === parts[1]);
  const [mode, setMode] = useState<"light" | "dark">(appMode), [device, setDevice] = useState(prefs.device);
  const [bar, setBar] = useState(true);
  const pins = p ? pinsOf(prefs, p.id) : [];
  const screens = p ? (prefs.focus && pins.length ? p.screens.filter((s) => pins.includes(s.id)) : p.screens) : [];
  const s = screens.find((x) => x.id === parts[3]) ?? screens[0];
  const [as, setAs] = useState(p?.roles[0] ?? "Member");
  const i = s ? screens.indexOf(s) : 0;
  const step = (n: number) => p && screens.length && go(`/p/${p.id}/run/${screens[(i + n + screens.length) % screens.length].id}`);
  const full = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => toast("This window cannot take over the display here. Press F11 instead."));
  };
  const back = () => p && go(`/p/${p.id}/review/${s?.id ?? ""}`);
  useKeys({ "[": () => step(-1), "]": () => step(1), l: () => setMode((m) => (m === "light" ? "dark" : "light")), h: () => setBar((b) => !b), f: full, escape: back });
  if (!p || !s) return (
    <div className="page"><Empty title="No screen to show yet" action={<Link to={p ? `/p/${p.id}` : "/projects"} className="btn">Back to the screen map</Link>}>{p?.drafting ? "Claude is still drafting this prototype." : "This prototype has no screens yet."}</Empty></div>
  );
  const pinned = pins.includes(s.id), size = DEVICE_SIZE[device];
  return (
    <div className="run">
      {bar && (
        <header className="run-bar">
          <Btn size="sm" variant="ghost" icon={<ArrowLeft />} onClick={back} title="Back to review (Esc)"><span className="bar-wide">Review</span></Btn>
          <Btn size="sm" variant="ghost" icon={<ChevronLeft />} aria-label="Previous screen" onClick={() => step(-1)} />
          <select className="run-pick" value={s.id} aria-label="Screen" onChange={(e) => go(`/p/${p.id}/run/${e.target.value}`)}>{screens.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <Btn size="sm" variant="ghost" icon={<ChevronRight />} aria-label="Next screen" onClick={() => step(1)} />
          <span className="run-count num bar-wide">{i + 1} of {screens.length}{prefs.focus && pins.length ? " pinned" : ""}</span>
          <StatusChip status={s.status} />
          <span className="toolbar-space" />
          <Seg className="bar-seg" label="Theme" iconOnly value={mode} onChange={setMode} options={[{ value: "light", label: "Light", icon: <Sun /> }, { value: "dark", label: "Dark", icon: <Moon /> }]} />
          <Seg className="bar-seg" label="Device" iconOnly value={device} onChange={setDevice} options={[{ value: "desktop", label: "Desktop", icon: <Monitor /> }, { value: "tablet", label: "Tablet", icon: <Tablet /> }, { value: "phone", label: "Phone", icon: <Smartphone /> }]} />
          <Menu className="btn sm" label="Role the prototype is viewed as" align="end" button={<><span>As {as.toLowerCase()}</span><ChevronDown className="chev" /></>}>
            {(close) => p.roles.map((r) => <MenuItem key={r} on={r === as} onClick={() => { close(); setAs(r); }}>{r}</MenuItem>)}
          </Menu>
          <Btn size="sm" variant="ghost" icon={pinned ? <PinOff /> : <Pin />} aria-pressed={pinned} aria-label={pinned ? "Unpin" : "Pin"} onClick={() => toast(togglePin(p.id, s.id) ? `${s.name} pinned.` : `${s.name} unpinned.`)} />
          <Btn size="sm" variant="ghost" icon={<MessageSquarePlus />} aria-label="Comment on this screen (C)" title="Comment on this screen (C)" onClick={() => go(`/p/${p.id}/review/${s.id}`)} />
          <Btn size="sm" variant="ghost" icon={<Maximize />} aria-label="Take over the whole display (F)" title="Take over the whole display (F)" onClick={full} />
          <Btn size="sm" variant="ghost" icon={<EyeOff />} aria-label="Hide this bar (H)" title="Hide this bar (H)" onClick={() => setBar(false)} />
        </header>
      )}
      <div className={`run-stage ${device}`}>
        {/* Fit the screen to the window height as well as its width. */}
        <div className="run-fit" style={{ maxWidth: `calc((100vh - ${bar ? 64 : 16}px) * ${size.w / size.h})`, margin: "0 auto" }}>
          <Preview project={p} screen={s} ds={d.systems.find((x) => x.id === p.dsId)} mode={mode} device={device} className="run-pv" />
        </div>
      </div>
      {!bar && <button type="button" className="btn sm zen-exit" onClick={() => setBar(true)}><Eye />{s.name}<Kbd k="H" /></button>}
    </div>
  );
}
