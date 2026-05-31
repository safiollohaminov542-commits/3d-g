import { Sky } from "@react-three/drei";
import { WORLD_SIZE } from "@3dg/shared";

/**
 * Outdoor lighting rig: physically-shaded sky + warm directional sun with
 * shadow casting, plus a soft hemisphere fill for global ambient.
 *
 * Shadow camera bounds are sized to roughly match the world so shadows
 * cover the whole drivable area without wasting resolution.
 */
export function Lighting() {
  const sunY = 80;
  const sunDistance = 100;
  const half = WORLD_SIZE / 2;

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[80, 60, -40]}
        turbidity={3}
        rayleigh={1.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      <hemisphereLight
        args={["#cfd8e3", "#1a1f26", 0.5]}
        position={[0, 1, 0]}
      />

      <directionalLight
        position={[sunDistance * 0.4, sunY, sunDistance * -0.35]}
        intensity={1.6}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-bias={-0.0005}
      />

      <ambientLight intensity={0.15} />
    </>
  );
}
