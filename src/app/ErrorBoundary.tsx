import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/**
 * Shows a reload screen instead of a blank page when rendering throws. Games are saved as
 * they're played (and nothing here clears the save), so a reload carries on.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Stacked Deck stopped", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <main className="page">
        <h1>Something went wrong</h1>
        <p>Your game is saved. Reload to carry on where you left off.</p>
        <button
          type="button"
          className="primary"
          onClick={() => {
            globalThis.location.reload();
          }}
        >
          Reload
        </button>
      </main>
    );
  }
}
