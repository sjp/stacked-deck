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
      /** The first seed from `start` that the solver wins within `maxNodes`, so the answer is the same on every device. */
      readonly type: "first";
      readonly id: number;
      readonly variant: string;
      readonly options: VariantOptions;
      readonly start: number;
      readonly count: number;
      readonly maxNodes: number;
    }
  | {
      readonly type: "hint";
      readonly id: number;
      readonly variant: string;
      readonly state: GameState;
      readonly budgetMs: number;
    };

export type SolverResponse =
  | { readonly type: "deal" | "first"; readonly id: number; readonly seed: number | undefined }
  | { readonly type: "hint"; readonly id: number; readonly move: Move | undefined };
