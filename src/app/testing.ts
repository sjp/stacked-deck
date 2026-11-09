import { createHistory, pushHistory } from "../engine/history.ts";
import { makeState } from "../engine/testing.ts";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { Game } from "./useGame.ts";
import type { Timer } from "./useTimer.ts";

const FULL = "A 2 3 4 5 6 7 8 9 10 J Q K".split(" ");
const suit = (code: string, ranks = FULL) => ranks.map((rank) => `${rank}${code}`).join(" ");

/** A Klondike game one move in: won, or with the 5 of hearts still on the waste. */
export function gameOn(won: boolean): Game {
  const hearts = won ? suit("H") : suit("H", FULL.slice(0, 4));
  const state = makeState(
    "klondike",
    [
      { id: "stock", kind: "stock" },
      { id: "waste", kind: "waste", cards: won ? "" : "5H" },
      { id: "f0", kind: "foundation", cards: suit("S") },
      { id: "f1", kind: "foundation", cards: hearts },
      { id: "f2", kind: "foundation", cards: suit("D") },
      { id: "f3", kind: "foundation", cards: suit("C") },
      { id: "t0", kind: "tableau" },
    ],
    { draw: 1 },
  );
  const start = { moves: [], state };
  return {
    variant: klondike,
    seed: 1,
    options: { draw: 1 },
    history: pushHistory(createHistory(start), start),
    undos: 0,
  };
}

/** A timer stub reading the time from `read`. */
export function timerAt(read: () => number): Timer {
  return { elapsed: read, running: () => true, start: () => {}, pause: () => {}, reset: () => {} };
}
