import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { computeBroadcastFunnel } from "./broadcastFunnel";
import {
  formatCountdown,
  formatCount,
  formatPercent,
  formatWhen
} from "./displayFormat";
import { describeRecipientOutcome } from "./recipientOutcome";
import {
  broadcastStatusPresentation,
  templateStatusPresentation
} from "./statusPresentation";
import {
  buildBroadcastTemplateComponents,
  getTemplateVariableSlots,
  mappingsFromComponents,
  resolveSlotValue
} from "./templateVariables";
import { renderWhatsAppText } from "./whatsappText";
import { TemplateComponent } from "@/client-api/types/templates.type";

describe("computeBroadcastFunnel", () => {
  it("counts read recipients as delivered and sent", () => {
    const funnel = computeBroadcastFunnel({
      totalRecipients: 13,
      sentRecipients: 0,
      deliveredRecipients: 0,
      readRecipients: 13,
      failedRecipients: 0,
      skippedRecipients: 0,
      deferredRecipients: 0,
      queuedRecipients: 0,
      canceledRecipients: 0
    });
    expect(funnel.delivered).toBe(13);
    expect(funnel.sent).toBe(13);
    expect(formatPercent(funnel.delivered, funnel.total)).toBe("100%");
  });

  it("adds up each cumulative stage", () => {
    const funnel = computeBroadcastFunnel({
      totalRecipients: 10,
      sentRecipients: 2,
      deliveredRecipients: 3,
      readRecipients: 4,
      failedRecipients: 1
    });
    expect(funnel).toMatchObject({
      read: 4,
      delivered: 7,
      sent: 9,
      notDelivered: 1
    });
  });
});

describe("display formatting", () => {
  it("formats counts and small percentages", () => {
    expect(formatCount(12480)).toBe("12,480");
    expect(formatPercent(4, 1000)).toBe("0.4%");
    expect(formatPercent(0, 0)).toBe("0%");
    expect(formatPercent(1, 3)).toBe("33%");
  });

  it("describes times relative to now", () => {
    const now = new Date(2026, 9, 30, 15, 0);
    expect(formatWhen(new Date(2026, 9, 30, 14, 48), now)).toBe("12 min ago");
    expect(formatWhen(new Date(2026, 9, 30, 11, 0), now)).toMatch(
      /^Today, 11:00\s?am$/
    );
    expect(formatWhen(new Date(2026, 9, 28, 11, 0), now)).toMatch(
      /^28 Oct, 11:00\s?am$/
    );
    expect(formatCountdown(new Date(2026, 9, 30, 17, 14), now)).toBe(
      "2 h 14 min"
    );
  });
});

describe("describeRecipientOutcome", () => {
  it("explains Meta's error codes", () => {
    expect(
      describeRecipientOutcome({ status: "failed", errorCode: "131050" }).label
    ).toBe("Marketing turned off");
    expect(
      describeRecipientOutcome({
        status: "failed",
        errorCode: "999",
        errorMessage: "Meta says no"
      })
    ).toMatchObject({ label: "Couldn't deliver", explanation: "Meta says no" });
  });

  it("dates a 131049 retry a day after deferral", () => {
    const outcome = describeRecipientOutcome({
      status: "deferred",
      errorCode: "131049",
      deferredAt: new Date(2026, 9, 1, 10, 0).toISOString()
    });
    expect(outcome.label).toBe("Waiting to retry");
    expect(outcome.explanation).toContain("Retrying on 2 Oct");
  });
});

describe("status presentation", () => {
  it("never shows raw values", () => {
    expect(broadcastStatusPresentation("in_progress").label).toBe("Sending");
    expect(templateStatusPresentation("PENDING").label).toBe("In review");
    expect(templateStatusPresentation("PAUSED").label).toBe("Paused by Meta");
  });
});

const template: TemplateComponent[] = [
  {
    type: "HEADER",
    format: "TEXT",
    text: "Hi {{1}}",
    example: { header_text: ["Priya"] } as never
  },
  {
    type: "BODY",
    text: "Your order {{1}} ships {{2}}",
    example: { body_text: [["#123", "today"]] }
  },
  {
    type: "BUTTONS",
    buttons: [
      { type: "QUICK_REPLY", text: "Stop" },
      {
        type: "URL",
        text: "Track",
        url: "https://x.com/t/{{1}}",
        example: ["https://x.com/t/9"]
      },
      { type: "COPY_CODE", text: "", example: ["SAVE10"] }
    ]
  }
];

describe("template variable slots", () => {
  const slots = getTemplateVariableSlots(template);

  it("finds header, body and button variables", () => {
    expect(slots.map((slot) => slot.id)).toEqual([
      "header:1",
      "body:1",
      "body:2",
      "button:1",
      "button:2"
    ]);
    expect(slots.find((slot) => slot.id === "body:2")?.sample).toBe("today");
  });

  it("refuses to build until every slot is filled", () => {
    const result = buildBroadcastTemplateComponents(slots, {});
    expect(result.ok).toBe(false);
  });

  it("builds components the backend checks, and reads them back", () => {
    const literal = (text: string) => ({
      source: "literal" as const,
      path: "",
      fallback: "",
      literal: text
    });
    const mappings = {
      "header:1": {
        source: "subscriber_field" as const,
        path: "firstName",
        fallback: "there",
        literal: ""
      },
      "body:1": literal("#9"),
      "body:2": literal("soon"),
      "button:1": literal("9"),
      "button:2": literal("SAVE10")
    };
    const result = buildBroadcastTemplateComponents(slots, mappings);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.components.map((component) => component.type)).toEqual([
      "header",
      "body",
      "button",
      "button"
    ]);
    expect(result.components[3]).toMatchObject({
      sub_type: "copy_code",
      index: "2",
      parameters: [{ type: "coupon_code", coupon_code: "SAVE10" }]
    });
    expect(mappingsFromComponents(slots, result.components)).toEqual(mappings);
  });

  it("resolves preview values for a contact or from samples", () => {
    const slot = slots[0];
    const mapping = {
      source: "subscriber_field" as const,
      path: "firstName",
      fallback: "",
      literal: ""
    };
    expect(resolveSlotValue(slot, mapping, { firstName: "Asha" }).text).toBe(
      "Asha"
    );
    expect(resolveSlotValue(slot, mapping, {}).text).toBe("there");
    expect(resolveSlotValue(slot, mapping, null).text).toBe("Priya");
    expect(resolveSlotValue(slot, undefined).isPlaceholder).toBe(true);
  });
});

describe("renderWhatsAppText", () => {
  const html = (text: string, values: Record<string, string> = {}) =>
    renderToStaticMarkup(
      <p>{renderWhatsAppText(text, (key) => values[key])}</p>
    );

  it("applies WhatsApp formatting", () => {
    expect(html("*Big* _sale_ ~old~ ```code```")).toBe(
      '<p><strong>Big</strong> <em>sale</em> <s>old</s> <code class="rounded-sm bg-black/5 px-1 font-mono text-[0.92em]">code</code></p>'
    );
  });

  it("fills variables and chips the missing ones", () => {
    const output = html("Hi *{{1}}*, code {{2}}", { "1": "Asha" });
    expect(output).toContain("<strong>Asha</strong>");
    expect(output).toContain("{{2}}");
    expect(output).toContain("bg-amber-100");
  });
});
