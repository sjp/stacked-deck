import type { Variant } from "../engine/variant.ts";
import type { SaveExtras } from "./savedGame.ts";
import { parseSaved, restoreGame, toSaved } from "./savedGame.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";
import type { Game } from "./useGame.ts";

/** Daily deals have their own slot, so playing one never replaces a game in progress. */
export const gameKey = (variantId: string, daily = false): string =>
  daily ? `game:${variantId}:daily` : `game:${variantId}`;

export interface LoadedGame {
  readonly game: Game;
  readonly hints: number;
  readonly elapsedMs: number;
}

/** The saved game for a variant (or its daily deal), unless a different deal was asked for. */
export function loadSavedGame(
  variant: Variant,
  seed: number | undefined,
  daily?: string,
): LoadedGame | undefined {
  const saved = parseSaved(readStored(gameKey(variant.id, daily !== undefined)));
  if (saved === undefined || (seed !== undefined && seed !== saved.seed) || saved.daily !== daily) {
    return undefined;
  }
  const game = restoreGame(variant, saved);
  return game === undefined ? undefined : { game, hints: saved.hints, elapsedMs: saved.elapsedMs };
}

export function saveGame(game: Game, extras: SaveExtras): void {
  writeStored(gameKey(game.variant.id, extras.daily !== undefined), toSaved(game, extras));
}

export function clearGame(variantId: string, daily = false): void {
  removeStored(gameKey(variantId, daily));
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
