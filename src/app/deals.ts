import { dealKey } from "../engine/dealKey.ts";
import type { VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import { WINNABLE_SEEDS } from "../engine/winnableSeeds.ts";
import type { LoadedGame } from "./gameStore.ts";
import { loadSavedGame } from "./gameStore.ts";
import { solveRandomDeal } from "./solverClient.ts";
import { newGame } from "./useGame.ts";

/**
 * Option sets the solver usually wins within a fraction of a second on a phone. Others
 * (Spider with more suits, Klondike Draw 3, Pyramid, Golf) use the bundled lists.
 */
const SOLVE_AT_RUNTIME = new Set([
  "klondike:draw=1",
  "spider:suits=1",
  "freecell",
  "tripeaks:wrap=true",
  "tripeaks:wrap=false",
]);
const RUNTIME_BUDGET_MS = 700;
const PER_SEED_MS = 150;

/** A random seed from the bundled list of deals the solver has won, if there is one. */
export function listedSeed(
  variant: Variant,
  options: VariantOptions,
  random: () => number = Math.random,
): number | undefined {
  const seeds = WINNABLE_SEEDS[dealKey(variant, options)] ?? [];
  return seeds[Math.floor(random() * seeds.length)];
}

/**
 * A seed for a winnable deal: solved fresh in a worker where that's fast, otherwise from
 * the bundled list. Undefined (a random deal) only if neither has one.
 */
export async function findWinnableSeed(
  variant: Variant,
  options: VariantOptions,
): Promise<number | undefined> {
  if (SOLVE_AT_RUNTIME.has(dealKey(variant, options))) {
    const seed = await solveRandomDeal(variant.id, options, RUNTIME_BUDGET_MS, PER_SEED_MS);
    if (seed !== undefined) {
      return seed;
    }
  }
  return listedSeed(variant, options);
}

/**
 * The saved game for a variant, or else a new deal: the requested seed, a listed winnable
 * one (instant, so the first screen needs no wait), or a random one.
 */
export function loadGame(
  variant: Variant,
  seed: number | undefined,
  options: VariantOptions,
  auto: AutoMoveOptions,
  winnableOnly: boolean,
): LoadedGame {
  const saved = loadSavedGame(variant, seed);
  if (saved !== undefined) {
    return saved;
  }
  const dealSeed = seed ?? (winnableOnly ? listedSeed(variant, options) : undefined);
  return { game: newGame(variant, dealSeed, options, auto), hints: 0, elapsedMs: 0 };
}
