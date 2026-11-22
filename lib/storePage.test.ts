import { describe, expect, it } from "vitest";

import type {
  StoreConnection,
  StoreSummary
} from "@/client-api/types/stores.type";
import { broadcastRestrictionText, storeOptInText } from "@/lib/contactText";
import {
  codStatePresentation,
  disconnectedByOwner,
  paymentMethodLabel,
  parseOrdersShow,
  parseStoreTab,
  recoveredThisMonth,
  storeHistoryKeptUntil,
  storeJourney,
  storePreviewValues,
  storeSetupSteps,
  storeSummaryTiles,
  storeTemplatePill,
  storeTemplateUses,
  templateBodyPreview
} from "@/lib/storePage";

const connection = (extra: Partial<StoreConnection> = {}): StoreConnection => ({
  id: "c1",
  platform: "woocommerce",
  status: "connected",
  storeUrl: "https://shop.example",
  storeName: "Heap Brick",
  settings: {
    shippedStatuses: ["shipped"],
    messages: {
      order_confirmed: {
        enabled: true,
        templateName: "confirmed",
        templateLanguage: "en"
      },
      cod_confirmation: {
        enabled: true,
        templateName: "cod",
        templateLanguage: "en"
      },
      order_shipped: { enabled: false, templateName: "shipped" },
      order_cancelled: { enabled: true }
    },
    customStatusRules: [
      {
        status: "out-for-delivery",
        statusLabel: "Out for delivery",
        enabled: true,
        templateName: "confirmed",
        templateLanguage: "en"
      }
    ],
    cartReminders: {
      enabled: true,
      steps: [
        {
          enabled: true,
          delayMinutes: 60,
          templateName: "cart",
          templateLanguage: "en"
        },
        {
          enabled: false,
          delayMinutes: 360,
          templateName: "cart",
          templateLanguage: "en"
        },
        { enabled: true, delayMinutes: 1440 }
      ]
    }
  },
  plugin: { connected: true },
  ...extra
});

const templates = [
  {
    name: "confirmed",
    language: "en",
    status: "APPROVED",
    category: "UTILITY"
  },
  { name: "cod", language: "en", status: "PENDING", category: "UTILITY" },
  { name: "old", language: "en", status: "REJECTED", category: "UTILITY" }
] as never[];

const summary = (extra: Partial<StoreSummary> = {}): StoreSummary => ({
  month: "2026-11",
  ordersMessaged: 21,
  cod: {
    waiting: 0,
    confirmed: 8,
    cancelRequested: 1,
    cancelled: 1,
    noReply: 1
  },
  carts: {
    remindersSent: 19,
    recoveredCount: 3,
    recoveredTotals: [{ currency: "INR", amount: "897.00" }]
  },
  notSent: { orders: 0, cartReminders: 0 },
  ...extra
});

describe("URL state", () => {
  it("reads the tab and filter, or falls back to the defaults", () => {
    expect(parseStoreTab("messages")).toBe("messages");
    expect(parseStoreTab("nope")).toBe("overview");
    expect(parseStoreTab(undefined)).toBe("overview");
    expect(parseOrdersShow("cod_waiting")).toBe("cod_waiting");
    expect(parseOrdersShow(["not_sent"])).toBe("all");
  });
});

describe("storeSummaryTiles", () => {
  it("words this month's numbers", () => {
    const tiles = storeSummaryTiles(summary(), { pluginLinked: true });
    expect(tiles.map((tile) => [tile.value, tile.sub])).toEqual([
      ["21", "This month"],
      ["8 confirmed", "2 cancelled · 1 no reply"],
      ["₹897.00", "3 carts this month"],
      ["0", "All good"]
    ]);
    expect(tiles[3].opens).toBeUndefined();
  });

  it("adds waiting answers, the plugin hint and where Not sent leads", () => {
    const tiles = storeSummaryTiles(
      summary({
        cod: {
          waiting: 2,
          confirmed: 0,
          cancelRequested: 0,
          cancelled: 0,
          noReply: 0
        },
        carts: { remindersSent: 0, recoveredCount: 1, recoveredTotals: [] },
        notSent: { orders: 1, cartReminders: 2 }
      }),
      { pluginLinked: false }
    );
    expect(tiles[1].sub).toBe("0 cancelled · 0 no reply · 2 waiting");
    expect(tiles[2]).toMatchObject({
      value: "—",
      sub: "Link the plugin to start"
    });
    expect(tiles[3]).toMatchObject({
      value: "3",
      sub: "See Activity for why",
      opens: { view: "orders", show: "not_sent" }
    });
    // Only cart reminders: the Carts list shows why.
    expect(
      storeSummaryTiles(summary({ notSent: { orders: 0, cartReminders: 1 } }), {
        pluginLinked: true
      })[3].opens
    ).toEqual({ view: "carts" });
  });

  it("sums up recovered carts", () => {
    expect(recoveredThisMonth(summary())).toBe(
      "Recovered this month: 3 carts · ₹897.00"
    );
    expect(
      recoveredThisMonth(
        summary({
          carts: { remindersSent: 0, recoveredCount: 1, recoveredTotals: [] }
        })
      )
    ).toBe("Recovered this month: 1 cart");
  });
});

