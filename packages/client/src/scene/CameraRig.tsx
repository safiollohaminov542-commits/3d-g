import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface CameraRigProps {
  /** Reference to the local player's car group (in world space). */
  target: React.MutableRefObject<THREE.Object3D | null>;
}

/**
 * Top-down angled chase camera.
 *
 * The camera sits a fixed offset above and behind the target, smoothly
 * easing toward the desired pose every frame. The angle (~55° down) gives
 * a top-down arcade feel while still showing the side of the car, similar
 * to old GTA / Micro Machines.
 */
export function CameraRig({ target }: CameraRigProps) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3());

  // Camera offset in the *world* frame: high above and slightly behind on Z.
  // The follow direction uses the car's heading so the camera stays roughly
  // behind it as it turns.
  const HEIGHT = 22;
  const BACK = 14;
  const SMOOTH = 6; // larger = snappier

  useEffect(() => {
    camera.fov = 50;
    camera.near = 0.5;
    camera.far = 800;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame((_, dt) => {
    const t = target.current;
    if (!t) return;

    // Desired camera position: above + behind along the car's local -Z axis.
    const back = tmp.current.set(0, 0, -1).applyQuaternion(t.quaternion);
    desired.current
      .copy(t.position)
      .addScaledVector(back, BACK)
      .add(new THREE.Vector3(0, HEIGHT, 0));

    const k = 1 - Math.exp(-dt * SMOOTH);
    camera.position.lerp(desired.current, k);

    // Look slightly ahead of the car so turns are anticipated.
    const forward = tmp.current.set(0, 0, 1).applyQuaternion(t.quaternion);
    lookAt.current.copy(t.position).addScaledVector(forward, 6);
    camera.lookAt(lookAt.current);
  });

  return null;
}
