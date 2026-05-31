import { Room, Client } from "colyseus";
import {
  EMPTY_INPUT,
  InputState,
  MAX_PLAYERS_PER_ROOM,
  MessageType,
  TICK_RATE,
  WORLD_SIZE,
  getCarConfig,
} from "@3dg/shared";
import { GameState, PlayerState } from "../schema.js";
import { Vehicle } from "../physics/vehicle.js";

interface JoinOptions {
  name?: string;
  carId?: string;
}

/**
 * Authoritative game room.
 *
 * Per tick (30 Hz):
 *   1. For every player, integrate the latest input through the arcade
 *      vehicle simulation.
 *   2. Copy the resulting pose / velocity into the synchronized state.
 *
 * Colyseus then broadcasts the diffed state to every connected client.
 */
export class CityRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS_PER_ROOM;
  state = new GameState();

  /** Latest input for each session, applied during the next tick. */
  private inputs = new Map<string, InputState>();

  /** Server-side simulation state for each session. */
  private vehicles = new Map<string, Vehicle>();

  onCreate() {
    this.setSimulationInterval(
      (dtMs) => this.update(dtMs / 1000),
      1000 / TICK_RATE,
    );

    this.onMessage(MessageType.Input, (client, input: InputState) => {
      // Sanitize: clamp ranges and fall back to empty input on malformed data.
      if (!input || typeof input !== "object") return;
      this.inputs.set(client.sessionId, {
        throttle: clamp01(input.throttle),
        brake: clamp01(input.brake),
        steer: clampSym(input.steer),
        handbrake: !!input.handbrake,
        reset: !!input.reset,
        seq: typeof input.seq === "number" ? input.seq : 0,
      });
    });

    this.onMessage(MessageType.Reset, (client) => {
      const v = this.vehicles.get(client.sessionId);
      if (v) {
        const spawn = this.pickSpawn();
        v.reset(spawn.x, spawn.z, spawn.yaw);
      }
    });
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const carId = options.carId ?? "sport";
    const name = (options.name ?? "Player").slice(0, 24);
    const cfg = getCarConfig(carId);

    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = name;
    player.carId = cfg.id;

    const spawn = this.pickSpawn();
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = cfg.size[1]! / 2 + 0.1;

    this.state.players.set(client.sessionId, player);

    const vehicle = new Vehicle(cfg);
    vehicle.reset(spawn.x, spawn.z, spawn.yaw);
    this.vehicles.set(client.sessionId, vehicle);

    this.inputs.set(client.sessionId, { ...EMPTY_INPUT });

    console.log(
      `[CityRoom] +join ${client.sessionId} as "${name}" car=${cfg.id} ` +
        `(${this.clients.length}/${this.maxClients})`,
    );
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.vehicles.delete(client.sessionId);
    console.log(`[CityRoom] -leave ${client.sessionId}`);
  }

  /** Single physics + state replication step. */
  private update(dt: number) {
    const half = WORLD_SIZE / 2;

    this.vehicles.forEach((vehicle, sessionId) => {
      const input = this.inputs.get(sessionId) ?? EMPTY_INPUT;
      vehicle.step(input, dt, half);

      const player = this.state.players.get(sessionId);
      if (!player) return;

      player.x = vehicle.x;
      player.y = vehicle.y;
      player.z = vehicle.z;

      const q = vehicle.getQuaternion();
      player.qx = q.qx;
      player.qy = q.qy;
      player.qz = q.qz;
      player.qw = q.qw;

      const v = vehicle.getVelocity();
      player.vx = v.vx;
      player.vy = v.vy;
      player.vz = v.vz;

      player.rpm = vehicle.rpm;
      player.wheelSteer = vehicle.wheelSteer;
    });
  }

  /**
   * Choose a spawn point on a circle around the city center, spaced so
   * fresh joiners don't materialize on top of each other.
   */
  private pickSpawn(): { x: number; z: number; yaw: number } {
    const i = this.state.players.size;
    const radius = 30;
    const angle = (i * Math.PI * 2) / Math.max(8, MAX_PLAYERS_PER_ROOM);
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      yaw: angle + Math.PI / 2,
    };
  }
}

function clamp01(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampSym(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  if (n < -1) return -1;
  if (n > 1) return 1;
  return n;
}
