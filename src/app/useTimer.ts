import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePageVisible } from "./usePageVisible.ts";

export interface Timer {
  /** Milliseconds counted so far. */
  readonly elapsed: () => number;
  readonly running: () => boolean;
  readonly start: () => void;
  readonly pause: () => void;
  readonly reset: (ms?: number) => void;
}

/** A stopwatch held in refs, so starting and pausing it never re-renders. */
export function useTimer(initialMs = 0): Timer {
  const base = useRef(initialMs);
  const since = useRef<number | undefined>(undefined);

  const elapsed = useCallback(
    () => base.current + (since.current === undefined ? 0 : performance.now() - since.current),
    [],
  );
  const start = useCallback(() => {
    since.current ??= performance.now();
  }, []);
  const pause = useCallback(() => {
    base.current = elapsed();
    since.current = undefined;
  }, [elapsed]);
  const reset = useCallback((ms = 0) => {
    base.current = ms;
    since.current = undefined;
  }, []);
  const running = useCallback(() => since.current !== undefined, []);

  return useMemo(
    () => ({ elapsed, running, start, pause, reset }),
    [elapsed, running, start, pause, reset],
  );
}

/** A timer that runs while `running` is true and the page is visible. */
export function useGameClock(initialMs: number, running: boolean): Timer {
  const timer = useTimer(initialMs);
  const visible = usePageVisible();
  useEffect(() => {
    if (running && visible) {
      timer.start();
    } else {
      timer.pause();
    }
  }, [running, visible, timer]);
  return timer;
}
