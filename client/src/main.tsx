import { createRoot } from "react-dom/client";
import "./styles/mokio.css";
import "./styles/extra.css";
import { App } from "./App";
import { boot } from "./lib/api";
import { setPrefs, ZOOMS } from "./lib/store";

// A copied link can carry display state: #/p/tazko?theme=dark&device=phone&scenario=mid
(function readStateFromLink() {
  const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const patch: Record<string, unknown> = {};
  const theme = q.get("theme"), device = q.get("device"), density = q.get("density"), zoom = Number(q.get("zoom")), scenario = q.get("scenario");
  if (theme === "light" || theme === "dark" || theme === "system") patch.theme = theme;
  if (device === "desktop" || device === "tablet" || device === "phone") patch.device = device;
  if (density === "cozy" || density === "compact") patch.density = density;
  if (ZOOMS.includes(zoom)) patch.zoom = zoom;
  if (scenario) patch.scenario = scenario;
  if (q.get("zen") === "1") patch.zen = true;
  if (Object.keys(patch).length) setPrefs(patch);
})();

void boot();
createRoot(document.getElementById("root")!).render(<App />);
