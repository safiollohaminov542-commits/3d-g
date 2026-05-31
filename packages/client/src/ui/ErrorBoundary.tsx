import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Human-readable label for this boundary, shown in the fallback. */
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort safety net for the 3D scene.
 *
 * If a Three.js / R3F render throws (invalid props, broken shader, lost
 * WebGL context...), React would silently unmount the subtree and leave
 * the user staring at a black canvas. This boundary turns that into a
 * visible message that tells the user *what* failed and gives them a
 * "retry" button — which simply remounts the children.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to the console too so it shows up in DevTools / mobile remote
    // debug sessions.
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-ink/90 p-6">
        <div className="max-w-md rounded-xl border border-red-500/40 bg-black/70 p-5 text-sm text-white">
          <div className="mb-2 text-base font-semibold text-red-300">
            Render error in {this.props.label}
          </div>
          <pre className="mb-4 max-h-48 overflow-auto rounded bg-black/40 p-2 text-xs text-red-200">
            {error.message}
            {error.stack ? `\n\n${error.stack.split("\n").slice(0, 4).join("\n")}` : null}
          </pre>
          <button
            type="button"
            onClick={this.retry}
            className="rounded-md bg-red-500/30 px-4 py-2 text-sm font-medium hover:bg-red-500/50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
