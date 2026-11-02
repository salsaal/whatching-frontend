import { describe, expect, it } from "vitest";

import {
  compareMessages,
  describeHandoffReason,
  formatDayDivider,
  formatListTime,
  formatPhoneNumber,
  getCarouselCards,
  insertMessageInOrder,
  parseWhatsAppFormatting,
  rewriteSystemNote,
  stripWhatsAppFormatting
} from "./inbox";

describe("parseWhatsAppFormatting", () => {
  it("formats bold, italic, strike and mono", () => {
    expect(parseWhatsAppFormatting("Welcome to *Whatching*!")).toEqual([
      "Welcome to ",
      { type: "bold", children: ["Whatching"] },
      "!"
    ]);
    expect(parseWhatsAppFormatting("_soon_ ~old~ ```a *b*```")).toEqual([
      { type: "italic", children: ["soon"] },
      " ",
      { type: "strike", children: ["old"] },
      " ",
      { type: "mono", children: ["a *b*"] }
    ]);
  });

  it("nests markers", () => {
    expect(parseWhatsAppFormatting("*_both_*")).toEqual([
      { type: "bold", children: [{ type: "italic", children: ["both"] }] }
    ]);
  });

  it("leaves markers that aren't at word boundaries alone", () => {
    expect(parseWhatsAppFormatting("file_name_here")).toEqual([
      "file_name_here"
    ]);
    expect(parseWhatsAppFormatting("2 * 3 * 4")).toEqual(["2 * 3 * 4"]);
    expect(parseWhatsAppFormatting("* not bold *")).toEqual(["* not bold *"]);
  });

  it("strips formatting markers for previews", () => {
    expect(stripWhatsAppFormatting("Welcome to *Watching*!")).toBe(
      "Welcome to Watching!"
    );
    expect(stripWhatsAppFormatting("*_Both_* and ~old~ price")).toBe(
      "Both and old price"
    );
    expect(stripWhatsAppFormatting("file_name_here 2 * 3")).toBe(
      "file_name_here 2 * 3"
    );
    expect(stripWhatsAppFormatting("```code```")).toBe("```code```");
  });

  it("keeps markup as text", () => {
    expect(parseWhatsAppFormatting("<b>hi</b>")).toEqual(["<b>hi</b>"]);
  });
});

describe("times", () => {
  const now = new Date(2026, 10, 2, 18, 0);

  it("formats list times", () => {
    expect(formatListTime(new Date(2026, 10, 2, 16, 20), now)).toBe("4:20 pm");
    expect(formatListTime(new Date(2026, 10, 1, 23, 0), now)).toBe("Yesterday");
    expect(formatListTime(new Date(2026, 9, 29, 9, 0), now)).toBe("Thursday");
    expect(formatListTime(new Date(2026, 9, 20, 9, 0), now)).toBe("20 Oct");
    expect(formatListTime(new Date(2025, 9, 20, 9, 0), now)).toBe(
      "20 Oct 2025"
    );
  });

  it("formats day dividers", () => {
    expect(formatDayDivider(new Date(2026, 10, 2, 1, 0), now)).toBe("Today");
    expect(formatDayDivider(new Date(2026, 10, 1, 1, 0), now)).toBe(
      "Yesterday"
    );
    expect(formatDayDivider(new Date(2026, 9, 30, 1, 0), now)).toBe(
      "Fri 30 Oct"
    );
  });
});

describe("formatPhoneNumber", () => {
  it("formats numbers like the number chip", () => {
    expect(formatPhoneNumber("918777019926")).toBe("+91 87770 19926");
    expect(formatPhoneNumber("+91 87770 19926")).toBe("+91 87770 19926");
    expect(formatPhoneNumber("")).toBe("");
  });
});

