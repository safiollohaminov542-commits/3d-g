import { create } from "zustand";
import { DEFAULT_CAR_ID } from "@3dg/shared";
import type { Room } from "@colyseus/sdk";

export type Phase = "menu" | "connecting" | "playing" | "error";

interface GameStore {
  phase: Phase;
  /** User-chosen display name. */
  name: string;
  /** Selected car id from the catalog. */
  carId: string;
  /** Connected Colyseus room (null until joined). */
  room: Room | null;
  /** Local session id, shadow of `room.sessionId` for cheap subscriptions. */
  sessionId: string | null;
  /** Most recent error message, surfaced in the UI. */
  error: string | null;

  setPhase: (p: Phase) => void;
  setName: (n: string) => void;
  setCarId: (id: string) => void;
  setRoom: (room: Room | null, sessionId: string | null) => void;
  setError: (e: string | null) => void;
}

const stored = typeof localStorage !== "undefined" ? localStorage : null;

export const useGameStore = create<GameStore>((set) => ({
  phase: "menu",
  name: stored?.getItem("3dg.name") ?? "",
  carId: stored?.getItem("3dg.carId") ?? DEFAULT_CAR_ID,
  room: null,
  sessionId: null,
  error: null,
  setPhase: (phase) => set({ phase }),
  setName: (name) => {
    stored?.setItem("3dg.name", name);
    set({ name });
  },
  setCarId: (carId) => {
    stored?.setItem("3dg.carId", carId);
    set({ carId });
  },
  setRoom: (room, sessionId) => set({ room, sessionId }),
  setError: (error) => set({ error }),
}));
