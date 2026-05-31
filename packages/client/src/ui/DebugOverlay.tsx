import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import type { PlayerState } from "../net/playerSchemaTypes";
import { useGameStore } from "../store/gameStore";

interface Snapshot {
  connection: "connected" | "closed" | "unknown";
  roomId: string;
  sessionId: string;
  totalPlayers: number;
  meFound: boolean;
  myPos: string;
  myCar: string;
  fps: number;
  webglOK: boolean;
  webglError: string | null;
  buildTime: string;
}

/**
 * In-game diagnostic panel. Toggled with `?` (Shift+/) on desktop and a
 * tap on the bottom-right corner on touch devices. Designed to surface
 * the most common "I see a black screen" causes without forcing the user
 * to dig through DevTools:
 *
 *   - Was the WebSocket actually established?
 *   - Did the server send my PlayerState back?
 *   - Where in the world am I according to the server?
 *   - Is WebGL initialised and producing frames?
 *
 * Everything is read on a 0.5 s timer so the overlay itself contributes
 * negligible work to the render loop.
 */
export function DebugOverlay({ room }: { room: Room }) {
  const sessionId = useGameStore((s) => s.sessionId);
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(() => ({
    connection: "unknown",
    roomId: room.roomId ?? "?",
    sessionId: sessionId ?? "?",
    totalPlayers: 0,
    meFound: false,
    myPos: "?",
    myCar: "?",
    fps: 0,
    webglOK: detectWebGL().ok,
    webglError: detectWebGL().error,
    buildTime: __BUILD_TIME__,
  }));

  // FPS counter, sampled separately from the snapshot tick so it stays
  // smooth even when the panel itself is closed.
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        const fps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
        setSnap((s) => ({ ...s, fps }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Snapshot of room state every 0.5 s.
  useEffect(() => {
    const id = window.setInterval(() => {
      const players = (
        room.state as unknown as
          | {
              players?: {
                size: number;
                get: (id: string) => PlayerState | undefined;
              };
            }
          | undefined
      )?.players;
      const me = players && sessionId ? players.get(sessionId) : undefined;
      const conn = (room.connection as { isOpen?: boolean })?.isOpen
        ? "connected"
        : "closed";
      setSnap((s) => ({
        ...s,
        connection: conn,
        roomId: room.roomId ?? "?",
        sessionId: sessionId ?? "?",
        totalPlayers: players?.size ?? 0,
        meFound: !!me,
        myPos: me ? `(${me.x.toFixed(1)}, ${me.z.toFixed(1)})` : "—",
        myCar: me ? me.carId : "—",
      }));
    }, 500);
    return () => window.clearInterval(id);
  }, [room, sessionId]);

  // Keyboard toggle: Shift + / produces "?".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?") setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Always-visible toggle button (also reachable on phones) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur"
        style={{ zIndex: 50 }}
      >
        {open ? "Close debug" : "Debug"}
      </button>

      {open ? (
        <div
          className="pointer-events-auto absolute left-3 top-12 max-w-[320px] rounded-md border border-white/15 bg-black/75 p-3 font-mono text-[11px] leading-5 text-white/90 backdrop-blur"
          style={{ zIndex: 50 }}
        >
          <Row k="WebGL" v={snap.webglOK ? "OK" : `FAIL: ${snap.webglError}`} ok={snap.webglOK} />
          <Row k="WebSocket" v={snap.connection} ok={snap.connection === "connected"} />
          <Row k="Room ID" v={snap.roomId} />
          <Row k="My session" v={snap.sessionId.slice(0, 8) + "…"} />
          <Row k="Players in room" v={String(snap.totalPlayers)} ok={snap.totalPlayers > 0} />
          <Row k="My state on server" v={snap.meFound ? "yes" : "NO"} ok={snap.meFound} />
          <Row k="My position" v={snap.myPos} />
          <Row k="My car" v={snap.myCar} />
          <Row k="FPS" v={String(snap.fps)} ok={snap.fps > 15} />
          <Row k="Build" v={snap.buildTime} />
          <p className="mt-2 text-[10px] text-white/50">
            Press <code>?</code> to toggle. If WebSocket is "closed", check
            that the server is reachable and that mixed-content (https
            page → ws server) is not blocked.
          </p>
        </div>
      ) : null}
    </>
  );
}

function Row({
  k,
  v,
  ok,
}: {
  k: string;
  v: string;
  ok?: boolean;
}) {
  const color =
    ok === undefined ? "text-white" : ok ? "text-emerald-400" : "text-red-400";
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/60">{k}</span>
      <span className={color}>{v}</span>
    </div>
  );
}

function detectWebGL(): { ok: boolean; error: string | null } {
  if (typeof document === "undefined") return { ok: false, error: "no DOM" };
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return { ok: false, error: "WebGL not supported" };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

declare const __BUILD_TIME__: string;
