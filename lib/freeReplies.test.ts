import { describe, expect, it } from "vitest";

import {
  formatResetDay,
  freeRepliesFooter,
  freeRepliesSubtitle,
  freeReplyRow
} from "@/lib/freeReplies";

const now = new Date("2026-11-22T09:00:00Z");

describe("free replies wording", () => {
  it("names the day the allowance starts again", () => {
    expect(formatResetDay("2026-12-01")).toBe("1 December");
    expect(freeRepliesSubtitle(1000, "2026-12-01")).toBe(
      "WhatsApp gives each number 1,000 free replies a month. Starts again on 1 December."
    );
  });

  it("says when the counts were updated, once there are any", () => {
    expect(freeRepliesFooter(1000, "2026-11-22T06:00:00Z", now)).toBe(
      "After 1,000, WhatsApp (Meta) charges for each reply at its rate for the customer's country. Updated 3 h ago. These counts are close estimates; Meta's own count is final."
    );
    expect(freeRepliesFooter(1000, now.toISOString(), now)).toContain(
      "Updated just now."
    );
    expect(freeRepliesFooter(1000, null, now)).not.toContain("Updated");
  });
});

describe("freeReplyRow", () => {
  const row = (
    state: "ok" | "nearly_used" | "used_up",
    used: number,
    charged = 0
  ) =>
    freeReplyRow(
      {
        state,
        freeRepliesUsed: used,
        freeRepliesLeft: 1000 - used,
        chargedReplies: charged
      },
      1000
    );

  it("shows the count without a warning while there's plenty left", () => {
    const ok = row("ok", 412);
    expect(ok).toMatchObject({ used: "412 of 1,000 used", tone: "ok" });
    expect(ok.percent).toBeCloseTo(41.2);
    expect(ok.note).toBeUndefined();
  });

  it("warns from 800 with what's left", () => {
    expect(row("nearly_used", 812).note).toBe("188 free replies left");
    expect(row("nearly_used", 999).note).toBe("1 free reply left");
  });

  it("says when they're all used, with any charged replies", () => {
    expect(row("used_up", 1000, 37)).toMatchObject({
      used: "1,000 of 1,000 used",
      percent: 100,
      tone: "used_up",
      note: "All free replies used · 37 charged replies so far"
    });
    expect(row("used_up", 1000, 1).note).toBe(
      "All free replies used · 1 charged reply so far"
    );
    expect(row("used_up", 1000).note).toBe("All free replies used");
  });
});
