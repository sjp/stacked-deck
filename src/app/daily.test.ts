import { describe, expect, it } from "vitest";
import { dailyStart, dailyStreak, dateKey, monthGrid } from "./daily.ts";

describe("daily deals", () => {
  it("keys dates by the local calendar day", () => {
    expect(dateKey(new Date(2026, 10, 6, 23, 59))).toBe("2026-11-06");
    expect(dateKey(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
  });

  it("gives the same start for the same day and variant", () => {
    expect(dailyStart("2026-11-06", "klondike")).toBe(dailyStart("2026-11-06", "klondike"));
    expect(dailyStart("2026-11-06", "klondike")).not.toBe(dailyStart("2026-11-07", "klondike"));
    expect(dailyStart("2026-11-06", "klondike")).not.toBe(dailyStart("2026-11-06", "spider"));
  });

  it("counts a streak of consecutive won days", () => {
    const won = new Set(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-03"]);
    expect(dailyStreak(won, "2026-11-03")).toBe(1);
    expect(dailyStreak(won, "2026-11-02")).toBe(3);
    expect(dailyStreak(won, "2026-11-04")).toBe(1);
    expect(dailyStreak(won, "2026-11-05")).toBe(0);
  });

  it("lays out a month from Monday", () => {
    // November 2026 starts on a Sunday.
    const weeks = monthGrid(2026, 10);
    expect(weeks[0]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "2026-11-01",
    ]);
    expect(weeks.at(-1)?.at(-1)).toBe("2026-11-30");
  });
});
