import { describe, expect, it } from "vitest";

import {
  BUILT_IN_OPT_OUT_KEYWORDS,
  normalizeKeyword,
  toExtraKeywords
} from "./KeywordsSection";

describe("normalizeKeyword", () => {
  it("matches the backend: trimmed, single-spaced, uppercase", () => {
    expect(normalizeKeyword("  opt   out ")).toBe("OPT OUT");
    expect(normalizeKeyword("Bandh karo")).toBe("BANDH KARO");
  });
});

describe("toExtraKeywords", () => {
  it("drops built-ins that older orgs have stored as their defaults", () => {
    expect(
      toExtraKeywords(
        ["STOP", "UNSUBSCRIBE", "opt out", "OPTOUT", "CANCEL", "band karo"],
        BUILT_IN_OPT_OUT_KEYWORDS
      )
    ).toEqual(["BAND KARO"]);
  });

  it("de-duplicates regardless of case and spacing, and skips blanks", () => {
    expect(toExtraKeywords(["hi", "HI", " Hi ", "", "menu"])).toEqual([
      "HI",
      "MENU"
    ]);
  });
});
