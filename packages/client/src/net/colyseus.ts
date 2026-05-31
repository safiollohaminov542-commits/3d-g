import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME } from "@3dg/shared";

/**
 * Resolve the Colyseus WebSocket URL.
 *
 * Priority order:
 *   1. Explicit `VITE_SERVER_URL` build-time env var.
 *   2. Same host as the page over `ws(s)` on port 2567 (matches local dev
 *      and a typical reverse-proxy deployment where /colyseus is proxied).
 */
export function getServerUrl(): string {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl && envUrl.length > 0) return envUrl;

  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    return `${proto}//${host}:2567`;
  }
  return "ws://localhost:2567";
}

export interface JoinPayload {
  name: string;
  carId: string;
}

export async function joinCity(payload: JoinPayload): Promise<Room> {
  const client = new Client(getServerUrl());
  return client.joinOrCreate(ROOM_NAME, payload);
}
