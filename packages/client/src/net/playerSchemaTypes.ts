/**
 * Local mirror of the server's PlayerState shape.
 *
 * We don't import @colyseus/schema on the client to keep the bundle small;
 * incoming objects from `colyseus.js` are duck-typed against this interface.
 */
export interface PlayerState {
  id: string;
  name: string;
  carId: string;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  vx: number;
  vy: number;
  vz: number;
  rpm: number;
  wheelSteer: number;
}
