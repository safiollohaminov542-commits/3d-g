import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { ROOM_NAME } from "@3dg/shared";
import { CityRoom } from "./rooms/CityRoom.js";

const PORT = Number.parseInt(process.env.PORT ?? "2567", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve the location of the built client SPA, if it exists.
 *
 * Search order, first hit wins:
 *   1. CLIENT_DIST env var (explicit override).
 *   2. <repo>/packages/client/dist (when running from `dist/` after build).
 *   3. <repo>/packages/client/dist (when running from `src/` via tsx).
 */
function resolveClientDist(): string | null {
  const explicit = process.env.CLIENT_DIST;
  if (explicit && existsSync(resolve(explicit, "index.html"))) {
    return resolve(explicit);
  }

  const candidates = [
    // Running compiled JS from packages/server/dist/index.js
    resolve(__dirname, "../../client/dist"),
    // Running tsx from packages/server/src/index.ts
    resolve(__dirname, "../../client/dist"),
    // Running from repo root with custom layout
    resolve(process.cwd(), "packages/client/dist"),
  ];
  for (const c of candidates) {
    if (existsSync(resolve(c, "index.html"))) return c;
  }
  return null;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Colyseus monitor (basic dashboard at /colyseus). Protect behind auth in prod.
app.use("/colyseus", monitor());

// Serve the built client when available so a single port hosts the whole app.
const clientDist = resolveClientDist();
if (clientDist) {
  console.log(`[server] serving client from ${clientDist}`);
  app.use(express.static(clientDist));
  // SPA fallback: any non-API route returns index.html so client-side routing
  // (and direct deep links) work after a refresh.
  app.get(/^\/(?!health|colyseus|matchmake).*/, (_req, res) => {
    res.sendFile(resolve(clientDist, "index.html"));
  });
} else {
  // Helpful landing page when the client hasn't been built yet — explains
  // exactly what to do, instead of the bare "Cannot GET /" from Express.
  app.get("/", (_req, res) => {
    res.status(200).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>3D-G server is running</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px;
             margin: 40px auto; padding: 0 20px; color: #222;
             line-height: 1.5; }
      code, pre { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; }
      pre { padding: 12px; overflow: auto; }
      .ok { color: #047857; }
      .warn { color: #b45309; }
    </style>
  </head>
  <body>
    <h1>3D-G server <span class="ok">is running</span></h1>
    <p class="warn">
      The client has not been built yet, so there's nothing to serve at
      <code>/</code>. The Colyseus game server itself is healthy.
    </p>

    <h2>Run in development</h2>
    <p>From the repo root, in two terminals:</p>
    <pre>pnpm dev:server   # this server (port ${PORT})
pnpm dev:client   # Vite dev server (port 5173)</pre>
    <p>Then open <code>http://your-server-ip:5173/</code> in the browser.</p>

    <h2>Run as a single service (production)</h2>
    <p>Build the client once, then this server will serve it from <code>/</code>:</p>
    <pre>pnpm build
pnpm start:server</pre>
    <p>Or, after building, restart your PM2 process:</p>
    <pre>pm2 restart 3dg-server</pre>

    <h2>Endpoints already available</h2>
    <ul>
      <li><a href="/health">/health</a> &mdash; JSON health probe</li>
      <li><a href="/colyseus">/colyseus</a> &mdash; Colyseus monitor dashboard</li>
      <li><code>ws://&lt;host&gt;:${PORT}</code> &mdash; WebSocket transport for game clients</li>
    </ul>
  </body>
</html>`);
  });
}

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ROOM_NAME, CityRoom);

gameServer
  .listen(PORT, HOST)
  .then(() => {
    console.log(`[server] listening on http://${HOST}:${PORT}`);
    if (clientDist) {
      console.log(`[server] open    http://${HOST}:${PORT}/  (client served)`);
    } else {
      console.log(`[server] landing http://${HOST}:${PORT}/  (build client to serve from here)`);
    }
    console.log(`[server] monitor http://${HOST}:${PORT}/colyseus`);
    console.log(`[server] health  http://${HOST}:${PORT}/health`);
  })
  .catch((err: unknown) => {
    console.error("[server] failed to listen", err);
    process.exit(1);
  });
