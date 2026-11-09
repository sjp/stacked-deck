import type { Step } from "../engine/game.ts";
import { replay } from "../engine/game.ts";
import type { History } from "../engine/history.ts";
import type { Move, OptionValue, VariantOptions } from "../engine/types.ts";
import type { Variant } from "../engine/variant.ts";
import type { Game } from "./useGame.ts";

/**
 * A game in progress, stored as its seed and the moves made rather than full states. The
 * moves include automatic ones, so rebuilding doesn't depend on settings.
 */
export interface SavedGame {
  readonly variant: string;
  readonly seed: number;
  readonly options: VariantOptions;
  /** Every history entry's moves, oldest first, including undone ones. */
  readonly steps: readonly (readonly Move[])[];
  /** Index of the current entry in `steps`. */
  readonly cursor: number;
  readonly undos: number;
  readonly hints: number;
  readonly elapsedMs: number;
}

export interface SaveExtras {
  readonly hints: number;
  readonly elapsedMs: number;
}

export function toSaved(game: Game, extras: SaveExtras): SavedGame {
  const entries = [...game.history.past, game.history.present, ...game.history.future];
  return {
    variant: game.variant.id,
    seed: game.seed,
    options: game.options,
    steps: entries.map((step) => step.moves),
    cursor: game.history.past.length,
    undos: game.undos,
    hints: extras.hints,
    elapsedMs: extras.elapsedMs,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

function parseMove(value: unknown): Move | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const kind = value["kind"];
  if (kind === "draw" || kind === "recycle") {
    return { kind };
  }
  if (kind === "flip" && isString(value["pile"])) {
    return { kind, pile: value["pile"] };
  }
  const { from, to, index, piles } = value;
  if (kind === "move" && isString(from) && isString(to) && isCount(index)) {
    return { kind, from, index, to };
  }
  if (kind === "remove" && Array.isArray(piles) && piles.every((pile) => isString(pile))) {
    return { kind, piles };
  }
  return undefined;
}

function parseSteps(value: unknown): Move[][] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const steps: Move[][] = [];
  for (const step of value) {
    if (!Array.isArray(step)) {
      return undefined;
    }
    const moves = step.map((move) => parseMove(move));
    if (moves.some((move) => move === undefined)) {
      return undefined;
    }
    steps.push(moves.filter((move) => move !== undefined));
  }
  return steps;
}

function parseOptions(value: unknown): VariantOptions | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const options: Record<string, OptionValue> = {};
  for (const [key, option] of Object.entries(value)) {
    if (typeof option !== "string" && typeof option !== "number" && typeof option !== "boolean") {
      return undefined;
    }
    options[key] = option;
  }
  return options;
}

/** Checks the shape of untrusted saved data. */
export function parseSaved(data: unknown): SavedGame | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const { variant, seed, cursor, undos, hints, elapsedMs } = data;
  const options = parseOptions(data["options"]);
  const steps = parseSteps(data["steps"]);
  if (
    !isString(variant) ||
    !isCount(seed) ||
    options === undefined ||
    steps === undefined ||
    !isCount(cursor) ||
    cursor >= steps.length ||
    !isCount(undos) ||
    !isCount(hints) ||
    !isCount(elapsedMs)
  ) {
    return undefined;
  }
  return { variant, seed, options, steps, cursor, undos, hints, elapsedMs };
}

/** Rebuilds a game by replaying its moves; undefined if they no longer apply. */
export function restoreGame(variant: Variant, saved: SavedGame): Game | undefined {
  if (saved.variant !== variant.id) {
    return undefined;
  }
  try {
    const dealt = variant.deal(saved.seed, saved.options);
    if (dealt.seed !== saved.seed) {
      return undefined;
    }
    const states = replay(variant, dealt, saved.steps);
    const entries: Step[] = saved.steps.map((moves, index) => {
      const state = states[index];
      if (state === undefined) {
        throw new Error("Missing state");
      }
      return { moves, state };
    });
    const present = entries[saved.cursor];
    if (present === undefined) {
      return undefined;
    }
    const history: History<Step> = {
      past: entries.slice(0, saved.cursor),
      present,
      future: entries.slice(saved.cursor + 1),
    };
    return { variant, seed: saved.seed, options: dealt.options, history, undos: saved.undos };
  } catch {
    return undefined;
  }
}
