import type { GameState, Move, VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions } from "../engine/variant.ts";

export type SolverRequest =
  | {
      readonly type: "deal";
      readonly id: number;
      readonly variant: string;
      readonly options: VariantOptions;
      /** Total time to spend trying seeds. */
      readonly budgetMs: number;
      readonly perSeedMs: number;
    }
  | {
      readonly type: "hint";
      readonly id: number;
      readonly variant: string;
      readonly state: GameState;
      /** The player's automatic moves, which the position on screen already has. */
      readonly auto: AutoMoveOptions;
      readonly budgetMs: number;
    };

/** Tells the worker to skip a request it hasn't started. */
export interface CancelMessage {
  readonly type: "cancel";
  readonly id: number;
}

export type SolverMessage = SolverRequest | CancelMessage;

export type SolverResponse =
  | { readonly type: "deal"; readonly id: number; readonly seed: number | undefined }
  /** A winning line from the hint's position, if one was found in time. */
  | { readonly type: "hint"; readonly id: number; readonly moves: readonly Move[] | undefined }
  | { readonly type: "error"; readonly id: number; readonly message: string };
