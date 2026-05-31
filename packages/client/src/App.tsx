import { useEffect } from "react";
import { useGameStore } from "./store/gameStore";
import { attachKeyboard } from "./input/keyboard";
import { Lobby } from "./ui/Lobby";
import { HUD } from "./ui/HUD";
import { TouchControls } from "./ui/TouchControls";
import { GameScene } from "./scene/GameScene";

/**
 * Root application component. Decides which "screen" to render based on
 * the high-level game phase from the store:
 *
 *   menu       → Lobby (name + car select)
 *   connecting → Lobby with a transient "Connecting…" overlay
 *   playing    → R3F scene + HUD + (on touch devices) on-screen controls
 *   error      → Lobby with the error displayed
 */
export function App() {
  const phase = useGameStore((s) => s.phase);
  const room = useGameStore((s) => s.room);

  // Keyboard input is attached for the entire session — it does nothing
  // until a room is joined because input is only sent from <Player>.
  useEffect(() => {
    return attachKeyboard();
  }, []);

  return (
    <div className="relative h-full w-full">
      {phase === "playing" && room ? (
        <>
          <GameScene room={room} />
          <HUD room={room} />
          <TouchControls />
        </>
      ) : null}

      {phase !== "playing" ? <Lobby /> : null}

      {phase === "connecting" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur">
          <div className="rounded-lg border border-white/10 bg-black/70 px-6 py-4 text-sm text-white/80">
            Connecting to server…
          </div>
        </div>
      ) : null}
    </div>
  );
}
