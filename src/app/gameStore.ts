import type { VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import type { SaveExtras } from "./savedGame.ts";
import { parseSaved, restoreGame, toSaved } from "./savedGame.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";
import type { Game } from "./useGame.ts";
import { newGame } from "./useGame.ts";

export const gameKey = (variantId: string): string => `game:${variantId}`;

export interface LoadedGame {
  readonly game: Game;
  readonly hints: number;
  readonly elapsedMs: number;
}

/** The saved game for a variant, or a new deal if there is none (or it's for another seed). */
export function loadGame(
  variant: Variant,
  seed: number | undefined,
  options: VariantOptions,
  auto: AutoMoveOptions,
): LoadedGame {
  const saved = parseSaved(readStored(gameKey(variant.id)));
  if (saved !== undefined && (seed === undefined || seed === saved.seed)) {
    const game = restoreGame(variant, saved);
    if (game !== undefined) {
      return { game, hints: saved.hints, elapsedMs: saved.elapsedMs };
    }
  }
  return { game: newGame(variant, seed, options, auto), hints: 0, elapsedMs: 0 };
}

export function saveGame(game: Game, extras: SaveExtras): void {
  writeStored(gameKey(game.variant.id), toSaved(game, extras));
}

export function clearGame(variantId: string): void {
  removeStored(gameKey(variantId));
}

/** Variants with a saved game that has at least one move. */
export function variantsInProgress(variants: readonly Variant[]): Set<string> {
  const ids = new Set<string>();
  for (const variant of variants) {
    const saved = parseSaved(readStored(gameKey(variant.id)));
    if (saved !== undefined && saved.steps.length > 1) {
      ids.add(variant.id);
    }
  }
  return ids;
}
