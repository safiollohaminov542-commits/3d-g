import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME } from "@3dg/shared";

/**
 * Resolve the Colyseus WebSocket URL.
 *
 * Priority order:
 *   1. Explicit `VITE_SERVER_URL` build-time env var (highest priority,
 *      use this when the client is served from a different host/port than
 *      the server, or behind a reverse proxy with a custom path).
 *   2. Same origin as the page when running on a non-Vite port — i.e. the
 *      page was served by the Colyseus server itself in production. We
 *      reuse the page's host + port and just swap http(s) for ws(s).
 *   3. Vite dev server (default port 5173) → assume the Colyseus server
 *      runs alongside it on port 2567 of the same host.
 *   4. Fallback for non-browser environments: localhost:2567.
 */
export function getServerUrl(): string {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl && envUrl.length > 0) return envUrl;

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const wsProto = protocol === "https:" ? "wss:" : "ws:";

    // Vite dev server runs on its own port; the game server is separate.
    const isViteDev = port === "5173";
    const targetPort = isViteDev ? "2567" : port;

    return targetPort
      ? `${wsProto}//${hostname}:${targetPort}`
      : `${wsProto}//${hostname}`;
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
