import { describe, expect, it } from "vitest";
import { parseRoute, routeHash } from "./route.ts";

describe("routes", () => {
  it.each([
    ["", { name: "home" }],
    ["#/", { name: "home" }],
    ["#/nowhere", { name: "home" }],
    ["#/play/klondike", { name: "play", variant: "klondike" }],
    ["#/play/spider?seed=123", { name: "play", variant: "spider", seed: 123 }],
    ["#/play/spider?seed=-4", { name: "play", variant: "spider" }],
    ["#/play/spider?seed=abc", { name: "play", variant: "spider" }],
    [
      "#/play/klondike?seed=5&draw=3",
      { name: "play", variant: "klondike", seed: 5, options: { draw: "3" } },
    ],
    ["#/play/klondike?draw=3", { name: "play", variant: "klondike" }],
    // Links from older versions: retired pages go home.
    ["#/daily", { name: "home" }],
    ["#/stats", { name: "stats" }],
  ])("parses %s", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it("round-trips", () => {
    for (const hash of [
      "#/",
      "#/play/klondike",
      "#/play/golf?seed=9",
      "#/play/spider?seed=9&suits=4",
      "#/stats",
    ]) {
      expect(routeHash(parseRoute(hash))).toBe(hash);
    }
  });
});
