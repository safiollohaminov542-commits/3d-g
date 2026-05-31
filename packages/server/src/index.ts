import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { ROOM_NAME } from "@3dg/shared";
import { CityRoom } from "./rooms/CityRoom.js";

const PORT = Number.parseInt(process.env.PORT ?? "2567", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Colyseus monitor (basic dashboard at /colyseus). Protect behind auth in prod.
app.use("/colyseus", monitor());

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ROOM_NAME, CityRoom);

gameServer
  .listen(PORT, HOST)
  .then(() => {
    console.log(`[server] listening on ws://${HOST}:${PORT}`);
    console.log(`[server] monitor at  http://${HOST}:${PORT}/colyseus`);
  })
  .catch((err: unknown) => {
    console.error("[server] failed to listen", err);
    process.exit(1);
  });