describe("Overview", () => {
  it("lists what customers receive, with the chosen status", () => {
    const rows = storeJourney(connection(), (slug) =>
      slug === "shipped" ? "Shipped" : slug
    );
    expect(rows.map((row) => [row.title, row.when, row.on])).toEqual([
      ["Order confirmed", "When a paid order is placed", true],
      [
        "Cash on delivery check",
        "Instead of “Order confirmed” for cash-on-delivery orders, with Confirm and Cancel buttons",
        true
      ],
      ["Order completed", "When the order is marked Shipped", false],
      ["Order cancelled", "When the order is cancelled in your store", true],
      ["Out for delivery", "When the order moves to Out for delivery", true]
    ]);
  });

  it("keeps a checklist that says what still needs doing", () => {
    const steps = storeSetupSteps({
      connection: connection(),
      templates,
      numberCount: 2,
      senderLabel: null,
      showCarts: true
    });
    expect(steps).toEqual([
      {
        id: "store",
        label: "Store connected",
        note: "Orders reach Whatching",
        done: true
      },
      {
        id: "templates",
        label: "Message templates approved",
        // On: confirmed (approved), COD (in review), cancelled (none), Out for delivery (approved).
        note: "2 of 4 approved by WhatsApp",
        done: false,
        action: "templates"
      },
      {
        id: "sender",
        label: "Sending number",
        note: "Choose which number sends your store messages",
        done: false,
        action: "sender"
      },
      {
        id: "carts",
        label: "Cart reminders",
        note: "Reminders on",
        done: true,
        action: undefined
      }
    ]);
  });

  it("only waits while templates are in review", () => {
    const steps = storeSetupSteps({
      connection: connection({
        status: "needs_attention",
        attention: { message: "We can't reach your store." },
        plugin: { connected: false },
        settings: {
          ...connection().settings,
          messages: {
            order_confirmed: {
              enabled: true,
              templateName: "cod",
              templateLanguage: "en"
            },
            cod_confirmation: { enabled: false },
            order_shipped: { enabled: false },
            order_cancelled: { enabled: false }
          },
          customStatusRules: []
        }
      }),
      templates,
      numberCount: 1,
      senderLabel: null,
      showCarts: true
    });
    expect(
      steps.map((step) => [step.id, step.note, step.done, step.action])
    ).toEqual([
      ["store", "We can't reach your store.", false, undefined],
      ["templates", "0 of 1 approved by WhatsApp", false, undefined],
      ["carts", "Install and link the plugin to turn them on", false, "plugin"]
    ]);
    expect(steps[1].hint).toBe(
      "Waiting for WhatsApp to approve your templates. This usually takes a few minutes."
    );
  });

  it("sends an extra status message without a usable template to Order messages", () => {
    const [, templatesStep] = storeSetupSteps({
      connection: connection({
        settings: {
          ...connection().settings,
          messages: {
            order_confirmed: {
              enabled: true,
              templateName: "confirmed",
              templateLanguage: "en"
            },
            cod_confirmation: { enabled: false },
            order_shipped: { enabled: false },
            order_cancelled: { enabled: false }
          },
          customStatusRules: [
            {
              status: "packed",
              enabled: true,
              templateName: "gone",
              templateLanguage: "en"
            }
          ]
        }
      }),
      templates,
      numberCount: 1,
      senderLabel: null,
      showCarts: false
    });
    expect(templatesStep).toMatchObject({
      note: "1 of 2 approved by WhatsApp",
      action: undefined,
      hint: "Choose an approved template for each message in Order messages."
    });
  });
});

