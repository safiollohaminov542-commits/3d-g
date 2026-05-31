import { CAR_CATALOG } from "@3dg/shared";
import { useGameStore } from "../store/gameStore";
import { joinCity } from "../net/colyseus";

/**
 * Pre-game menu: name input + car selection + Play button.
 */
export function Lobby() {
  const { name, carId, error, setName, setCarId, setPhase, setRoom, setError } =
    useGameStore();

  const canPlay = name.trim().length >= 2;

  const handlePlay = async () => {
    setError(null);
    setPhase("connecting");
    try {
      const room = await joinCity({ name: name.trim(), carId });
      setRoom(room, room.sessionId);
      setPhase("playing");

      room.onLeave(() => {
        setRoom(null, null);
        setPhase("menu");
      });
      room.onError((code, message) => {
        console.error("[room] error", code, message);
        setError(message ?? `Error ${code}`);
      });
    } catch (e) {
      console.error("[lobby] join failed", e);
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/95">
      <div className="w-[min(480px,92vw)] rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
        <h1 className="mb-1 text-3xl font-bold tracking-tight">
          City Drive <span className="text-accent">3D</span>
        </h1>
        <p className="mb-6 text-sm text-white/60">
          Open-world multiplayer racing — up to 16 players.
        </p>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-white/60">
            Your name
          </span>
          <input
            className="allow-touch w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base outline-none focus:border-accent"
            placeholder="Driver"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="mb-6">
          <span className="mb-2 block text-xs uppercase tracking-wide text-white/60">
            Choose your car
          </span>
          <div className="grid grid-cols-2 gap-2">
            {CAR_CATALOG.map((car) => {
              const selected = car.id === carId;
              return (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => setCarId(car.id)}
                  className={
                    "flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition " +
                    (selected
                      ? "border-accent bg-accent/10"
                      : "border-white/10 bg-white/5 hover:border-white/30")
                  }
                >
                  <span
                    className="h-8 w-8 rounded-md border border-white/20"
                    style={{ background: car.color }}
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {car.name}
                    </span>
                    <span className="block text-[11px] text-white/50">
                      Top {Math.round(car.maxSpeed * 3.6)} km/h
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canPlay}
          onClick={handlePlay}
          className={
            "w-full rounded-lg px-4 py-3 text-base font-semibold transition " +
            (canPlay
              ? "bg-accent text-white hover:brightness-110"
              : "cursor-not-allowed bg-white/10 text-white/40")
          }
        >
          Drive
        </button>

        <p className="mt-4 text-center text-[11px] text-white/40">
          WASD / Arrows to drive · Space = handbrake · R = reset
        </p>
      </div>
    </div>
  );
}
