/**
 * Catalog of selectable cars. Physical and visual parameters are shared
 * between client (rendering) and server (authoritative simulation).
 */
export interface CarConfig {
  id: string;
  name: string;
  /** Hex color used for the placeholder body material. */
  color: string;
  /** Mass in kg. */
  mass: number;
  /** Top forward speed (m/s) — soft cap applied to throttle force. */
  maxSpeed: number;
  /** Engine acceleration force (N). */
  engineForce: number;
  /** Brake force (N). */
  brakeForce: number;
  /** Maximum steering angle (radians). */
  maxSteer: number;
  /** Body dimensions in meters: [length, height, width]. */
  size: [number, number, number];
  /** Grip multiplier (1 = baseline). Higher = better cornering. */
  grip: number;
}

export const CAR_CATALOG: CarConfig[] = [
  {
    id: "sport",
    name: "Sport",
    color: "#e63946",
    mass: 1200,
    maxSpeed: 55,
    engineForce: 9000,
    brakeForce: 14000,
    maxSteer: 0.55,
    size: [4.2, 1.2, 1.8],
    grip: 1.1,
  },
  {
    id: "sedan",
    name: "Sedan",
    color: "#1d3557",
    mass: 1500,
    maxSpeed: 45,
    engineForce: 8000,
    brakeForce: 13000,
    maxSteer: 0.5,
    size: [4.6, 1.4, 1.85],
    grip: 1.0,
  },
  {
    id: "suv",
    name: "SUV",
    color: "#2a9d8f",
    mass: 2000,
    maxSpeed: 40,
    engineForce: 9500,
    brakeForce: 15000,
    maxSteer: 0.45,
    size: [4.8, 1.7, 2.0],
    grip: 0.95,
  },
  {
    id: "muscle",
    name: "Muscle",
    color: "#f4a261",
    mass: 1700,
    maxSpeed: 60,
    engineForce: 12000,
    brakeForce: 14000,
    maxSteer: 0.5,
    size: [4.9, 1.3, 1.95],
    grip: 1.0,
  },
];

export const DEFAULT_CAR_ID = "sport";

export function getCarConfig(id: string): CarConfig {
  return CAR_CATALOG.find((c) => c.id === id) ?? CAR_CATALOG[0]!;
}
