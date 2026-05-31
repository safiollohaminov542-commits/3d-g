import { EMPTY_INPUT, type InputState } from "@3dg/shared";

/**
 * Singleton input state shared between every input source (keyboard, touch
 * controls, gamepad in the future) and the network sender.
 *
 * We deliberately avoid Zustand here because input mutations happen at high
 * frequency (every frame for the steering wheel) and don't need to trigger
 * React re-renders. Components that want to *display* the input subscribe
 * via the lightweight listener API.
 */
const state: InputState = { ...EMPTY_INPUT };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const inputStore = {
  /** Read a snapshot of the current input. Returns the live object. */
  get(): InputState {
    return state;
  },

  /** Bulk update — useful for touch controls that set multiple axes at once. */
  set(partial: Partial<InputState>) {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof InputState)[]) {
      const v = partial[key];
      if (v === undefined) continue;
      if ((state as Record<string, unknown>)[key] !== v) {
        (state as Record<string, unknown>)[key] = v;
        changed = true;
      }
    }
    if (changed) notify();
  },

  reset() {
    Object.assign(state, EMPTY_INPUT);
    notify();
  },

  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
