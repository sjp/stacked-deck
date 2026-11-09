import { dealKey } from "../engine/dealKey.ts";
import type { VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import { WINNABLE_SEEDS } from "../engine/winnableSeeds.ts";
import type { LoadedGame } from "./gameStore.ts";
import { loadSavedGame } from "./gameStore.ts";
import { solveRandomDeal } from "./solverClient.ts";
import { optionsFromParams } from "./dealLink.ts";
import { sameOptions } from "./settings.ts";
import { hasStarted, newGame } from "./useGame.ts";

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

/** Whether winnable deals can be offered for these options (solved now, or from the list). */
export function winnableAvailable(variant: Variant, options: VariantOptions): boolean {
  const key = dealKey(variant, options);
  return SOLVE_AT_RUNTIME.has(key) || (WINNABLE_SEEDS[key]?.length ?? 0) > 0;
}

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

/** A deal link read from the URL: its seed and its options as raw text. */
export interface DealLink {
  readonly seed: number;
  readonly params: Readonly<Record<string, string>>;
}

/** A linked deal with its options resolved. */
export interface LinkedDeal {
  readonly seed: number;
  readonly options: VariantOptions;
}

export interface OpenedGame extends LoadedGame {
  /** A linked deal waiting for the player to agree to replace the game in progress. */
  readonly pendingLink?: LinkedDeal | undefined;
}

/**
 * The game to open: the saved game for a variant, or else a new deal of a listed winnable
 * seed (instant, so the first screen needs no wait) or a random one. A linked deal is
 * dealt at once unless it would replace a game in progress; then the saved game opens
 * and the link waits for the player to confirm. Options the link doesn't give (or gives
 * wrongly) come from `options`, the player's own.
 */
export function loadGame(
  variant: Variant,
  dealLink: DealLink | undefined,
  options: VariantOptions,
  auto: AutoMoveOptions,
  winnableOnly: boolean,
): OpenedGame {
  const saved = loadSavedGame(variant);
  if (dealLink === undefined) {
    if (saved !== undefined) {
      return saved;
    }
    const dealSeed = winnableOnly ? listedSeed(variant, options) : undefined;
    return { game: newGame(variant, dealSeed, options, auto), hints: 0, elapsedMs: 0 };
  }
  const link = {
    seed: dealLink.seed,
    options: optionsFromParams(variant, dealLink.params, options),
  };
  if (saved !== undefined) {
    if (saved.game.seed === link.seed && sameOptions(saved.game.options, link.options)) {
      return saved;
    }
    if (hasStarted(saved.game)) {
      return { ...saved, pendingLink: link };
    }
  }
  return { game: newGame(variant, link.seed, link.options, auto), hints: 0, elapsedMs: 0 };
}
