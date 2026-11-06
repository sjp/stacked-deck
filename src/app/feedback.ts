/** Events the interaction layer reports, for sound effects and haptics to react to. */
export type FeedbackEvent =
  | "pickup"
  | "drop"
  | "flip"
  | "draw"
  | "invalid"
  | "foundation"
  | "complete"
  | "win";

type Listener = (event: FeedbackEvent) => void;

const listeners = new Set<Listener>();

export function onFeedback(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitFeedback(event: FeedbackEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}
