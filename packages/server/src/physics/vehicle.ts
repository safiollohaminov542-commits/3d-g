import type { CarConfig, InputState } from "@3dg/shared";

/**
 * Lightweight arcade-style vehicle simulation, integrated on the server.
 *
 * The model deliberately avoids a full rigid-body solver: each car is
 * represented by a 2D-plus-yaw state (position on XZ plane, heading angle)
 * with a forward speed scalar. This keeps the server cheap enough to run
 * 16 vehicles at the configured tick rate while still feeling drivable.
 *
 * Steering uses a simple bicycle approximation: wheelbase + steer angle
 * yields a yaw rate proportional to forward speed. Lateral grip is modeled
 * by exponentially damping any sideways velocity component each step;
 * pulling the handbrake reduces that damping, allowing the rear to slide.
 */
export class Vehicle {
  // Position (world)
  x = 0;
  y = 0.5;
  z = 0;

  // Heading angle around Y axis, radians. 0 = facing +Z.
  yaw = 0;

  // Forward speed along the heading vector (m/s). Negative = reverse.
  speed = 0;

  // Lateral velocity in the car's local frame (m/s). Used for drift feel.
  lateral = 0;

  // Current visual steer angle (radians), low-pass filtered for smoothness.
  wheelSteer = 0;

  // Engine RPM proxy in [0,1] for client visual/audio cues.
  rpm = 0;

  constructor(public config: CarConfig) {}

  /** Reset the vehicle to a spawn pose. */
  reset(x: number, z: number, yaw = 0) {
    this.x = x;
    this.y = this.config.size[1]! / 2 + 0.1;
    this.z = z;
    this.yaw = yaw;
    this.speed = 0;
    this.lateral = 0;
    this.wheelSteer = 0;
    this.rpm = 0;
  }

  /**
   * Advance the simulation by `dt` seconds using the supplied input.
   *
   * The integration is intentionally explicit and frame-rate dependent on
   * `dt` only via `dt`-scaled forces, which is sufficient at a fixed server
   * tick rate.
   */
  step(input: InputState, dt: number, worldHalf: number) {
    const cfg = this.config;

    // --- Steering: low-pass filter the target wheel angle for smoothness.
    const targetSteer = input.steer * cfg.maxSteer;
    const steerLerp = 1 - Math.exp(-dt * 8);
    this.wheelSteer += (targetSteer - this.wheelSteer) * steerLerp;

    // --- Longitudinal forces.
    // Throttle direction: forward by default; if standing still and brake is
    // held, treat brake as reverse throttle (classic arcade reverse).
    const movingForward = this.speed > 0.5;
    const movingBackward = this.speed < -0.5;

    let accel = 0;
    if (input.throttle > 0) {
      accel += (input.throttle * cfg.engineForce) / cfg.mass;
    }
    if (input.brake > 0) {
      if (movingForward) {
        // Brake decelerates forward motion.
        accel -= (input.brake * cfg.brakeForce) / cfg.mass;
      } else if (!movingBackward && input.throttle === 0) {
        // Stationary or near-stationary: brake becomes reverse throttle.
        accel -= (input.brake * cfg.engineForce * 0.6) / cfg.mass;
      } else {
        // Already reversing: brake decelerates reverse motion toward 0.
        accel -= (input.brake * cfg.brakeForce) / cfg.mass;
      }
    }

    // Rolling resistance + air drag (very simplified, speed-proportional).
    const drag = 0.4 * this.speed + 0.02 * this.speed * Math.abs(this.speed);
    accel -= drag / cfg.mass;

    this.speed += accel * dt;

    // Soft top-speed clamp (forward and reverse).
    const maxRev = cfg.maxSpeed * 0.4;
    if (this.speed > cfg.maxSpeed) this.speed = cfg.maxSpeed;
    if (this.speed < -maxRev) this.speed = -maxRev;

    // --- Yaw / steering: bicycle model.
    // Yaw rate scales with forward speed so that steering at standstill does
    // nothing — matches real-car feel and avoids spinning in place.
    const wheelbase = cfg.size[0]! * 0.55;
    const yawRate = (this.speed / wheelbase) * Math.tan(this.wheelSteer);
    this.yaw += yawRate * dt;

    // --- Lateral grip / handbrake-induced slide.
    // The "lateral" component represents how much the car is sliding sideways.
    // Steering injects a small amount; grip damps it back to zero.
    this.lateral += yawRate * this.speed * 0.02;
    const baseGrip = cfg.grip * 6.0;
    const gripFactor = input.handbrake ? baseGrip * 0.15 : baseGrip;
    const gripLerp = 1 - Math.exp(-dt * gripFactor);
    this.lateral *= 1 - gripLerp;

    // Handbrake also scrubs forward speed slightly.
    if (input.handbrake) {
      this.speed *= 1 - Math.min(0.9, dt * 1.2);
    }

    // --- Integrate position in world space.
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    // Forward axis = (sin(yaw), 0, cos(yaw)); right axis = (cos, 0, -sin).
    const fx = sin;
    const fz = cos;
    const rx = cos;
    const rz = -sin;

    this.x += (fx * this.speed + rx * this.lateral) * dt;
    this.z += (fz * this.speed + rz * this.lateral) * dt;

    // World bounds: bounce softly off the edges.
    if (this.x > worldHalf) {
      this.x = worldHalf;
      this.speed *= -0.3;
    } else if (this.x < -worldHalf) {
      this.x = -worldHalf;
      this.speed *= -0.3;
    }
    if (this.z > worldHalf) {
      this.z = worldHalf;
      this.speed *= -0.3;
    } else if (this.z < -worldHalf) {
      this.z = -worldHalf;
      this.speed *= -0.3;
    }

    // RPM proxy: blend forward speed and throttle.
    const speedNorm = Math.min(1, Math.abs(this.speed) / cfg.maxSpeed);
    this.rpm = Math.min(1, 0.15 + 0.6 * speedNorm + 0.4 * input.throttle);
  }

  /** Compute world-space velocity vector (vx, vy, vz). */
  getVelocity(): { vx: number; vy: number; vz: number } {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    return {
      vx: sin * this.speed + cos * this.lateral,
      vy: 0,
      vz: cos * this.speed - sin * this.lateral,
    };
  }

  /** Convert yaw angle into a quaternion around the Y axis. */
  getQuaternion(): { qx: number; qy: number; qz: number; qw: number } {
    const half = this.yaw * 0.5;
    return { qx: 0, qy: Math.sin(half), qz: 0, qw: Math.cos(half) };
  }
}
