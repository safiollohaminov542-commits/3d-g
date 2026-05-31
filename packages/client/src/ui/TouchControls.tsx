import { useEffect, useRef, useState } from "react";
import { inputStore } from "../store/inputStore";

/**
 * Mobile-friendly on-screen driving controls.
 *
 * Layout (portrait or landscape):
 *   - Left side  : virtual steering wheel (drag-to-rotate)
 *   - Right side : two stacked pedals — gas (top) + brake (bottom)
 *   - Right top  : handbrake square button
 *
 * The wheel uses pointer events (not touch-only) so it also works for the
 * unlikely-but-friendly desktop case of "drag the wheel with the mouse",
 * useful for testing without a phone.
 */
export function TouchControls() {
  const [visible, setVisible] = useState(detectTouch());

  useEffect(() => {
    // Reveal touch UI as soon as we see any pointer event of touch type.
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") setVisible(true);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <SteeringWheel />
      <Pedal
        kind="throttle"
        className="bottom-6 right-6 bg-emerald-500/30 border-emerald-400/60"
        label="GAS"
      />
      <Pedal
        kind="brake"
        className="bottom-6 right-32 bg-red-500/30 border-red-400/60"
        label="BRAKE"
      />
      <Handbrake />
    </div>
  );
}

function detectTouch() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 0
  );
}

/* ───────────────────────── Steering wheel ───────────────────────── */

function SteeringWheel() {
  const ref = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const startAngleRef = useRef(0);
  const startSteerRef = useRef(0);
  const activePointerRef = useRef<number | null>(null);
  const [angleDeg, setAngleDeg] = useState(0);

  const MAX_TURN = Math.PI; // ±180° wheel rotation = full lock.

  const updateSteer = (radians: number) => {
    angleRef.current = clamp(radians, -MAX_TURN, MAX_TURN);
    const steer = angleRef.current / MAX_TURN; // -1..1
    inputStore.set({ steer });
    setAngleDeg((angleRef.current * 180) / Math.PI);
  };

  const angleFromEvent = (e: PointerEvent) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  };

  const onDown = (e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    activePointerRef.current = e.pointerId;
    startAngleRef.current = angleFromEvent(e);
    startSteerRef.current = angleRef.current;
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (activePointerRef.current !== e.pointerId) return;
    const a = angleFromEvent(e);
    const delta = wrapAngle(a - startAngleRef.current);
    updateSteer(startSteerRef.current + delta);
    e.preventDefault();
  };
  const onUp = (e: PointerEvent) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    // Spring back to center.
    updateSteer(0);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute bottom-6 left-6 select-none"
      style={{
        width: 180,
        height: 180,
        touchAction: "none",
      }}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full border-4 border-white/30 bg-black/40 backdrop-blur"
        style={{
          transform: `rotate(${angleDeg}deg)`,
          transition: activePointerRef.current === null
            ? "transform 0.18s ease-out"
            : "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Wheel spokes */}
        <div className="absolute h-1.5 w-[88%] bg-white/30 rounded-full" />
        <div className="absolute h-[88%] w-1.5 bg-white/30 rounded-full" />
        {/* Hub */}
        <div className="h-12 w-12 rounded-full bg-white/15 border border-white/40" />
      </div>
    </div>
  );
}

/* ───────────────────────── Pedals ───────────────────────── */

interface PedalProps {
  kind: "throttle" | "brake";
  className: string;
  label: string;
}

function Pedal({ kind, className, label }: PedalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  const set = (value: number) => {
    inputStore.set(kind === "throttle" ? { throttle: value } : { brake: value });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      activeRef.current = e.pointerId;
      setPressed(true);
      set(1);
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (activeRef.current !== e.pointerId) return;
      activeRef.current = null;
      setPressed(false);
      set(0);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={
        "pointer-events-auto absolute flex h-24 w-24 items-center justify-center rounded-2xl border-2 text-sm font-bold backdrop-blur transition active:scale-95 " +
        className +
        (pressed ? " brightness-150" : "")
      }
      style={{ touchAction: "none" }}
    >
      {label}
    </div>
  );
}

/* ───────────────────────── Handbrake ───────────────────────── */

function Handbrake() {
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      activeRef.current = e.pointerId;
      setPressed(true);
      inputStore.set({ handbrake: true });
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (activeRef.current !== e.pointerId) return;
      activeRef.current = null;
      setPressed(false);
      inputStore.set({ handbrake: false });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={
        "pointer-events-auto absolute right-6 top-32 flex h-16 w-24 items-center justify-center rounded-xl border-2 border-yellow-400/60 bg-yellow-500/25 text-xs font-bold backdrop-blur transition active:scale-95 " +
        (pressed ? "brightness-150" : "")
      }
      style={{ touchAction: "none" }}
    >
      РУЧНИК
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
