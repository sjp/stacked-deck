import { describe, expect, it } from "vitest";
import { allOptionSets, dealKey } from "./dealKey.ts";
import type { GameState } from "./types.ts";
import { VARIANTS } from "./variants/index.ts";

/** FNV-1a, enough to notice any change in a deal. */
function hash(text: string): string {
  let value = 0x81_1c_9d_c5;
  for (let i = 0; i < text.length; i++) {
    value = Math.imul(value ^ (text.codePointAt(i) ?? 0), 0x01_00_01_93) >>> 0;
  }
  return value.toString(16).padStart(8, "0");
}

/** Recorded from the current deal code; update only on purpose, with the seed lists. */
/** Every card's place, id, rank, suit and face. */
function describeDeal(state: GameState): string {
  return state.piles
    .map((pile) => {
      const cards = pile.cards.map(
        (card) => `${card.id}.${card.rank}${card.suit[0]}${card.faceUp ? "+" : "-"}`,
      );
      return `${pile.id}:${cards.join(",")}`;
    })
    .join("|");
}

const FINGERPRINTS: Readonly<Record<string, string>> = {
  "klondike:draw=1": "d6287a16 38cc0e5a 65216912",
  "klondike:draw=3": "d6287a16 38cc0e5a 65216912",
  "spider:suits=1": "2dd8025e 527e25ec 513c618c",
  "spider:suits=2": "7ff54232 0d00827a f22f1c5e",
  "spider:suits=4": "9503188e e6f041a2 06d2d93e",
  freecell: "765037a9 274f7011 b8e426c7",
  "pyramid:passes=3": "f7d9646d c977cc07 a4590565",
  "pyramid:passes=0": "f7d9646d c977cc07 a4590565",
  "tripeaks:wrap=true": "8a14e92f 73176a99 46201b99",
  "tripeaks:wrap=false": "8a14e92f 73176a99 46201b99",
  "golf:wrap=false:onKing=false": "f0cc7f10 b0847bee c4a9ba62",
  "golf:wrap=false:onKing=true": "f0cc7f10 b0847bee c4a9ba62",
  "golf:wrap=true:onKing=false": "f0cc7f10 b0847bee c4a9ba62",
  "golf:wrap=true:onKing=true": "f0cc7f10 b0847bee c4a9ba62",
};

describe("deals", () => {
  // The bundled winnable seeds, shared deal links and saved games all rely on a seed
  // always dealing the same cards. Changing the shuffle or the deal breaks them.
  it.each(
    VARIANTS.flatMap((variant) =>
      allOptionSets(variant).map(
        (options) => [dealKey(variant, options), variant, options] as const,
      ),
    ),
  )("stay the same for the same seed (%s)", (key, variant, options) => {
    const prints = [1, 2, 3_000_000_000].map((seed) =>
      hash(describeDeal(variant.deal(seed, options))),
    );
    expect(prints.join(" ")).toBe(FINGERPRINTS[key]);
  });
});
