import { describe, expect, it } from "vitest";

import {
  CART_DELAY_RANGE_MESSAGE,
  cartDelaysProblem,
  cartReminderSteps,
  cartTemplatesWaiting,
  delayDraftFromMinutes,
  delayDraftMinutes,
  formatRecoveredTotals,
  hasStorePlugin,
  isCartReminderTemplate,
  isPluginQuiet,
  pluginLastSeenText,
  storeCartStatusPresentation
} from "@/lib/storeCarts";

const now = new Date("2026-11-21T12:00:00Z");
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("hasStorePlugin", () => {
  it("is WooCommerce with the backend's plugin field only", () => {
    const plugin = { connected: false };
    expect(hasStorePlugin({ platform: "woocommerce", plugin } as never)).toBe(
      true
    );
    expect(hasStorePlugin({ platform: "woocommerce" } as never)).toBe(false);
    expect(hasStorePlugin({ platform: "shopify", plugin: null } as never)).toBe(
      false
    );
    expect(hasStorePlugin({ platform: "shopify", plugin } as never)).toBe(
      false
    );
    expect(hasStorePlugin(null)).toBe(false);
  });
});

describe("plugin check-ins", () => {
  it("reads the last check-in mid-sentence", () => {
    expect(pluginLastSeenText(hoursAgo(3), now)).toBe("3 h ago");
    expect(pluginLastSeenText(now.toISOString(), now)).toBe("just now");
  });

  it("is quiet after a day without a check-in", () => {
    expect(isPluginQuiet(hoursAgo(23), now)).toBe(false);
    expect(isPluginQuiet(hoursAgo(25), now)).toBe(true);
    expect(isPluginQuiet(null, now)).toBe(false);
  });
});

describe("cartReminderSteps", () => {
  it("always has three, with the backend's default delays", () => {
    expect(cartReminderSteps()).toEqual([
      {
        enabled: true,
        delayMinutes: 60,
        templateName: null,
        templateLanguage: null
      },
      {
        enabled: true,
        delayMinutes: 360,
        templateName: null,
        templateLanguage: null
      },
      {
        enabled: true,
        delayMinutes: 1440,
        templateName: null,
        templateLanguage: null
      }
    ]);
    expect(
      cartReminderSteps([
        {
          enabled: false,
          delayMinutes: 90,
          templateName: "store_cart_reminder",
          templateLanguage: "en"
        }
      ])[0]
    ).toEqual({
      enabled: false,
      delayMinutes: 90,
      templateName: "store_cart_reminder",
      templateLanguage: "en"
    });
  });
});

describe("delays", () => {
  it("shows whole hours in hours, the rest in minutes", () => {
    expect(delayDraftFromMinutes(360)).toEqual({ value: "6", unit: "hours" });
    expect(delayDraftFromMinutes(90)).toEqual({ value: "90", unit: "minutes" });
    expect(delayDraftMinutes({ value: "1.5", unit: "hours" })).toBe(90);
    expect(delayDraftMinutes({ value: "45", unit: "minutes" })).toBe(45);
    expect(delayDraftMinutes({ value: " ", unit: "minutes" })).toBe(null);
    expect(delayDraftMinutes({ value: "abc", unit: "hours" })).toBe(null);
  });

  it("checks the range and the order like the backend", () => {
    const draft = (value: string, unit: "minutes" | "hours" = "minutes") => ({
      value,
      unit
    });
    expect(
      cartDelaysProblem([
        draft("60"),
        draft("6", "hours"),
        draft("24", "hours")
      ])
    ).toBe(null);
    expect(
      cartDelaysProblem([
        draft("20"),
        draft("6", "hours"),
        draft("24", "hours")
      ])
    ).toEqual({
      index: 0,
      message: CART_DELAY_RANGE_MESSAGE
    });
    expect(
      cartDelaysProblem([
        draft("60"),
        draft("6", "hours"),
        draft("73", "hours")
      ])
    ).toEqual({
      index: 2,
      message: CART_DELAY_RANGE_MESSAGE
    });
    expect(
      cartDelaysProblem([draft("60"), draft(""), draft("24", "hours")])
    ).toEqual({
      index: 1,
      message: CART_DELAY_RANGE_MESSAGE
    });
    expect(
      cartDelaysProblem([
        draft("2", "hours"),
        draft("120"),
        draft("24", "hours")
      ])
    ).toEqual({
      index: 1,
      message: "Reminder 2 must be sent later than reminder 1."
    });
  });
});

