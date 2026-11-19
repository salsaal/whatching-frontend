import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatDayKey,
  formatLanguage,
  formatTimezone,
  getInitials,
  humanizeTemplateName
} from "./displayFormat";

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("Riya Shah")).toBe("RS");
    expect(getInitials("riya shah kumar")).toBe("RS");
    expect(getInitials("Customer")).toBe("C");
  });

  it("skips symbols, so a handle still gets a letter", () => {
    expect(getInitials("@riya_shah")).toBe("R");
  });

  it("is empty for a phone number, so the caller can show an icon", () => {
    expect(getInitials("+91 98765 43210")).toBe("");
    expect(getInitials("")).toBe("");
    expect(getInitials(undefined)).toBe("");
  });

  it("handles letters outside English", () => {
    expect(getInitials("राहुल शर्मा")).toBe("रश");
  });
});

describe("dates", () => {
  const date = new Date(2026, 10, 9, 15, 23);

  it("uses one date style", () => {
    expect(formatDate(date)).toBe("9 Nov 2026");
    expect(formatDate(date.toISOString())).toBe("9 Nov 2026");
    expect(formatDate(null)).toBe("-");
    expect(formatDate("not a date")).toBe("-");
  });

  it("adds the time in the same style", () => {
    expect(formatDateTime(date)).toBe("9 Nov 2026, 3:23 pm");
  });

  it("reads analytics day keys as that local day", () => {
    expect(formatDayKey("2026-10-22")).toBe("22 Oct");
    expect(formatDayKey("2026-10-22", true)).toBe("22 Oct 2026");
    expect(formatDayKey("Delivered")).toBe("Delivered");
  });
});

describe("formatTimezone", () => {
  it("uses the short name people know", () => {
    expect(formatTimezone("Asia/Calcutta")).toBe("IST");
    expect(formatTimezone("Asia/Kolkata")).toBe("IST");
  });

  it("falls back to the city and offset when there's no short name", () => {
    const value = formatTimezone("America/Sao_Paulo");
    expect(value === "BRT" || value === "Sao Paulo (GMT-3)").toBe(true);
  });

  it("returns unknown zones unchanged", () => {
    expect(formatTimezone("Not/AZone")).toBe("Not/AZone");
    expect(formatTimezone("")).toBe("");
  });
});

describe("formatLanguage", () => {
  it("names template languages", () => {
    expect(formatLanguage("en_US")).toBe("English (US)");
    expect(formatLanguage("en")).toBe("English");
    expect(formatLanguage("hi")).toBe("Hindi");
    expect(formatLanguage("pt_BR")).toBe("Portuguese (BR)");
  });

  it("returns unknown codes unchanged", () => {
    expect(formatLanguage("zz_ZZ")).toBe("zz_ZZ");
    expect(formatLanguage("")).toBe("");
  });
});

describe("humanizeTemplateName", () => {
  it("turns a template's Meta name into words", () => {
    expect(humanizeTemplateName("Festive_Template_Amidex")).toBe(
      "Festive template amidex"
    );
    expect(humanizeTemplateName("whatching__intro")).toBe("Whatching intro");
    expect(humanizeTemplateName("")).toBe("");
  });
});
