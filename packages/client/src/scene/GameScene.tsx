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

  useEffect(() => {
    const stateAny = room.state as unknown as {
      players: {
        size: number;
        forEach: (cb: (p: PlayerState, id: string) => void) => void;
      };
    };

    let lastSize = -1;
    let lastIds = "";

    const sync = () => {
      const ids: string[] = [];
      const next = new Map<string, PlayerState>();
      stateAny.players.forEach((p, id) => {
        ids.push(id);
        next.set(id, p);
      });
      ids.sort();
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

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{ position: [0, 25, 25], fov: 50 }}
      onCreated={({ gl }) => {
        gl.setClearColor("#0b0d12");
      }}
    >
      <Lighting />
      <fog attach="fog" args={["#aab4c2", 250, 700]} />

      <City />

      {localState ? (
        <Player state={localState} room={room} groupRef={localCarRef} />
      ) : null}
      {remoteEntries.map(([id, st]) => (
        <RemotePlayer key={id} state={st} />
      ))}

      <CameraRig target={localCarRef} />

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
    </Canvas>
  );
}
