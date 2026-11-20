import { describe, expect, it } from "vitest";

import type { QuickReply } from "@/client-api/types/quickReplies.type";

import {
  findSlashQuery,
  firstLine,
  insertQuickReply,
  matchQuickReplies,
  normalizeShortcut,
  shortcutProblem
} from "./quickReplies";

const reply = (shortcut: string, title: string): QuickReply => ({
  id: shortcut,
  shortcut,
  title,
  text: `${title} text`,
  createdAt: "",
  updatedAt: ""
});

describe("normalizeShortcut and shortcutProblem", () => {
  it("matches what the server stores", () => {
    expect(normalizeShortcut(" /Thanks ")).toBe("thanks");
    expect(normalizeShortcut("price-list")).toBe("price-list");
  });

  it("explains a bad shortcut in plain words", () => {
    expect(shortcutProblem("/thanks")).toBe("");
    expect(shortcutProblem("")).toMatch(/Add a shortcut/);
    expect(shortcutProblem("thank you")).toMatch(/no spaces/);
    expect(shortcutProblem("a".repeat(31))).toMatch(/30 characters/);
  });
});

describe("findSlashQuery", () => {
  it("finds a slash word at the start or after a space", () => {
    expect(findSlashQuery("/tha", 4)).toEqual({ start: 0, query: "tha" });
    expect(findSlashQuery("Hi /Price", 9)).toEqual({
      start: 3,
      query: "price"
    });
    expect(findSlashQuery("/", 1)).toEqual({ start: 0, query: "" });
  });

  it("ignores slashes inside words and finished words", () => {
    expect(findSlashQuery("and/or", 6)).toBeNull();
    expect(findSlashQuery("/thanks ", 8)).toBeNull();
    expect(findSlashQuery("see https://x.com/a", 19)).toBeNull();
  });

  it("only looks up to the cursor", () => {
    expect(findSlashQuery("/thanks for", 4)).toEqual({
      start: 0,
      query: "tha"
    });
  });
});

describe("matchQuickReplies", () => {
  const replies = [
    reply("address", "Shop address"),
    reply("hours", "Opening hours"),
    reply("thanks", "Thank you"),
    reply("shop-hours", "Weekend timings")
  ];

  it("puts shortcut prefixes first, then other matches", () => {
    expect(matchQuickReplies(replies, "hour").map((r) => r.shortcut)).toEqual([
      "hours",
      "shop-hours"
    ]);
    expect(matchQuickReplies(replies, "shop").map((r) => r.shortcut)).toEqual([
      "shop-hours",
      "address"
    ]);
  });

  it("shows the first few when nothing is typed yet", () => {
    expect(matchQuickReplies(replies, "", 2)).toHaveLength(2);
  });
});

describe("insertQuickReply", () => {
  it("replaces the slash word and moves the cursor after the reply", () => {
    expect(
      insertQuickReply("Hi /tha there", { start: 3 }, 7, "Thank you!")
    ).toEqual({ text: "Hi Thank you! there", caret: 13 });
  });
});

describe("firstLine", () => {
  it("skips blank lines", () => {
    expect(firstLine("\n  Hello\nsecond")).toBe("Hello");
    expect(firstLine("")).toBe("");
  });
});
