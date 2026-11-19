import { describe, expect, it } from "vitest";

import { describeTrend, fillDailyGaps } from "./analyticsFormat";

const trend = (current: number, previous: number) => ({
  current,
  previous,
  changePercent: 0
});

describe("fillDailyGaps", () => {
  const empty = (date: string) => ({ date, count: 0 });

  it("adds the quiet days between the ones Meta reported", () => {
    expect(
      fillDailyGaps(
        [
          { date: "2026-10-24", count: 3 },
          { date: "2026-10-27", count: 1 }
        ],
        "2026-10-23",
        "2026-10-28",
        empty
      )
    ).toEqual([
      { date: "2026-10-23", count: 0 },
      { date: "2026-10-24", count: 3 },
      { date: "2026-10-25", count: 0 },
      { date: "2026-10-26", count: 0 },
      { date: "2026-10-27", count: 1 },
      { date: "2026-10-28", count: 0 }
    ]);
  });

  it("crosses month ends", () => {
    expect(
      fillDailyGaps([], "2026-10-31", "2026-11-01", empty).map(
        (row) => row.date
      )
    ).toEqual(["2026-10-31", "2026-11-01"]);
  });

  it("leaves the rows alone without a usable range", () => {
    const rows = [{ date: "2026-10-24", count: 3 }];
    expect(fillDailyGaps(rows, undefined, "2026-10-28", empty)).toBe(rows);
    expect(fillDailyGaps(rows, "2026-10-28", "2026-10-01", empty)).toBe(rows);
  });
});

describe("describeTrend", () => {
  it("says nothing when both periods are empty", () => {
    expect(describeTrend(trend(0, 0))).toBeNull();
    expect(describeTrend(undefined)).toBeNull();
  });

  it("marks a figure that started from nothing as new", () => {
    expect(describeTrend(trend(12, 0))?.label).toBe("New");
  });

  it("shows both numbers when the base is small", () => {
    expect(describeTrend(trend(86, 5))).toMatchObject({
      label: "86 vs 5",
      direction: "up"
    });
  });

  it("shows both numbers for a huge swing", () => {
    expect(describeTrend(trend(5000, 1000))?.label).toBe("5,000 vs 1,000");
  });

  it("uses a whole percentage otherwise", () => {
    expect(describeTrend(trend(112, 100))?.label).toBe("+12%");
    expect(describeTrend(trend(80, 100))).toMatchObject({
      label: "-20%",
      direction: "down"
    });
    expect(describeTrend(trend(100, 100))?.label).toBe("No change");
  });

  it("moves rates in points", () => {
    expect(describeTrend(trend(96.4, 12.2), "rate")).toMatchObject({
      label: "+84.2 pts",
      direction: "up",
      title: "12.2% in the previous period"
    });
    expect(describeTrend(trend(90, 95), "rate")?.label).toBe("-5 pts");
  });
});
