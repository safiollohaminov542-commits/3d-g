import { Canvas } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
} from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Room } from "@colyseus/sdk";
import { useGameStore } from "../store/gameStore";
import type { PlayerState } from "../net/playerSchemaTypes";
import { CameraRig } from "./CameraRig";
import { City } from "./City";
import { Lighting } from "./Lighting";
import { Player } from "./Player";
import { RemotePlayer } from "./RemotePlayer";

/**
 * Top-level R3F scene.
 *
 * Subscribes to the Colyseus room state for membership changes (joins +
 * leaves) and re-renders the player list. Per-player position/rotation
 * mutations happen directly on the same JS objects that Colyseus delivers,
 * so `<Player>` and `<RemotePlayer>` can read the latest values inside
 * `useFrame` without React's reconciliation getting in the way.
 *
 * We deliberately use `room.onStateChange` (which fires after each patch)
 * instead of per-instance `onAdd` / `onRemove` callbacks — it's simpler and
 * the membership only changes when someone joins or leaves, so the cost of
 * a `Map` rebuild on every patch is negligible (membership is checked by
 * size; identical sets short-circuit the React state update).
 */
export function GameScene({ room }: { room: Room }) {
  const sessionId = useGameStore((s) => s.sessionId);
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());

  // Mobile detection drives a few tradeoffs (smaller shadow map, no post-
  // processing) so weaker devices don't stall on the very first frame.
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    if ("ontouchstart" in window) return true;
    const mt = (navigator as Navigator & { maxTouchPoints?: number })
      .maxTouchPoints;
    return typeof mt === "number" && mt > 1;
  }, []);

  useEffect(() => {
    let lastSize = -1;
    let lastIds = "";

    /**
     * Safely read the players map off the synchronized state.
     *
     * Important: when the room is first joined, `room.state.players` is
     * still `undefined` for a brief window (the schema hasn't been decoded
     * yet). The previous version of this effect assumed the map was
     * always there and called `.forEach` directly, which threw a
     * TypeError and unmounted the entire scene through the nearest error
     * boundary — leaving the user staring at a black canvas.
     */
    const readPlayers = (): Map<string, PlayerState> => {
      const players = (
        room.state as unknown as
          | {
              players?: {
                size: number;
                forEach: (cb: (p: PlayerState, id: string) => void) => void;
              };
            }
          | undefined
      )?.players;
      const out = new Map<string, PlayerState>();
      if (players && typeof players.forEach === "function") {
        players.forEach((p, id) => out.set(id, p));
      }
      return out;
    };

    const sync = () => {
      const next = readPlayers();
      const ids = Array.from(next.keys()).sort();
      const fingerprint = ids.join(",");
      if (next.size === lastSize && fingerprint === lastIds) return;
      lastSize = next.size;
      lastIds = fingerprint;
      setPlayers(next);
    };

    sync();
    const off = room.onStateChange(() => sync());

    return () => {
      off?.();
    };
  }, [room]);

  // Stable ref to the local car group, used by the camera rig.
  const localCarRef = useRef<THREE.Object3D | null>(null);

  const localState = sessionId ? players.get(sessionId) : null;
  const remoteEntries = useMemo(
    () => Array.from(players.entries()).filter(([id]) => id !== sessionId),
    [players, sessionId],
  );

  // Initial camera position: aim at the spawn ring so the world is visible
  // from the very first frame, even before the local car arrives in state.
  // (Without this the camera stayed at [0,25,25] looking at origin and the
  // sky/ground might be off-screen on tall portrait viewports.)
  const initialCameraPos: [number, number, number] = [40, 30, 40];

  return (
    <Canvas
      shadows={!isMobile}
      dpr={[1, isMobile ? 1.25 : 1.75]}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        // Helpful for debugging on mobile: surface context-loss events
        // through React Three Fiber's onContextLost handler instead of
        // silently producing a black canvas.
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ position: initialCameraPos, fov: 55, near: 0.5, far: 800 }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor("#7fb8ff"); // sky-blue fallback while shaders compile
        camera.lookAt(0, 0, 0);
      }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <Lighting mobile={isMobile} />
      <fog attach="fog" args={["#aab4c2", 250, 700]} />

      <City />

      {localState ? (
        <Player state={localState} room={room} groupRef={localCarRef} />
      ) : null}
      {remoteEntries.map(([id, st]) => (
        <RemotePlayer key={id} state={st} />
      ))}

      <CameraRig target={localCarRef} />

      {/* Postprocessing is disabled on mobile: the EffectComposer pass alone
          can drop frame rate by 40-60% on mid-range phones, and the bloom +
          SMAA chain is the most likely culprit when a phone shows a black
          canvas right after entering the scene (shader compile failure). */}
      {!isMobile ? (
        <EffectComposer multisampling={0}>
          <SMAA />
          <Bloom
            intensity={0.35}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.2} darkness={0.7} />
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}
