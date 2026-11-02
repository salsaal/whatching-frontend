import { describe, expect, it } from "vitest";

import { BotCanvasVersion } from "@/client-api/types/bot.type";
import { describeVersion } from "./FlowVersionHistoryDialog";

const version = (overrides: Partial<BotCanvasVersion> = {}) => ({
  _id: "v",
  versionNumber: 12,
  publishedAt: "2026-10-31T15:02:00",
  publishedBy: { _id: "u", name: "Zaki" },
  blockCount: 33,
  isLive: false,
  ...overrides
});

describe("describeVersion", () => {
  it("says Current since only for the current version", () => {
    expect(describeVersion(version({ isLive: true }))).toBe(
      "Version 12 · Current since 31 Oct, 3:02 pm · by Zaki · 33 blocks"
    );
  });

  it("says Applied for older versions", () => {
    expect(describeVersion(version())).toBe(
      "Version 12 · Applied 31 Oct, 3:02 pm · by Zaki · 33 blocks"
    );
  });
});
