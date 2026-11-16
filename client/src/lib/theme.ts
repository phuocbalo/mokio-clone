// OKLCH token generator: six controls make all ten tokens for light and dark.
import type { DesignSystem } from "./types";

const D = Math.PI / 180;
function oklchToLinear(L: number, C: number, h: number) {
  const a = C * Math.cos(h * D), b = C * Math.sin(h * D);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const toHex = (rgb: number[]) =>
  "#" + rgb.map((v) => Math.round(clamp(gamma(clamp(v))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Nearest in-gamut sRGB colour for an OKLCH value, reducing chroma until it fits. */
export function oklch(L: number, C: number, h: number) {
  let c = C;
  for (let i = 0; i < 48; i++) {
    const rgb = oklchToLinear(L, c, h);
    if (rgb.every((v) => v >= -5e-4 && v <= 1.0005)) return toHex(rgb);
    c *= 0.93;
  }
  return toHex(oklchToLinear(L, 0, h));
}

function hexRgb(hex: string) {
  const t = hex.replace("#", "");
  const n = t.length === 3 ? t.split("").map((c) => c + c).join("") : t;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
function luminance(hex: string) {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const TOKENS = [
  { key: "bg", css: "--bg", role: "Page background" },
  { key: "surface", css: "--surface", role: "Cards and panels" },
  { key: "sunken", css: "--sunken", role: "Wells and inputs" },
  { key: "line", css: "--line", role: "Borders and dividers" },
  { key: "ink", css: "--ink", role: "Main text", text: "surface" },
  { key: "muted", css: "--muted", role: "Secondary text", text: "surface" },
  { key: "accent", css: "--accent", role: "Primary actions, selection", text: "surface" },
  { key: "accentInk", css: "--accent-ink", role: "Text on accent", text: "accent" },
  { key: "accentSoft", css: "--accent-soft", role: "Selected rows, soft fills" },
  { key: "accentLine", css: "--accent-line", role: "Accent borders" },
] as const;
export type TokenKey = (typeof TOKENS)[number]["key"];
export type Tokens = Record<TokenKey, string>;
export const NEUTRAL_KEYS: TokenKey[] = ["bg", "surface", "sunken", "line", "ink", "muted"];
export const ACCENT_KEYS: TokenKey[] = ["accent", "accentInk", "accentSoft", "accentLine"];

export function tokens(ds: DesignSystem, mode: "light" | "dark", hue?: number): Tokens {
  const h = hue ?? ds.accentHue, C = ds.accentChroma, nh = ds.neutralHue, nc = ds.neutralChroma, k = ds.contrast;
  const t: Tokens =
    mode === "light"
      ? {
          bg: oklch(0.968, nc, nh), surface: oklch(1, 0, nh), sunken: oklch(0.945, nc * 1.25, nh),
          line: oklch(0.905 - k * 0.04, nc * 1.3, nh), ink: oklch(0.24 - k * 0.06, Math.min(0.045, nc * 3), nh),
          muted: oklch(0.52 - k * 0.09, Math.min(0.04, nc * 2.4), nh), accent: oklch(ds.accentL - k * 0.04, C, h),
          accentInk: "#FFFFFF", accentSoft: oklch(0.945, C * 0.2, h), accentLine: oklch(0.86, C * 0.36, h),
        }
      : {
          bg: oklch(0.185, nc * 1.3, nh), surface: oklch(0.235, nc * 1.5, nh), sunken: oklch(0.165, nc * 1.3, nh),
          line: oklch(0.315 + k * 0.04, nc * 2, nh), ink: oklch(0.935, nc * 0.9, nh), muted: oklch(0.7 + k * 0.07, nc * 2, nh),
          accent: oklch(Math.max(0.72, ds.accentL) + k * 0.03, C * 0.72, h), accentInk: oklch(0.2, 0.05, h),
          accentSoft: oklch(0.3, C * 0.36, h), accentLine: oklch(0.43, C * 0.45, h),
        };
  if (contrast(t.accent, t.accentInk) < 4.5) {
    const dark = oklch(0.2, 0.05, h);
    t.accentInk = contrast(t.accent, dark) > contrast(t.accent, "#FFFFFF") ? dark : "#FFFFFF";
  }
  return hue == null ? { ...t, ...(ds.pins[mode] as Partial<Tokens>) } : t;
}

const STATUS: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "--ok": "#1C7C54", "--ok-bg": "#DDF3E8", "--warn": "#9A6212", "--warn-bg": "#FBEFD5", "--bad": "#B8344A", "--bad-bg": "#FBE3E7",
    "--c0-bg": "#E1E2FB", "--c0-fg": "#3A3DB0", "--c1-bg": "#D4F1EA", "--c1-fg": "#17695A", "--c2-bg": "#FBE9C9", "--c2-fg": "#845411",
    "--c3-bg": "#FADDE3", "--c3-fg": "#A02E45", "--c4-bg": "#E4E8D3", "--c4-fg": "#516025",
  },
  dark: {
    "--ok": "#5DD3A0", "--ok-bg": "#163428", "--warn": "#E8B45C", "--warn-bg": "#3A2D12", "--bad": "#F08196", "--bad-bg": "#3E1D26",
    "--c0-bg": "#2A2B5E", "--c0-fg": "#B9BBFA", "--c1-bg": "#163A33", "--c1-fg": "#8ADBC8", "--c2-bg": "#443214", "--c2-fg": "#F0C47A",
    "--c3-bg": "#4A2230", "--c3-fg": "#F4A3B4", "--c4-bg": "#2E3519", "--c4-fg": "#C2D27F",
  },
};
const font = (f: string, fb: string) => `"${f}", ${fb}`;

/** CSS variables for a preview or the whole app. */
export function cssVars(ds: DesignSystem, mode: "light" | "dark", hue?: number): Record<string, string> {
  const t = tokens(ds, mode, hue);
  const v: Record<string, string> = { ...STATUS[mode] };
  for (const { key, css } of TOKENS) v[css] = t[key];
  v["--r"] = `${ds.radius}px`;
  v["--pv-sans"] = font(ds.sans, `"Segoe UI", system-ui, sans-serif`);
  v["--pv-display"] = font(ds.display, `"Segoe UI", system-ui, sans-serif`);
  v["--pv-mono"] = font(ds.mono, "ui-monospace, Consolas, monospace");
  v["--pv-pad"] = ds.density === "compact" ? "10px" : "14px";
  v.colorScheme = mode;
  return v;
}

export function tokensCss(ds: DesignSystem) {
  const line = (m: "light" | "dark") => TOKENS.map(({ key, css }) => `${css}:${tokens(ds, m)[key]};`).join(" ");
  const dark = line("dark");
  return [
    `/* ${ds.name} design tokens. Light is the default; dark follows the device, or [data-theme=dark]. */`,
    ":root{", `  ${line("light")}`,
    `  --radius:${ds.radius}px; --sans:${font(ds.sans, "system-ui, sans-serif")}; --mono:${font(ds.mono, "ui-monospace, monospace")};`,
    "}",
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){`, `  ${dark} color-scheme:dark}}`,
    `:root[data-theme="dark"]{`, `  ${dark} color-scheme:dark}`,
    ...ds.themes.map((t) => {
      const x = tokens(ds, "light", t.hue);
      return `:root[data-accent="${t.name.toLowerCase()}"]{ --accent:${x.accent}; --accent-soft:${x.accentSoft}; --accent-line:${x.accentLine}; }`;
    }),
  ].join("\n");
}
