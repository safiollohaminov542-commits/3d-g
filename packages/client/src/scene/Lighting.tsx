import { Sky } from "@react-three/drei";
import { WORLD_SIZE } from "@3dg/shared";

interface LightingProps {
  /** When true, scale shadows down (or off) to keep mobile FPS reasonable. */
  mobile?: boolean;
}

/**
 * Outdoor lighting rig: physically-shaded sky + warm directional sun with
 * shadow casting, plus a soft hemisphere fill for global ambient.
 *
 * The shadow camera bounds are tighter than the world to keep the depth
 * buffer's resolvable range usable; only roughly the area around the
 * action receives high-quality shadows. Mobile gets a smaller shadow map
 * (or none) because a 2048² texture plus a wide ortho frustum is one of
 * the most common reasons a low-end GPU stalls on the first frame.
 */
export function Lighting({ mobile = false }: LightingProps) {
  const sunY = 80;
  const sunDistance = 100;
  // Shadow ortho frustum doesn't need to cover the *entire* world — that
  // wastes precision. Cover a generous region around origin instead.
  const shadowHalf = Math.min(WORLD_SIZE / 2, 200);
  const shadowMapSize = mobile ? 1024 : 2048;

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
        castShadow={!mobile}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-bias={-0.0005}
      />

      <ambientLight intensity={0.25} />
    </>
  );
}
