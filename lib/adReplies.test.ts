import { describe, expect, it } from "vitest";

import type { BotCanvasTrigger } from "@/client-api/types/bot.type";

import {
  adReplyFlowChoices,
  adReplyLabel,
  adReplyProblem,
  draftFromAd,
  draftFromAllAds,
  draftToSetting,
  sameDraft
} from "./adReplies";

const flow = (triggerKey: string, name: string): BotCanvasTrigger => ({
  triggerKey,
  name,
  nodeId: triggerKey.toLowerCase(),
  blockType: "text"
});

const FLOWS = [
  flow("PRICE_LIST", "Price list"),
  flow("OPT_IN", "Subscribe"),
  flow("OPT_OUT", "Unsubscribe")
];

describe("ad replies", () => {
  it("never offers the subscribe and unsubscribe flows", () => {
    expect(adReplyFlowChoices(FLOWS).map((item) => item.triggerKey)).toEqual([
      "PRICE_LIST"
    ]);
    expect(adReplyFlowChoices(undefined)).toEqual([]);
  });

  it("reads a missing all-ads setting as the normal bot reply", () => {
    expect(draftFromAllAds(undefined).mode).toBe("off");
    expect(draftFromAllAds({ mode: "message", text: "Hi" })).toEqual({
      mode: "message",
      text: "Hi",
      triggerKey: ""
    });
  });

  it("reads a missing ad reply as 'same as all ads'", () => {
    expect(draftFromAd(undefined).mode).toBe("default");
    expect(draftFromAd(null).mode).toBe("default");
  });

  it("labels each ad's reply", () => {
    expect(adReplyLabel(undefined, FLOWS)).toBe("Same as all ads");
    expect(adReplyLabel({ mode: "default" }, FLOWS)).toBe("Same as all ads");
    expect(adReplyLabel({ mode: "off" }, FLOWS)).toBe("Normal bot reply");
    expect(adReplyLabel({ mode: "message", text: "Hi" }, FLOWS)).toBe(
      "Message"
    );
    expect(
      adReplyLabel({ mode: "flow", triggerKey: "PRICE_LIST" }, FLOWS)
    ).toBe("Flow: Price list");
    expect(adReplyLabel({ mode: "flow", triggerKey: "GONE" }, FLOWS)).toBe(
      "Flow (not live)"
    );
  });

  it("sends only the field the choice needs", () => {
    const base = { text: " Hello ", triggerKey: "PRICE_LIST" };
    expect(draftToSetting({ ...base, mode: "message" })).toEqual({
      mode: "message",
      text: "Hello"
    });
    expect(draftToSetting({ ...base, mode: "flow" })).toEqual({
      mode: "flow",
      triggerKey: "PRICE_LIST"
    });
    expect(draftToSetting({ ...base, mode: "off" })).toEqual({ mode: "off" });
    expect(draftToSetting({ ...base, mode: "default" })).toEqual({
      mode: "default"
    });
  });

  it("treats leftover text from another choice as no change", () => {
    expect(
      sameDraft(
        { mode: "off", text: "typed then switched", triggerKey: "" },
        { mode: "off", text: "", triggerKey: "" }
      )
    ).toBe(true);
  });

  it("uses the backend's wording for a missing message or flow", () => {
    expect(
      adReplyProblem({ mode: "message", text: "  ", triggerKey: "" })
    ).toBe("Type the message to send.");
    expect(adReplyProblem({ mode: "flow", text: "", triggerKey: "" })).toBe(
      "Choose the flow to start."
    );
    expect(adReplyProblem({ mode: "off", text: "", triggerKey: "" })).toBe("");
  });
});