describe("describeHandoffReason", () => {
  it("never shows the raw code", () => {
    expect(describeHandoffReason("ai_handoff_confirmed")).toBe(
      "Customer asked for a person"
    );
    expect(describeHandoffReason("ai_token_quota_exhausted")).toBe(
      "AI credits ran out"
    );
    expect(describeHandoffReason("marked_pending")).toBe(
      "Marked as Pending by the team"
    );
    expect(describeHandoffReason("something_new")).toBe("Asked for a person");
    expect(describeHandoffReason(null)).toBe("Asked for a person");
  });
});

describe("rewriteSystemNote", () => {
  it("rewrites older notes", () => {
    expect(rewriteSystemNote("Bot routed to flow: Main menu")).toBe(
      "Bot sent: Main menu"
    );
    expect(
      rewriteSystemNote("Instagram automation routed to node: Welcome")
    ).toBe("Bot sent: Welcome");
    expect(
      rewriteSystemNote(
        "Instagram AI fallback handled the latest customer message."
      )
    ).toBe("AI assistant replied");
    expect(
      rewriteSystemNote("AI fallback handled the latest customer message.")
    ).toBe("AI assistant replied");
  });

  it("leaves current notes alone", () => {
    const note = "Asha marked the conversation as Resolved.";
    expect(rewriteSystemNote(note)).toBe(note);
  });
});

describe("message order", () => {
  const message = (id: string, sentAt: string) => ({
    _id: id,
    sentAt,
    createdAt: sentAt
  });

  it("inserts by sentAt, then id", () => {
    const thread = [
      message("a1", "2026-11-02T10:00:00Z"),
      message("a3", "2026-11-02T10:02:00Z")
    ];
    const joined = message("a2", "2026-11-02T10:01:00Z");
    expect(insertMessageInOrder(thread, joined).map((m) => m._id)).toEqual([
      "a1",
      "a2",
      "a3"
    ]);
    const latest = message("a4", "2026-11-02T10:03:00Z");
    expect(insertMessageInOrder(thread, latest).at(-1)?._id).toBe("a4");
  });

  it("breaks ties by id", () => {
    expect(
      compareMessages(
        message("b", "2026-11-02T10:00:00Z"),
        message("a", "2026-11-02T10:00:00Z")
      )
    ).toBeGreaterThan(0);
  });
});

describe("getCarouselCards", () => {
  it("reads WhatsApp carousel cards", () => {
    const cards = getCarouselCards({
      interactive: {
        type: "carousel",
        body: { text: "Pick one" },
        action: {
          cards: [
            {
              header: { type: "image", image: { link: "https://x/1.png" } },
              body: { text: "Plan A" },
              action: {
                name: "cta_url",
                parameters: { display_text: "Learn more", url: "https://x" }
              }
            },
            {
              body: { text: "Plan B" },
              action: {
                buttons: [
                  { type: "quick_reply", quick_reply: { title: "Free trial" } }
                ]
              }
            }
          ]
        }
      }
    });
    expect(cards).toEqual([
      {
        key: "wa-0",
        mediaType: "image",
        mediaUrl: "https://x/1.png",
        title: "",
        body: "Plan A",
        buttons: ["Learn more"]
      },
      {
        key: "wa-1",
        mediaType: null,
        mediaUrl: "",
        title: "",
        body: "Plan B",
        buttons: ["Free trial"]
      }
    ]);
  });

  it("reads Instagram generic templates", () => {
    const cards = getCarouselCards({
      instagramMessage: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: "Plan A",
                subtitle: "For teams",
                image_url: "https://x/a.png",
                buttons: [{ type: "web_url", title: "Learn more" }]
              }
            ]
          }
        }
      }
    });
    expect(cards[0]).toMatchObject({
      title: "Plan A",
      body: "For teams",
      mediaUrl: "https://x/a.png",
      buttons: ["Learn more"]
    });
  });

  it("returns nothing for other messages", () => {
    expect(getCarouselCards({ text: "hi" })).toEqual([]);
  });
});
