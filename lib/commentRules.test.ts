import { describe, expect, it } from "vitest";

import { describeCommentRule, repliesToEveryComment } from "./commentRules";

const rule = (overrides = {}) => ({
  keywords: [] as string[],
  keywordMode: "any" as const,
  scope: "all_media" as const,
  mediaIds: [] as string[],
  sendPublicReply: true,
  sendPrivateReply: true,
  ...overrides
});

describe("describeCommentRule", () => {
  it("says plainly when every comment gets a reply", () => {
    expect(describeCommentRule(rule())).toBe(
      "Replies publicly and by DM to any comment on all your posts."
    );
    expect(repliesToEveryComment(rule())).toBe(true);
    expect(repliesToEveryComment(rule({ keywords: [" "] }))).toBe(true);
  });

  it("lists keywords with or/and", () => {
    expect(
      describeCommentRule(
        rule({ keywords: ["price", "cost", "rate"], sendPrivateReply: false })
      )
    ).toBe(
      'Replies publicly to comments containing "price", "cost" or "rate" on all your posts.'
    );
    expect(
      describeCommentRule(
        rule({
          keywords: ["size", "chart"],
          keywordMode: "all",
          sendPublicReply: false,
          scope: "specific_media",
          mediaIds: ["a"]
        })
      )
    ).toBe(
      'Replies by DM to comments containing "size" and "chart" on 1 selected post.'
    );
  });

  it("handles a single keyword", () => {
    expect(
      describeCommentRule(
        rule({
          keywords: ["link"],
          scope: "specific_media",
          mediaIds: ["a", "b"]
        })
      )
    ).toBe(
      'Replies publicly and by DM to comments containing "link" on 2 selected posts.'
    );
  });
});
