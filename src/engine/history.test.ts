import { describe, expect, it } from "vitest";
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from "./history.ts";

describe("history", () => {
  it("undoes and redoes", () => {
    let history = createHistory(0);
    history = pushHistory(history, 1);
    history = pushHistory(history, 2);
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);
    history = undo(history);
    expect(history.present).toBe(1);
    history = undo(history);
    expect(history.present).toBe(0);
    expect(canUndo(history)).toBe(false);
    expect(undo(history)).toBe(history);
    history = redo(redo(history));
    expect(history.present).toBe(2);
    expect(redo(history)).toBe(history);
  });

  it("clears the redo stack on a new entry", () => {
    let history = pushHistory(pushHistory(createHistory("a"), "b"), "c");
    history = pushHistory(undo(history), "d");
    expect(history.past).toEqual(["a", "b"]);
    expect(history.present).toBe("d");
    expect(canRedo(history)).toBe(false);
  });
});
