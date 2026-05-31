import { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { getCarConfig } from "@3dg/shared";

interface CarProps {
  carId: string;
  /** Wheel steer angle in radians, used for visual front-wheel rotation. */
  wheelSteer?: number;
  /** Forward speed (m/s); used to spin the wheels. */
  speed?: number;
  /** Optional player-name label rendered above the car. */
  label?: string;
  /** Whether this car is the locally-controlled one (slightly emissive). */
  isSelf?: boolean;
}

/**
 * Placeholder car model assembled from primitives.
 *
 * Designed as a drop-in stand-in for a future GLTF asset: the body, cabin,
 * head/tail lights, and four wheels are exposed via stable transforms so
 * the steering and rolling animation contracts won't change when we swap
 * in real meshes.
 *
 * Wheel steer / roll animation is applied inside `useFrame` so the
 * mutations don't fight React's rendering and the parent doesn't need to
 * re-render at 60 fps to keep the wheels turning.
 */
export function Car({
  carId,
  wheelSteer = 0,
  speed = 0,
  label,
  isSelf = false,
}: CarProps) {
  const cfg = useMemo(() => getCarConfig(carId), [carId]);
  const [length, height, width] = cfg.size;

  const frontLeft = useRef<THREE.Group>(null);
  const frontRight = useRef<THREE.Group>(null);
  const wheelGroups = useRef<(THREE.Group | null)[]>([null, null, null, null]);

  // Accumulated rolling rotation, mutated outside React.
  const rollRef = useRef(0);

  // Latest values, kept in refs so `useFrame` reads them without React
  // recreating the callback every render.
  const steerRef = useRef(wheelSteer);
  const speedRef = useRef(speed);
  steerRef.current = wheelSteer;
  speedRef.current = speed;

  useFrame((_, dt) => {
    const s = steerRef.current;
    if (frontLeft.current) frontLeft.current.rotation.y = s;
    if (frontRight.current) frontRight.current.rotation.y = s;

    // Convert m/s to angular velocity assuming a small wheel radius; the
    // exact factor doesn't matter visually as long as it scales linearly.
    rollRef.current -= speedRef.current * dt * 3;
    for (const w of wheelGroups.current) {
      const child = w?.children[0];
      if (child) child.rotation.x = rollRef.current;
    }
  });

  const wheelRadius = Math.min(0.35, height * 0.4);
  const wheelWidth = 0.25;
  const xOff = width / 2 - wheelWidth / 2 - 0.05;
  const zOffFront = length / 2 - wheelRadius - 0.2;
  const zOffRear = -(length / 2 - wheelRadius - 0.2);
  const yOff = -height / 2 + wheelRadius * 0.6;

  return (
    <group>
      {/* Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial
          color={cfg.color}
          metalness={0.45}
          roughness={0.35}
          emissive={isSelf ? cfg.color : "#000000"}
          emissiveIntensity={isSelf ? 0.06 : 0}
        />
      </mesh>

      {/* Cabin / glass */}
      <mesh
        castShadow
        position={[0, height / 2 + 0.05, -length * 0.05]}
        scale={[width * 0.85, height * 0.7, length * 0.45]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#1a2230"
          metalness={0.6}
          roughness={0.15}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Headlights */}
      <mesh position={[xOff * 0.6, 0, length / 2 + 0.01]}>
        <boxGeometry args={[0.3, 0.15, 0.05]} />
        <meshStandardMaterial
          color="#fff8d6"
          emissive="#fff1a8"
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[-xOff * 0.6, 0, length / 2 + 0.01]}>
        <boxGeometry args={[0.3, 0.15, 0.05]} />
        <meshStandardMaterial
          color="#fff8d6"
          emissive="#fff1a8"
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Tail lights */}
      <mesh position={[xOff * 0.6, 0, -length / 2 - 0.01]}>
        <boxGeometry args={[0.3, 0.15, 0.05]} />
        <meshStandardMaterial color="#400" emissive="#a01010" />
      </mesh>
      <mesh position={[-xOff * 0.6, 0, -length / 2 - 0.01]}>
        <boxGeometry args={[0.3, 0.15, 0.05]} />
        <meshStandardMaterial color="#400" emissive="#a01010" />
      </mesh>

      {/* Front wheels (steerable) */}
      <group ref={frontLeft} position={[xOff, yOff, zOffFront]}>
        <Wheel
          ref={(g) => {
            wheelGroups.current[0] = g;
          }}
          radius={wheelRadius}
          width={wheelWidth}
        />
      </group>
      <group ref={frontRight} position={[-xOff, yOff, zOffFront]}>
        <Wheel
          ref={(g) => {
            wheelGroups.current[1] = g;
          }}
          radius={wheelRadius}
          width={wheelWidth}
        />
      </group>

      {/* Rear wheels */}
      <group position={[xOff, yOff, zOffRear]}>
        <Wheel
          ref={(g) => {
            wheelGroups.current[2] = g;
          }}
          radius={wheelRadius}
          width={wheelWidth}
        />
      </group>
      <group position={[-xOff, yOff, zOffRear]}>
        <Wheel
          ref={(g) => {
            wheelGroups.current[3] = g;
          }}
          radius={wheelRadius}
          width={wheelWidth}
        />
      </group>

      {label ? (
        <Html
          position={[0, height + 0.9, 0]}
          center
          distanceFactor={12}
          occlude={false}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
            padding: "2px 8px",
            borderRadius: 6,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            border: isSelf ? "1px solid #e63946" : "1px solid #444",
          }}
        >
          {label}
        </Html>
      ) : null}
    </group>
  );
}

interface WheelProps {
  radius: number;
  width: number;
}

const Wheel = forwardRef<THREE.Group, WheelProps>(function Wheel(
  { radius, width },
  ref,
) {
  return (
    <group ref={ref}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[radius, radius, width, 16]} />
        <meshStandardMaterial color="#111" roughness={0.7} />
      </mesh>
    </group>
  );
});
