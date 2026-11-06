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
      "#/play/golf?seed=5&daily=2026-11-06",
      { name: "play", variant: "golf", seed: 5, daily: "2026-11-06" },
    ],
    ["#/play/golf?daily=2026-11-06", { name: "play", variant: "golf" }],
    ["#/play/golf?seed=5&daily=today", { name: "play", variant: "golf", seed: 5 }],
    ["#/daily", { name: "daily" }],
    ["#/stats", { name: "stats" }],
  ])("parses %s", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it("round-trips", () => {
    for (const hash of [
      "#/",
      "#/play/klondike",
      "#/play/golf?seed=9",
      "#/play/golf?seed=9&daily=2026-01-31",
      "#/stats",
      "#/daily",
    ]) {
      expect(routeHash(parseRoute(hash))).toBe(hash);
    }
  });
});
