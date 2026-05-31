import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Client dev server. The Colyseus backend is expected to run separately
// (see `pnpm dev:server`); the URL is configured via VITE_SERVER_URL.
export default defineConfig({
  plugins: [react()],
  define: {
    // Surfaced in the in-game debug overlay so we can tell whether a user
    // is on a freshly-deployed build or a stale cached one.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
