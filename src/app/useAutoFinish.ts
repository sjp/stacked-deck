import { useEffect } from "react";
import { nextFoundationMove } from "../engine/game.ts";
import type { GameState } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import { emitFeedback } from "./feedback.ts";
import type { AnimationSpeed } from "./settings.ts";
import { MOVE_MS } from "./settings.ts";
import type { GameAction } from "./useGame.ts";

/** While `finishing`, sends cards up one at a time so they visibly fly to the foundations. */
export function useAutoFinish(
  variant: Variant,
  state: GameState,
  finishing: boolean,
  speed: AnimationSpeed,
  auto: AutoMoveOptions,
  dispatch: (action: GameAction) => void,
): void {
  const stepMs = Math.max(60, MOVE_MS[speed] * 0.6);
  useEffect(() => {
    if (!finishing) {
      return undefined;
    }
    const move = nextFoundationMove(variant, state);
    if (move === undefined) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      dispatch({ type: "play", move, auto });
      emitFeedback("foundation");
    }, stepMs);
    return () => {
      clearTimeout(timeout);
    };
  }, [auto, dispatch, finishing, state, stepMs, variant]);
}
