import { describe, expect, it } from "vitest";

import {
  UNSUPPORTED_MESSAGE_PREVIEW,
  collectReactions,
  compareMessages,
  describeHandoffReason,
  describeLastMessage,
  describeReaction,
  describeUnsupportedMessage,
  formatDayDivider,
  formatListTime,
  formatPhoneNumber,
  getCarouselCards,
  insertMessageInOrder,
  isReactionMessage,
  isUnsupportedMessageText,
  parseWhatsAppFormatting,
  rewriteSystemNote,
  stripWhatsAppFormatting,
  formatWhatsAppUsername,
  subscriberName,
  subscriberSubtitle,
  whatsappContactLine
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

describe("unsupported messages", () => {
  it("recognises the stored label only", () => {
    expect(isUnsupportedMessageText("Unsupported message")).toBe(true);
    expect(isUnsupportedMessageText(" Unsupported message ")).toBe(true);
    expect(isUnsupportedMessageText("This is an unsupported message?")).toBe(
      false
    );
    expect(isUnsupportedMessageText(undefined)).toBe(false);
  });

  it("rewords the chat list preview", () => {
    expect(describeLastMessage("Unsupported message")).toBe(
      UNSUPPORTED_MESSAGE_PREVIEW
    );
    expect(describeLastMessage("*Hi* there")).toBe("Hi there");
    expect(describeLastMessage("")).toBe("No messages yet");
  });
});

describe("describeUnsupportedMessage", () => {
  const details = {
    metaType: "unsupported",
    originalType: null,
    errorCode: "131051",
    errorTitle: null,
    errorDetails: null
  };

  it("says what Meta told us the message was", () => {
    expect(
      describeUnsupportedMessage({ ...details, originalType: "poll_creation" })
    ).toMatch(/sent a poll/);
    expect(
      describeUnsupportedMessage({ ...details, originalType: "edit" })
    ).toBe("The customer edited a message. Edits can't be shown here.");
    expect(
      describeUnsupportedMessage({ ...details, originalType: "interactive" })
    ).toMatch(/buttons or a list/);
    expect(describeUnsupportedMessage({ ...details, metaType: "revoke" })).toBe(
      "The customer deleted a message."
    );
  });

  it("sends 'unavailable' messages to the phone app", () => {
    expect(
      describeUnsupportedMessage({
        ...details,
        errorCode: "131060",
        originalType: "gif"
      })
    ).toMatch(/WhatsApp Business app on your phone/);
  });

  it("falls back for unknown kinds and older messages", () => {
    const fallback =
      "WhatsApp doesn't let apps show this kind of message. Check it on your phone.";
    expect(
      describeUnsupportedMessage({ ...details, originalType: "keep_in_chat" })
    ).toBe(fallback);
    expect(describeUnsupportedMessage(undefined)).toBe(fallback);
    expect(describeUnsupportedMessage(null)).toBe(fallback);
  });

  it("doesn't blame WhatsApp in an Instagram chat", () => {
    expect(describeUnsupportedMessage(undefined, "instagram")).toMatch(
      /^Instagram/
    );
  });
});

describe("reactions", () => {
  const reaction = (
    emoji: string | null,
    target: string | null = "wamid.A"
  ) => ({
    displayType: "reaction",
    payload: {
      text: emoji ? `Reacted ${emoji}` : "Removed a reaction",
      reaction: { emoji, removed: !emoji, reactedToMetaMessageId: target }
    }
  });

  it("recognises reaction messages", () => {
    expect(isReactionMessage(reaction("👍"))).toBe(true);
    expect(isReactionMessage({ displayType: "text", payload: {} })).toBe(false);
    expect(isReactionMessage({ displayType: "reaction", payload: {} })).toBe(
      false
    );
  });

  it("keeps the latest reaction per message and clears removed ones", () => {
    const reactions = collectReactions([
      reaction("👍"),
      reaction("❤️"),
      reaction("😂", "wamid.B"),
      reaction(null, "wamid.B"),
      reaction("🔥", null),
      { displayType: "text", payload: { text: "hi" } }
    ]);
    expect(Object.fromEntries(reactions)).toEqual({ "wamid.A": "❤️" });
  });

  it("describes a reaction whose message isn't loaded", () => {
    expect(describeReaction(reaction("👍"))).toBe("Reacted 👍 to a message");
    expect(describeReaction(reaction(null))).toBe("Removed a reaction");
  });
});

describe("subscriberName", () => {
  const conversation = (
    channel: "whatsapp" | "instagram",
    subscriber: Record<string, unknown>
  ) =>
    ({
      channel,
      subscriberId: { _id: "s1", ...subscriber }
    }) as unknown as Parameters<typeof subscriberName>[0];

  it("uses the contact's name first", () => {
    expect(
      subscriberName(
        conversation("whatsapp", {
          firstName: "Asha",
          lastName: "Rao",
          phoneNumber: "919876543210"
        })
      )
    ).toBe("Asha Rao");
  });

  it("falls back to the Instagram handle", () => {
    expect(
      subscriberName(conversation("instagram", { instagramUsername: "asha" }))
    ).toBe("@asha");
  });

  it("falls back to the phone number, then to WhatsApp customer", () => {
    expect(
      subscriberName(conversation("whatsapp", { phoneNumber: "919876543210" }))
    ).toBe("+91 98765 43210");
    expect(subscriberName(conversation("whatsapp", {}))).toBe(
      "WhatsApp customer"
    );
  });

  it("names a WhatsApp username customer @username", () => {
    expect(
      subscriberName(conversation("whatsapp", { whatsappUsername: "asha" }))
    ).toBe("@asha");
    expect(
      subscriberName(
        conversation("whatsapp", {
          whatsappUsername: "@asha",
          phoneNumber: "919876543210"
        })
      )
    ).toBe("@asha");
  });
});

describe("WhatsApp contact lines", () => {
  const chat = (subscriber: Record<string, unknown>) =>
    ({
      channel: "whatsapp",
      subscriberId: { _id: "s1", ...subscriber }
    }) as unknown as Parameters<typeof subscriberSubtitle>[0];

  it("shows the phone, else @username, else nothing", () => {
    expect(whatsappContactLine({ phoneNumber: "919876543210" })).toBe(
      "+91 98765 43210"
    );
    expect(whatsappContactLine({ whatsappUsername: "asha" })).toBe("@asha");
    expect(whatsappContactLine({})).toBe("");
    expect(formatWhatsAppUsername("  ")).toBe("");
  });

  it("leaves the line out when the name already says it", () => {
    // The backend names a username customer after the username.
    expect(
      subscriberSubtitle(chat({ firstName: "asha", whatsappUsername: "asha" }))
    ).toBe("");
    expect(subscriberSubtitle(chat({ whatsappUsername: "asha" }))).toBe("");
    expect(
      subscriberSubtitle(chat({ firstName: "Asha", whatsappUsername: "asha" }))
    ).toBe("@asha");
    expect(subscriberSubtitle(chat({}))).toBe("");
  });
});
