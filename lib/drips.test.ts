import { describe, expect, it } from "vitest";

import type { MessageTemplate } from "@/client-api/types/templates.type";
import {
  defaultOnReply,
  describeWait,
  DRIP_WAITING_TEXT,
  dripStatusPresentation,
  hasStopPromotionsButton,
  isDripTemplate,
  isStopPromotionsLabel,
  isAutomaticDrip,
  isTagDrip,
  joinedBreakdown,
  sendHoursProblem,
  waitFromMinutes,
  waitProblem,
  waitToMinutes
} from "./drips";

const template = (
  overrides: Partial<MessageTemplate> = {}
): MessageTemplate => ({
  _id: "t1",
  templateId: "meta-1",
  orgId: "org-1",
  name: "welcome_offer",
  language: "en_US",
  category: "MARKETING",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Hi {{1}}" }],
  wabaId: "waba-1",
  createdAt: "",
  updatedAt: "",
  ...overrides
});

describe("drip waits", () => {
  it("reads minutes as days when they divide evenly, otherwise hours", () => {
    expect(waitFromMinutes(0)).toMatchObject({ immediate: true });
    expect(waitFromMinutes(2880)).toEqual({
      immediate: false,
      amount: "2",
      unit: "days"
    });
    expect(waitFromMinutes(180)).toEqual({
      immediate: false,
      amount: "3",
      unit: "hours"
    });
  });

  it("turns a wait back into minutes", () => {
    expect(waitToMinutes({ immediate: true, amount: "", unit: "days" })).toBe(
      0
    );
    expect(waitToMinutes({ immediate: false, amount: "2", unit: "days" })).toBe(
      2880
    );
    expect(
      waitToMinutes({ immediate: false, amount: "5", unit: "hours" })
    ).toBe(300);
    expect(
      waitToMinutes({ immediate: false, amount: "1.5", unit: "hours" })
    ).toBeNull();
    expect(
      waitToMinutes({ immediate: false, amount: "", unit: "hours" })
    ).toBeNull();
  });

  it("allows 1 hour to 60 days, and right away for the first message only", () => {
    const wait = (amount: string, unit: "hours" | "days") => ({
      immediate: false,
      amount,
      unit
    });
    expect(waitProblem(wait("1", "hours"), false)).toBe("");
    expect(waitProblem(wait("60", "days"), false)).toBe("");
    expect(waitProblem(wait("61", "days"), false)).toBe(
      "Wait at most 60 days."
    );
    expect(waitProblem(wait("0", "hours"), false)).toBe(
      "Enter a whole number."
    );
    expect(
      waitProblem({ immediate: true, amount: "1", unit: "days" }, true)
    ).toBe("");
  });

  it("describes a wait in words", () => {
    expect(describeWait(0)).toBe("right away");
    expect(describeWait(60)).toBe("1 hour");
    expect(describeWait(2880)).toBe("2 days");
  });
});

describe("Stop promotions button", () => {
  it("matches the labels the server treats as a stop tap", () => {
    expect(isStopPromotionsLabel("Stop promotions")).toBe(true);
    expect(isStopPromotionsLabel("STOP PROMOS!")).toBe(true);
    expect(isStopPromotionsLabel("Unsubscribe")).toBe(true);
    expect(isStopPromotionsLabel("Stop")).toBe(false);
    expect(isStopPromotionsLabel("Shop now")).toBe(false);
  });

  it("finds it among a template's quick replies", () => {
    expect(
      hasStopPromotionsButton([
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Shop now" },
            { type: "QUICK_REPLY", text: "Stop promotions" }
          ]
        }
      ])
    ).toBe(true);
    expect(
      hasStopPromotionsButton([
        {
          type: "BUTTONS",
          buttons: [{ type: "URL", text: "Stop promotions", url: "x" }]
        }
      ])
    ).toBe(false);
  });
});

