import { inputStore } from "../store/inputStore";

/**
 * Wire up keyboard input → inputStore. Returns a cleanup function.
 *
 * Mapping:
 *   W / ArrowUp     → throttle
 *   S / ArrowDown   → brake / reverse
 *   A / ArrowLeft   → steer left
 *   D / ArrowRight  → steer right
 *   Space           → handbrake (ручник)
 *   R               → reset/respawn
 */
export function attachKeyboard(): () => void {
  const pressed = new Set<string>();

  const update = () => {
    const throttle =
      pressed.has("w") || pressed.has("arrowup") ? 1 : 0;
    const brake =
      pressed.has("s") || pressed.has("arrowdown") ? 1 : 0;
    const steerLeft =
      pressed.has("a") || pressed.has("arrowleft") ? 1 : 0;
    const steerRight =
      pressed.has("d") || pressed.has("arrowright") ? 1 : 0;
    const steer = steerRight - steerLeft;
    const handbrake = pressed.has(" ") || pressed.has("space");
    const reset = pressed.has("r");

    inputStore.set({ throttle, brake, steer, handbrake, reset });
  };

  const onDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const key = normalize(e);
    if (!key) return;
    pressed.add(key);
    update();
    // Prevent page scrolling on space/arrows.
    if (
      key === " " ||
      key === "space" ||
      key.startsWith("arrow")
    ) {
      e.preventDefault();
    }
  };
  const onUp = (e: KeyboardEvent) => {
    const key = normalize(e);
    if (!key) return;
    pressed.delete(key);
    update();
  };
  const onBlur = () => {
    pressed.clear();
    inputStore.reset();
  };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);

  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
  };
}

function normalize(e: KeyboardEvent): string | null {
  if (!e.key) return null;
  return e.key.toLowerCase();
}
