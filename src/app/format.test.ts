import { describe, expect, it } from "vitest";
import { formatTime } from "./format.ts";

describe("formatTime", () => {
  it.each([
    [0, "0:00"],
    [999, "0:00"],
    [61_000, "1:01"],
    [599_000, "9:59"],
    [3_723_000, "1:02:03"],
    [-5, "0:00"],
  ])("formats %i ms as %s", (ms, text) => {
    expect(formatTime(ms)).toBe(text);
  });
});
