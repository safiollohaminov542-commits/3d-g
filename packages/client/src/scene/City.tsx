import { useMemo } from "react";
import * as THREE from "three";
import { WORLD_SIZE } from "@3dg/shared";

/**
 * Procedurally generated open-world city placeholder.
 *
 * Layout: a square ground plane with a regular street grid, perimeter wall,
 * and instanced building blocks scattered between intersections. The whole
 * scene is deterministic (seeded RNG) so all clients agree on building
 * positions and the server can rely on them for collision later.
 *
 * Buildings are rendered through `instancedMesh` to keep draw calls flat
 * even at city scale — important for mobile devices where every draw call
 * costs more than on desktop.
 */
export function City() {
  const layout = useMemo(() => buildCityLayout(), []);

  return (
    <group>
      {/* Ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        position={[0, 0, 0]}
      >
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#3a3f47" roughness={0.95} />
      </mesh>

      {/* Streets (slightly above ground to avoid z-fighting). */}
      {layout.roads.map((r, i) => (
        <mesh
          key={`r${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[r.x, 0.01, r.z]}
          receiveShadow
        >
          <planeGeometry args={[r.w, r.h]} />
          <meshStandardMaterial
            color="#1c1f24"
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Lane markings */}
      {layout.markings.map((m, i) => (
        <mesh
          key={`m${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[m.x, 0.02, m.z]}
        >
          <planeGeometry args={[m.w, m.h]} />
          <meshStandardMaterial color="#f6c453" emissive="#f6c453" emissiveIntensity={0.1} />
        </mesh>
      ))}

      {/* Buildings via instanced mesh */}
      <Buildings positions={layout.buildings} />

      {/* Perimeter walls */}
      {layout.walls.map((w, i) => (
        <mesh key={`w${i}`} position={[w.x, w.h / 2, w.z]} castShadow receiveShadow>
          <boxGeometry args={[w.l, w.h, w.t]} />
          <meshStandardMaterial color="#2b2f36" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  hue: number;
}

function Buildings({ positions }: { positions: Building[] }) {
  const ref = useMemo(() => {
    const dummy = new THREE.Object3D();
    const colors: THREE.Color[] = [];
    const matrices: THREE.Matrix4[] = [];
    for (const b of positions) {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      const color = new THREE.Color().setHSL(b.hue, 0.18, 0.45);
      colors.push(color);
    }
    return { matrices, colors };
  }, [positions]);

  return (
    <instancedMesh
      args={[
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({
          roughness: 0.8,
          metalness: 0.05,
        }),
        positions.length,
      ]}
      castShadow
      receiveShadow
      onUpdate={(self) => {
        // Initialize the per-instance color buffer once, then write into it.
        if (!self.instanceColor) {
          self.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(positions.length * 3),
            3,
          );
        }
        for (let i = 0; i < ref.matrices.length; i++) {
          self.setMatrixAt(i, ref.matrices[i]!);
          self.setColorAt(i, ref.colors[i]!);
        }
        self.instanceMatrix.needsUpdate = true;
        if (self.instanceColor) self.instanceColor.needsUpdate = true;
      }}
    />
  );
}

interface CityLayout {
  roads: { x: number; z: number; w: number; h: number }[];
  markings: { x: number; z: number; w: number; h: number }[];
  buildings: Building[];
  walls: { x: number; z: number; l: number; t: number; h: number }[];
}

function buildCityLayout(): CityLayout {
  const half = WORLD_SIZE / 2;
  const blockSize = 80;
  const roadWidth = 14;
  const blocks = Math.floor(WORLD_SIZE / blockSize);
  const roads: CityLayout["roads"] = [];
  const markings: CityLayout["markings"] = [];

  // Horizontal and vertical streets through the grid.
  for (let i = 0; i <= blocks; i++) {
    const offset = -half + i * blockSize;
    roads.push({ x: 0, z: offset, w: WORLD_SIZE, h: roadWidth });
    roads.push({ x: offset, z: 0, w: roadWidth, h: WORLD_SIZE });

    // Center lane markings every 8m.
    for (let j = -half + 6; j < half; j += 8) {
      markings.push({ x: j, z: offset, w: 2.5, h: 0.25 });
      markings.push({ x: offset, z: j, w: 0.25, h: 2.5 });
    }
  }

  // Buildings inside each block, with margin from the road.
  const rng = mulberry32(1234567);
  const buildings: Building[] = [];
  for (let bx = 0; bx < blocks; bx++) {
    for (let bz = 0; bz < blocks; bz++) {
      const cx = -half + bx * blockSize + blockSize / 2;
      const cz = -half + bz * blockSize + blockSize / 2;
      const margin = roadWidth / 2 + 4;
      const usable = blockSize - margin * 2;
      // 1–4 buildings per block.
      const count = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const w = 8 + rng() * 14;
        const d = 8 + rng() * 14;
        const h = 6 + rng() * 30;
        const x = cx + (rng() - 0.5) * (usable - w);
        const z = cz + (rng() - 0.5) * (usable - d);
        buildings.push({ x, z, w, d, h, hue: rng() });
      }
    }
  }

  // Perimeter wall to keep cars inside.
  const wallH = 4;
  const wallT = 1;
  const walls = [
    { x: 0, z: half, l: WORLD_SIZE, t: wallT, h: wallH },
    { x: 0, z: -half, l: WORLD_SIZE, t: wallT, h: wallH },
    { x: half, z: 0, l: wallT, t: WORLD_SIZE, h: wallH },
    { x: -half, z: 0, l: wallT, t: WORLD_SIZE, h: wallH },
  ];

  return { roads, markings, buildings, walls };
}

/** Tiny seeded PRNG so the city looks identical across reloads/clients. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
