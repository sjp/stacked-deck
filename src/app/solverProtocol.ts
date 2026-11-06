import type { GameState, Move, VariantOptions } from "../engine/types.ts";

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
      readonly budgetMs: number;
    };

export type SolverResponse =
  | { readonly type: "deal"; readonly id: number; readonly seed: number | undefined }
  | { readonly type: "hint"; readonly id: number; readonly move: Move | undefined };
