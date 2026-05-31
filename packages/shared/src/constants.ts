/**
 * Server tick rate (Hz) — number of physics steps per second on the server.
 */
export const TICK_RATE = 30;

/**
 * Maximum number of players allowed in a single room.
 */
export const MAX_PLAYERS_PER_ROOM = 16;

/**
 * Default Colyseus room name.
 */
export const ROOM_NAME = "city";

/**
 * Network message types between client and server.
 */
export const MessageType = {
  Input: "input",
  Reset: "reset",
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * Size of the open-world city (square plane in meters).
 */
export const WORLD_SIZE = 1000;
