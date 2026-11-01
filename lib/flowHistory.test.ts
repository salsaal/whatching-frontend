import { describe, expect, it } from "vitest";

import {
  emptyHistory,
  HISTORY_LIMIT,
  recordHistory,
  redoHistory,
  undoHistory
} from "./flowHistory";

describe("flow history", () => {
  it("undoes to the state before the change and redoes back", () => {
    const recorded = recordHistory(emptyHistory<string>(), "before");
    const undone = undoHistory(recorded, "after");
    expect(undone?.snapshot).toBe("before");
    const redone = redoHistory(undone!.history, "before");
    expect(redone?.snapshot).toBe("after");
    expect(redone?.history.past).toEqual(["before"]);
  });

  it("returns null when there is nothing to undo or redo", () => {
    expect(undoHistory(emptyHistory<string>(), "now")).toBeNull();
    expect(redoHistory(emptyHistory<string>(), "now")).toBeNull();
  });

  it("a new change clears redo", () => {
    const undone = undoHistory(recordHistory(emptyHistory<string>(), "a"), "b");
    const changed = recordHistory(undone!.history, "a");
    expect(changed.future).toEqual([]);
  });

  it("keeps at most 50 steps", () => {
    let history = emptyHistory<number>();
    for (let step = 0; step < HISTORY_LIMIT + 10; step += 1) {
      history = recordHistory(history, step);
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(10);
  });
});
