import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  // Relative asset paths, so the build works at a sub-path such as GitHub Pages' /mokio-clone/.
  // Routing uses the URL hash, so no server rewrites are needed.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