describe("templates a drip can use", () => {
  it("takes approved offers and updates from the number's account", () => {
    expect(isDripTemplate(template(), "waba-1")).toBe(true);
    expect(isDripTemplate(template({ category: "UTILITY" }), "waba-1")).toBe(
      true
    );
  });

  it("leaves out login codes, unapproved and other accounts' templates", () => {
    expect(
      isDripTemplate(template({ category: "AUTHENTICATION" }), "waba-1")
    ).toBe(false);
    expect(isDripTemplate(template({ status: "PENDING" }), "waba-1")).toBe(
      false
    );
    expect(isDripTemplate(template(), "waba-2")).toBe(false);
  });

  it("takes a template with a variable in a text header", () => {
    expect(
      isDripTemplate(
        template({
          components: [
            { type: "HEADER", format: "TEXT", text: "Hi {{1}}" },
            { type: "BODY", text: "Hello" }
          ]
        }),
        "waba-1"
      )
    ).toBe(true);
  });
});

describe("drip settings and status", () => {
  it("needs sending hours at least 2 hours long", () => {
    expect(sendHoursProblem(10, 20)).toBe("");
    expect(sendHoursProblem(10, 11)).toBe(
      "Sending hours must be at least 2 hours long, within one day."
    );
  });

  it("names each status in plain words", () => {
    expect(dripStatusPresentation("active")).toMatchObject({
      label: "Running",
      live: true
    });
    expect(dripStatusPresentation("draft").label).toBe("Draft");
    expect(dripStatusPresentation("paused").label).toBe("Paused");
    expect(dripStatusPresentation("archived").label).toBe("Archived");
  });
});

describe("automatic drips", () => {
  it("pauses on a reply for tag drips and stops for drips you fill", () => {
    expect(defaultOnReply("tag_added")).toBe("pause");
    expect(defaultOnReply("manual")).toBe("stop");
  });

  it("knows a tag drip by its trigger and tag", () => {
    expect(isTagDrip({ trigger: { type: "tag_added", tag: "Lead" } })).toBe(
      true
    );
    expect(isTagDrip({ trigger: { type: "tag_added", tag: null } })).toBe(
      false
    );
    expect(isTagDrip({ trigger: { type: "manual", tag: null } })).toBe(false);
    expect(isTagDrip(null)).toBe(false);
  });

  it("says why someone is waiting while they chat", () => {
    expect(DRIP_WAITING_TEXT.chatting).toBe("Waiting, they're chatting");
  });

  it("says when a paused workspace is holding someone", () => {
    expect(DRIP_WAITING_TEXT.workspace_paused).toBe(
      "Waiting: workspace paused"
    );
  });
});

describe("more ways to start", () => {
  it("pauses on a reply for every automatic start", () => {
    expect(defaultOnReply("ad_lead")).toBe("pause");
    expect(defaultOnReply("first_message")).toBe("pause");
    expect(defaultOnReply("order_placed")).toBe("pause");
  });

  it("treats everything but 'I add people' as automatic", () => {
    expect(isAutomaticDrip({ trigger: { type: "ad_lead" } })).toBe(true);
    expect(isAutomaticDrip({ trigger: { type: "order_placed" } })).toBe(true);
    expect(isAutomaticDrip({ trigger: { type: "manual" } })).toBe(false);
    expect(isAutomaticDrip({})).toBe(false);
  });

  it("words how people joined, leaving out 'added by you' at 0", () => {
    const tag = { trigger: { type: "tag_added" as const, tag: "Lead" } };
    const ad = { trigger: { type: "ad_lead" as const } };
    expect(joinedBreakdown(tag, { byHand: 3, byTag: 5 })).toBe(
      "5 by tag, 3 added by you"
    );
    expect(joinedBreakdown(tag, { byHand: 0, byTag: 5 })).toBe("5 by tag");
    expect(joinedBreakdown(ad, { byHand: 2, byTag: 0, automatic: 1200 })).toBe(
      "1,200 automatically, 2 added by you"
    );
    expect(
      joinedBreakdown({ trigger: { type: "manual" } }, { byHand: 4, byTag: 0 })
    ).toBe("");
  });
});
