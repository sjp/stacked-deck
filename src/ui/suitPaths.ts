import type { Suit } from "../engine/cards.ts";

/** Suit shapes drawn in a 100×100 box, so they look the same on every platform. */
export const SUIT_PATHS: Readonly<Record<Suit, readonly string[]>> = {
  hearts: [
    "M50 92C22 70 3 52 3 30 3 14 15 3 29 3c9 0 17 5 21 13 4-8 12-13 21-13 14 0 26 11 26 27 0 22-19 40-47 62Z",
  ],
  diamonds: ["M50 2 88 50 50 98 12 50Z"],
  spades: [
    "M50 2C38 24 4 40 4 64c0 14 11 23 23 23 9 0 15-4 19-10-1 9-6 15-14 21h36c-8-6-13-12-14-21 4 6 10 10 19 10 12 0 23-9 23-23C96 40 62 24 50 2Z",
  ],
  clubs: [
    "M50 6a21 21 0 1 1 0 42 21 21 0 1 1 0-42Z",
    "M27 40a21 21 0 1 1 0 42 21 21 0 1 1 0-42Z",
    "M73 40a21 21 0 1 1 0 42 21 21 0 1 1 0-42Z",
    "M42 40h16v26H42Z",
    "M46 60c0 16-6 28-14 38h36c-8-10-14-22-14-38Z",
  ],
};
