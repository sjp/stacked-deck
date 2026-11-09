import type { FeedbackEvent } from "../ui/feedback.ts";

/** Vibration patterns in milliseconds. Events without one don't vibrate. */
export const HAPTIC_PATTERNS: Readonly<Partial<Record<FeedbackEvent, number | readonly number[]>>> =
  {
    pickup: 5,
    invalid: [20, 40, 20],
    foundation: 15,
    complete: 15,
    win: [30, 60, 30, 60, 80],
  };

export interface Vibrator {
  vibrate(pattern: number | number[]): boolean;
}

/** Plays haptic feedback where the Vibration API exists (not on iOS). */
export function createHaptics(target: Partial<Vibrator> | undefined) {
  let enabled = false;
  return {
    configure: (on: boolean) => {
      enabled = on;
    },
    play: (event: FeedbackEvent) => {
      const pattern = HAPTIC_PATTERNS[event];
      if (!enabled || pattern === undefined || typeof target?.vibrate !== "function") {
        return;
      }
      try {
        target.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
      } catch {
        // Some browsers throw when vibration isn't allowed; haptics are optional.
      }
    },
  };
}
