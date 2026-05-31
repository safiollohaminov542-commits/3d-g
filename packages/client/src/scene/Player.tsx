import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MessageType } from "@3dg/shared";
import type { Room } from "@colyseus/sdk";
import type { PlayerState } from "../net/playerSchemaTypes";
import { inputStore } from "../store/inputStore";
import { Car } from "./Car";

interface PlayerProps {
  state: PlayerState;
  room: Room;
  /**
   * Forwarded ref to the player's group so the camera rig can follow it.
   */
  groupRef: React.MutableRefObject<THREE.Object3D | null>;
}

/**
 * The locally-controlled player.
 *
 * Network model: input-only client. Each frame we read the latest input
 * snapshot and post it to the server; rendering snaps to the authoritative
 * state we receive back. This is deliberately simple — no client-side
 * prediction yet — so the displayed car always matches what the server
 * thinks. With a 30 Hz tick rate plus interpolation it still feels good for
 * an open-world arcade racer over LAN/low-latency Wi-Fi.
 */
export function Player({ state, room, groupRef }: PlayerProps) {
  const localGroup = useRef<THREE.Group>(null);
  const seqRef = useRef(0);

  // Publish our group ref to the camera rig once it's mounted.
  useEffect(() => {
    groupRef.current = localGroup.current;
    return () => {
      if (groupRef.current === localGroup.current) groupRef.current = null;
    };
  }, [groupRef]);

  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  // Send input at the server tick rate (30 Hz) instead of every frame, to
  // avoid flooding the socket with redundant updates on 144 Hz displays.
  const lastSent = useRef(0);
  const SEND_INTERVAL = 1 / 30;

  useFrame((_, dt) => {
    // 1. Smooth-snap our visual to the authoritative pose.
    const g = localGroup.current;
    if (g) {
      targetPos.set(state.x, state.y, state.z);
      // Guard against an all-zero quaternion (which can happen for one
      // frame between PlayerState construction and the first server
      // patch); slerping toward it would NaN out the entire transform.
      const w = state.qw === 0 && state.qx === 0 && state.qy === 0 && state.qz === 0
        ? 1
        : state.qw;
      targetQuat.set(state.qx, state.qy, state.qz, w);
      const k = 1 - Math.exp(-dt * 18);
      g.position.lerp(targetPos, k);
      g.quaternion.slerp(targetQuat, k);
    }

    // 2. Forward input to the server at fixed cadence.
    lastSent.current += dt;
    if (lastSent.current >= SEND_INTERVAL) {
      lastSent.current = 0;
      const input = inputStore.get();
      seqRef.current += 1;
      room.send(MessageType.Input, {
        ...input,
        seq: seqRef.current,
      });
    }
  });

  const speed = Math.hypot(state.vx, state.vz);

  return (
    <group ref={localGroup}>
      <Car
        carId={state.carId}
        wheelSteer={state.wheelSteer}
        speed={speed}
        label={state.name}
        isSelf
      />
    </group>
  );
}