describe("isCartReminderTemplate", () => {
  const template = (
    category: string,
    buttons: { type: string; text: string; url?: string }[]
  ) =>
    ({
      name: "t",
      language: "en",
      status: "APPROVED",
      category,
      components: [
        { type: "BODY", text: "Hi {{1}}" },
        { type: "BUTTONS", buttons }
      ]
    }) as never;
  const cartLink = {
    type: "URL",
    text: "Complete my order",
    url: "https://shop.example/?whatching_cart={{1}}"
  };

  it("is Marketing with one link button ending in a variable", () => {
    expect(isCartReminderTemplate(template("MARKETING", [cartLink]))).toBe(
      true
    );
    expect(
      isCartReminderTemplate(
        template("MARKETING", [
          cartLink,
          { type: "URL", text: "Shop", url: "https://shop.example" },
          { type: "QUICK_REPLY", text: "Stop" }
        ])
      )
    ).toBe(true);
  });

  it("leaves out everything else", () => {
    expect(isCartReminderTemplate(template("UTILITY", [cartLink]))).toBe(false);
    expect(isCartReminderTemplate(template("MARKETING", []))).toBe(false);
    expect(
      isCartReminderTemplate(
        template("MARKETING", [
          { type: "URL", text: "Shop", url: "https://shop.example" }
        ])
      )
    ).toBe(false);
    expect(
      isCartReminderTemplate(
        template("MARKETING", [
          { ...cartLink, url: "https://shop.example/{{1}}/cart" }
        ])
      )
    ).toBe(false);
    expect(
      isCartReminderTemplate(template("MARKETING", [cartLink, cartLink]))
    ).toBe(false);
  });
});

describe("cartTemplatesWaiting", () => {
  const templates = [
    { name: "ok", language: "en", status: "APPROVED", category: "MARKETING" },
    { name: "new", language: "en", status: "PENDING", category: "MARKETING" }
  ];
  it("is true while a reminder that's on uses a template in review", () => {
    const step = (name: string | null, enabled = true) => ({
      enabled,
      delayMinutes: 60,
      templateName: name,
      templateLanguage: name ? "en" : null
    });
    expect(cartTemplatesWaiting([step("ok"), step(null)], templates)).toBe(
      false
    );
    expect(cartTemplatesWaiting([step("ok"), step("new")], templates)).toBe(
      true
    );
    expect(
      cartTemplatesWaiting([step("ok"), step("new", false)], templates)
    ).toBe(false);
    // Not in the list yet (just created): still waiting.
    expect(cartTemplatesWaiting([step("other")], templates)).toBe(true);
  });
});

describe("storeCartStatusPresentation", () => {
  const cart = {
    status: "open" as const,
    recovered: false,
    orderNumber: null,
    stopReason: null,
    nextReminderAt: null
  };

  it("words each status", () => {
    expect(storeCartStatusPresentation(cart, now).label).toBe("Waiting");
    expect(
      storeCartStatusPresentation(
        {
          ...cart,
          nextReminderAt: new Date(now.getTime() + 3 * 3_600_000).toISOString()
        },
        now
      ).label
    ).toBe("Reminder due in 3 h");
    expect(
      storeCartStatusPresentation(
        { ...cart, nextReminderAt: hoursAgo(0.1) },
        now
      ).label
    ).toBe("Reminder due now");
    expect(
      storeCartStatusPresentation(
        { ...cart, status: "converted", recovered: true, orderNumber: "18" },
        now
      ).label
    ).toBe("Recovered · order #18");
    expect(
      storeCartStatusPresentation(
        { ...cart, status: "converted", orderNumber: "#19" },
        now
      ).label
    ).toBe("Ordered · #19");
    expect(
      storeCartStatusPresentation(
        {
          ...cart,
          status: "stopped",
          stopReason: "The shopper replied on WhatsApp."
        },
        now
      )
    ).toEqual({
      label: "Stopped",
      tone: "grey",
      help: "The shopper replied on WhatsApp."
    });
    expect(
      storeCartStatusPresentation({ ...cart, status: "expired" }, now).label
    ).toBe("Expired");
  });
});

describe("formatRecoveredTotals", () => {
  it("shows one amount per currency", () => {
    expect(
      formatRecoveredTotals([
        { currency: "INR", amount: "299.00" },
        { currency: "USD", amount: "12.50" },
        { currency: null, amount: "5.00" }
      ])
    ).toBe("₹299.00 · $12.50 · 5.00");
    expect(formatRecoveredTotals([])).toBe("");
  });
});
