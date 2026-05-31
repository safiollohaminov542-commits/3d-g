import { useEffect, useState } from "react";
import { MessageType } from "@3dg/shared";
import type { Room } from "@colyseus/sdk";
import { useGameStore } from "../store/gameStore";
import type { PlayerState } from "../net/playerSchemaTypes";

interface HUDProps {
  room: Room;
}

/**
 * Heads-up display: speedometer + player count + leave button.
 *
 * Re-renders at ~10 Hz so we don't tax the main thread; the underlying
 * state updates much faster but the speed digit doesn't need to.
 */
export function HUD({ room }: HUDProps) {
  const sessionId = useGameStore((s) => s.sessionId);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [count, setCount] = useState(1);

  useEffect(() => {
    let raf = 0;
    let last = 0;

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 100) return;
      last = t;

      const stateAny = room.state as unknown as {
        players: { get: (id: string) => PlayerState | undefined; size: number };
      };
      const me = sessionId ? stateAny.players.get(sessionId) : null;
      if (me) {
        const v = Math.hypot(me.vx, me.vz);
        setSpeedKmh(Math.round(v * 3.6));
      }
      setCount(stateAny.players.size);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [room, sessionId]);

  const handleReset = () => {
    room.send(MessageType.Reset);
  };
  const handleLeave = () => {
    room.leave();
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Top bar */}
      <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleLeave}
          className="rounded-md border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur hover:bg-black/70"
        >
          Leave
        </button>
        <div className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 backdrop-blur">
          Players: <span className="font-semibold text-white">{count}</span>
        </div>
      </div>

      {/* Speedometer */}
      <div className="absolute right-4 top-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-right backdrop-blur">
        <div className="text-[10px] uppercase tracking-widest text-white/50">
          Speed
        </div>
        <div className="font-mono text-3xl font-bold leading-none">
          {speedKmh}
          <span className="ml-1 text-xs text-white/50">km/h</span>
        </div>
      </div>

      {/* Reset button */}
      <button
        type="button"
        onClick={handleReset}
        className="pointer-events-auto absolute right-4 top-24 rounded-md border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-black/60"
      >
        Reset (R)
      </button>
    </div>
  );
}
