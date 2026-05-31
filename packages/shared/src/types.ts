/**
 * Per-frame input sent from client to server.
 * All values are normalized: throttle/brake in [0,1], steer in [-1,1].
 */
export interface InputState {
  throttle: number; // 0..1 — gas pedal
  brake: number; // 0..1 — brake pedal
  steer: number; // -1..1 — left negative, right positive
  handbrake: boolean; // ручник
  reset: boolean; // request respawn
  /** Monotonic client timestamp (ms) — used for ordering. */
  seq: number;
}

export const EMPTY_INPUT: InputState = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  reset: false,
  seq: 0,
};

/**
 * Snapshot of a remote player used for client-side interpolation.
 */
export interface PlayerSnapshot {
  id: string;
  name: string;
  carId: string;
  x: number;
  y: number;
  z: number;
  /** Quaternion */
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  /** Linear velocity */
  vx: number;
  vy: number;
  vz: number;
  /** Engine RPM proxy in [0, 1] for sound/visual cues. */
  rpm: number;
  /** Wheel steer angle, radians, for visual front-wheel rotation. */
  wheelSteer: number;
}
