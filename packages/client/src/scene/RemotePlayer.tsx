import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlayerState } from "../net/playerSchemaTypes";
import { Car } from "./Car";

interface RemotePlayerProps {
  state: PlayerState;
}

/**
 * Renders another player's car using the latest state replicated by the
 * server. Position and rotation are interpolated toward the target every
 * frame to mask the discrete tick rate (~30 Hz) and keep motion fluid even
 * when packets arrive irregularly.
 */
export function RemotePlayer({ state }: RemotePlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;

    targetPos.set(state.x, state.y, state.z);
    // Same all-zero-quaternion guard as in <Player>: keeps the transform
    // valid before the first state patch arrives.
    const w = state.qw === 0 && state.qx === 0 && state.qy === 0 && state.qz === 0
      ? 1
      : state.qw;
    targetQuat.set(state.qx, state.qy, state.qz, w);

    // Critically-damped-ish smoothing. Higher k → snappier, lower → smoother.
    const k = 1 - Math.exp(-dt * 14);
    g.position.lerp(targetPos, k);
    g.quaternion.slerp(targetQuat, k);
  });

  // Approximate forward speed for wheel-rolling animation.
  const speed = useMemo(() => {
    return Math.hypot(state.vx, state.vz);
  }, [state.vx, state.vz]);

  return (
    <group ref={groupRef}>
      <Car
        carId={state.carId}
        wheelSteer={state.wheelSteer}
        speed={speed}
        label={state.name}
      />
    </group>
  );
}