describe("templates on the Store page", () => {
  it("labels the chosen template", () => {
    expect(storeTemplatePill(null, null, templates)).toBeNull();
    expect(storeTemplatePill("confirmed", "en", templates)?.label).toBe(
      "Approved by WhatsApp"
    );
    expect(storeTemplatePill("cod", "en", templates)?.label).toBe("In review");
    expect(storeTemplatePill("old", "en", templates)).toMatchObject({
      label: "Not approved",
      tone: "red"
    });
    expect(storeTemplatePill("gone", "en", templates)).toMatchObject({
      label: "This template no longer exists. Choose another one.",
      missing: true
    });
  });

  it("previews a template's text for the picker", () => {
    expect(
      templateBodyPreview({
        components: [
          { type: "HEADER", text: "Order" },
          { type: "BODY", text: "Hi {{1}},\n\nthanks   for your order." }
        ]
      } as never)
    ).toBe("Hi {{1}}, thanks for your order.");
    expect(
      templateBodyPreview({
        components: [{ type: "BODY", text: "x".repeat(80) }]
      } as never)
    ).toBe(`${"x".repeat(59)}…`);
  });

  it("fills previews with sample values", () => {
    expect(
      storePreviewValues(
        "order_confirmed",
        [{ variable: "{{1}}", label: "Customer’s first name" }],
        { storeName: "Heap Brick", currency: "INR" }
      )
    ).toEqual({ "1": "Zaki", "2": "1042", "3": "Heap Brick", "4": "₹499.00" });
    expect(
      storePreviewValues("status_packed", undefined, {
        storeName: "Heap Brick",
        statusLabel: "Packed"
      })["4"]
    ).toBe("Packed");
    expect(
      storePreviewValues("cart_reminder", undefined, {
        storeName: "Heap Brick",
        currency: "USD"
      })
    ).toEqual({
      "1": "Zaki",
      "2": "Test Mug",
      "3": "Heap Brick",
      "4": "$299.00"
    });
  });
});

describe("Activity", () => {
  it("colours cash-on-delivery answers", () => {
    expect(codStatePresentation("confirmed")).toEqual({
      label: "Confirmed",
      tone: "green"
    });
    expect(codStatePresentation("awaiting").tone).toBe("amber");
    expect(codStatePresentation("cancel_requested").tone).toBe("red");
    expect(codStatePresentation("no_reply").tone).toBe("grey");
    expect(paymentMethodLabel("cod")).toBe("Cash on delivery");
    expect(paymentMethodLabel("razorpay_cod")).toBe("razorpay_cod");
  });
});

describe("a disconnected store", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  it("keeps its history for 30 days", () => {
    const until = storeHistoryKeptUntil(
      connection({
        status: "disconnected",
        disconnectedAt: "2026-11-21T10:00:00Z"
      }),
      now
    );
    expect(until?.toISOString()).toBe("2026-12-21T10:00:00.000Z");
    expect(
      storeHistoryKeptUntil(
        connection({
          status: "disconnected",
          disconnectedAt: "2026-10-01T10:00:00Z"
        }),
        now
      )
    ).toBeNull();
    expect(storeHistoryKeptUntil(connection(), now)).toBeNull();
  });

  it("tells an owner's disconnect from a failed setup", () => {
    const base = {
      status: "disconnected" as const,
      disconnectedAt: "2026-11-21T10:00:00Z"
    };
    expect(disconnectedByOwner(connection(base))).toBe(true);
    expect(
      disconnectedByOwner(
        connection({ ...base, setupFailure: { message: "Took too long." } })
      )
    ).toBe(false);
  });
});

describe("storeTemplateUses", () => {
  it("names the turned-on Store messages that send a template", () => {
    expect(storeTemplateUses(connection(), "confirmed", "en")).toEqual([
      "Order confirmed",
      "Order moves to “Out for delivery”"
    ]);
    // A step that's off doesn't count; the third has no template.
    expect(storeTemplateUses(connection(), "cart", "en")).toEqual([
      "Cart reminder 1"
    ]);
    // A message that's off doesn't count.
    expect(storeTemplateUses(connection(), "shipped", "en")).toEqual([]);
    expect(storeTemplateUses(connection(), "confirmed", "hi")).toEqual([]);
  });

  it("only counts a live store, and reminders only while they're on", () => {
    expect(
      storeTemplateUses(
        connection({ status: "disconnected" }),
        "confirmed",
        "en"
      )
    ).toEqual([]);
    expect(storeTemplateUses(null, "confirmed", "en")).toEqual([]);
    const off = connection();
    off.settings = {
      ...off.settings,
      cartReminders: { ...off.settings?.cartReminders, enabled: false }
    };
    expect(storeTemplateUses(off, "cart", "en")).toEqual([]);
  });
});

describe("contact wording", () => {
  it("says when a contact came from the store", () => {
    expect(storeOptInText("store_checkout")).toBe(
      "Added from your store (order)"
    );
    expect(storeOptInText("store_cart")).toBe(
      "Added from your store (checkout)"
    );
    expect(storeOptInText("manual")).toBeNull();
  });

  it("words known restriction reasons and hides the rest", () => {
    expect(broadcastRestrictionText("awaiting_plan_capacity")).toBe(
      "Waiting for room in your plan's contact limit"
    );
    expect(broadcastRestrictionText("opted_out")).toBeNull();
    expect(broadcastRestrictionText(undefined)).toBeNull();
  });
});
