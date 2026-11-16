import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { cx, go, toast, useAi, usePrefs } from "../lib/store";
import type { Person, ScreenStatus, DesignSystem } from "../lib/types";
import { tokens } from "../lib/theme";

export function Link({ to, children, ...rest }: { to: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a {...rest} href={`#${to}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); rest.onClick?.(e); go(to); }}>
      {children}
    </a>
  );
}

export function Kbd({ k }: { k: string }) {
  const { hints } = usePrefs();
  if (!hints) return null;
  return <span className="kbds" aria-hidden="true">{k.split(" ").map((x, i) => <kbd key={i}>{x}</kbd>)}</span>;
}

type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  variant?: "default" | "primary" | "ghost" | "danger"; size?: "md" | "sm"; icon?: ReactNode; kbd?: string;
  mock?: boolean; busy?: boolean; why?: string; ai?: boolean; onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
};
/** A button. `why` explains a disabled state on click; `ai` turns it off with a reason when Claude Code is unavailable. */
export function Btn({ variant = "default", size = "md", icon, kbd, mock, busy, disabled, why, ai, className, children, onClick, ...rest }: BtnProps) {
  const s = useAi();
  const aiOff = !!ai && !s.on;
  const explain = (!!disabled && !!why) || aiOff;
  return (
    <button
      type="button" {...rest}
      className={cx("btn", variant, size, children == null && "icon-only", busy && "busy", className)}
      data-mock={mock || undefined} data-ai-off={aiOff || undefined} title={aiOff ? s.why : rest.title}
      disabled={(disabled && !explain) || busy} aria-disabled={explain || undefined}
      onClick={explain ? (e) => { e.preventDefault(); aiOff ? toast(s.why, { go: { label: "Open Settings", path: "/settings" } }) : toast(why!); } : onClick}
    >
      {icon}
      {children != null && <span>{children}</span>}
      {kbd && <Kbd k={kbd} />}
    </button>
  );
}

export function Seg<T extends string>(p: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[]; iconOnly?: boolean; className?: string }) {
  return (
    <div className={cx("seg", p.className)} role="radiogroup" aria-label={p.label}>
      {p.options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === p.value} className={cx(o.value === p.value && "on")} title={p.iconOnly ? o.label : undefined} onClick={() => p.onChange(o.value)}>
          {o.icon}<span className={cx(p.iconOnly && "sr")}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Menu(p: { button: ReactNode; label: string; className?: string; align?: "start" | "end"; wide?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !btn.current || !box.current) return;
    const r = btn.current.getBoundingClientRect(), w = box.current.offsetWidth, h = box.current.offsetHeight;
    let left = p.align === "end" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ top, left });
  }, [open, p.align]);
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const down = (e: globalThis.MouseEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !btn.current?.contains(t)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const resize = () => setOpen(false);
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key); window.addEventListener("resize", resize);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); window.removeEventListener("resize", resize); };
  }, [open]);
  return (
    <>
      <button ref={btn} type="button" className={p.className} aria-haspopup="true" aria-expanded={open} aria-label={p.label} title={p.label} onClick={() => setOpen((o) => !o)}>{p.button}</button>
      {open && createPortal(
        <div ref={box} className={cx("menu", p.wide && "wide")} style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}>
          {p.children(() => setOpen(false))}
        </div>, document.body)}
    </>
  );
}

export function MenuItem(p: { on?: boolean; danger?: boolean; icon?: ReactNode; hint?: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={cx("menu-item", p.on && "on", p.danger && "danger")} onClick={p.onClick}>
      {p.icon}<span className="menu-text">{p.children}</span>{p.hint && <span className="menu-hint">{p.hint}</span>}
    </button>
  );
}

export const Avatar = ({ p, size }: { p: Pick<Person, "tone" | "initials" | "id">; size?: "sm" | "lg" }) =>
  <span className={cx("avatar", `tone${p.tone}`, size, p.id === "claude" && "claude")}>{p.initials}</span>;

export const Chip = ({ tone, children, title }: { tone?: string; children: ReactNode; title?: string }) =>
  <span className={cx("chip", tone)} title={title}>{children}</span>;

const STATUS: Record<ScreenStatus, { label: string; tone?: string }> = {
  approved: { label: "Approved", tone: "ok" }, changes: { label: "Changes asked", tone: "warn" }, unreviewed: { label: "Not reviewed" },
};
export const statusLabel = (s: ScreenStatus) => STATUS[s].label;
export const StatusChip = ({ status }: { status: ScreenStatus }) =>
  <Chip tone={STATUS[status].tone}><i className={cx("dot", status)} />{STATUS[status].label}</Chip>;

export function Dialog(p: { open: boolean; onClose: () => void; label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) { try { d.showModal(); } catch { d.setAttribute("open", ""); } }
    else if (!p.open && d.open) d.close();
  }, [p.open]);
  return (
    <dialog ref={ref} className={cx("dialog", p.className)} aria-label={p.label} onClose={p.onClose} onClick={(e) => { if (e.target === ref.current) p.onClose(); }}>
      {p.open && p.children}
    </dialog>
  );
}

export function Glyph({ size = 20 }: { size?: number }) {
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="6.5" width="11.5" height="11.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" opacity=".45" />
      <rect x="6.5" y="2" width="11.5" height="11.5" rx="3" fill="var(--accent)" />
    </svg>
  );
}

export const Empty = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) =>
  <div className="empty"><h2>{title}</h2><p>{children}</p>{action}</div>;

export function AiHint({ onClick, label = "Do this with AI" }: { onClick: () => void; label?: string }) {
  const s = useAi();
  if (!s.on) return null;
  return (
    <button type="button" className="ai-hint" title={label} aria-label={label} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}>
      <Sparkles /><span>AI</span>
    </button>
  );
}

export function SysDot({ ds }: { ds?: DesignSystem }) {
  const mode = useMode();
  return <i className="sysdot" style={{ background: ds ? tokens(ds, mode).accent : "var(--line)" }} />;
}

/** The app's resolved light or dark mode. */
export function useMode(): "light" | "dark" {
  const { theme } = usePrefs();
  const [dark, setDark] = useState(() => { try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } });
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => setDark(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return theme === "system" ? (dark ? "dark" : "light") : theme;
}

// Keyboard shortcut layers: the newest mounted handler for a key wins.
type Keys = Record<string, () => void>;
const layers: { current: Keys }[] = [];
export function useKeys(keys: Keys) {
  useEffect(() => {
    const ref = { current: keys };
    layers.push(ref);
    return () => { const i = layers.indexOf(ref); if (i >= 0) layers.splice(i, 1); };
  });
}
export function fireKey(k: string) {
  for (let i = layers.length - 1; i >= 0; i--) { const f = layers[i].current[k]; if (f) { f(); return true; } }
  return false;
}
