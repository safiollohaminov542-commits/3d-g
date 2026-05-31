import { Schema, MapSchema, type } from "@colyseus/schema";

/**
 * Authoritative state for a single player/car.
 * Position + quaternion are interpolated on the client.
 */
export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "Player";
  @type("string") carId: string = "sport";

  // Position
  @type("number") x: number = 0;
  @type("number") y: number = 0.5;
  @type("number") z: number = 0;

  // Rotation (quaternion)
  @type("number") qx: number = 0;
  @type("number") qy: number = 0;
  @type("number") qz: number = 0;
  @type("number") qw: number = 1;

  // Linear velocity (m/s)
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("number") vz: number = 0;

  // Engine RPM proxy [0,1] for client-side audio/visual cues
  @type("number") rpm: number = 0;

  // Visual front-wheel steer angle (radians)
  @type("number") wheelSteer: number = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
