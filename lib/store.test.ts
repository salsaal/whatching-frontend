import { describe, expect, it } from "vitest";

import type { MessageTemplate } from "@/client-api/types/templates.type";
import type {
  StoreConnection,
  StoreResponse
} from "@/client-api/types/stores.type";

import {
  displayStoreUrl,
  formatOrderTotal,
  humanizeStatus,
  parseTemplateChoiceKey,
  storeMessageStatusPresentation,
  storeMessageTitle,
  storeReturnOutcome,
  storeScreen,
  storeTemplateOptions,
  templateChoiceKey,
  unavailableCustomStatuses
} from "./store";

const connection = (
  status: StoreConnection["status"],
  extra: Partial<StoreConnection> = {}
): StoreConnection => ({
  id: "c1",
  platform: "woocommerce",
  status,
  storeUrl: "https://shop.example",
  storeName: "Shop",
  ...extra
});

const data = (
  enabledForPlan: boolean,
  storeConnection: StoreConnection | null
): StoreResponse["data"] => ({
  enabledForPlan,
  connection: storeConnection,
  templateVariables: {},
  readyMadeTemplates: []
});

describe("storeScreen", () => {
  it("asks for a plan only when there's no live store", () => {
    expect(storeScreen(data(false, null))).toBe("plan");
    expect(storeScreen(data(false, connection("connected")))).toBe("connected");
  });

  it("shows Connect for no store, an unfinished one or a removed one", () => {
    expect(storeScreen(data(true, null))).toBe("connect");
    expect(storeScreen(data(true, connection("pending")))).toBe("connect");
    expect(storeScreen(data(true, connection("disconnected")))).toBe("connect");
  });

  it("shows the store while setting up, connected or needing attention", () => {
    expect(storeScreen(data(true, connection("connecting")))).toBe("connected");
    expect(storeScreen(data(true, connection("needs_attention")))).toBe(
      "connected"
    );
  });
});

describe("storeReturnOutcome", () => {
  it("waits while the store is still being set up", () => {
    expect(storeReturnOutcome(null)).toBe("waiting");
    expect(storeReturnOutcome(connection("pending"))).toBe("waiting");
    expect(storeReturnOutcome(connection("connecting"))).toBe("waiting");
  });

  it("finishes on connected, fails on a setup failure", () => {
    expect(storeReturnOutcome(connection("connected"))).toBe("connected");
    expect(
      storeReturnOutcome(
        connection("disconnected", { setupFailure: { message: "No" } })
      )
    ).toBe("failed");
  });
});

describe("store messages", () => {
  it("names extra status messages after their status", () => {
    expect(storeMessageTitle("order_shipped")).toBe(
      "Order completed / shipped"
    );
    expect(
      storeMessageTitle("status_out-for-delivery", [
        { status: "out-for-delivery", statusLabel: "Out for delivery" }
      ])
    ).toBe("Out for delivery");
    expect(storeMessageTitle("status_ready-to-ship")).toBe("Ready to ship");
    expect(humanizeStatus("wc-packed")).toBe("Packed");
  });

  it("words every message status plainly", () => {
    expect(storeMessageStatusPresentation("skipped").label).toBe("Not sent");
    expect(storeMessageStatusPresentation("claimed").label).toBe("Sending");
    expect(storeMessageStatusPresentation("read").label).toBe("Read");
  });

  it("keeps the shipped status and built-in ones out of extra messages", () => {
    const unavailable = unavailableCustomStatuses(["completed"]);
    expect(unavailable.has("completed")).toBe(true);
    expect(unavailable.has("processing")).toBe(true);
    expect(unavailable.has("out-for-delivery")).toBe(false);
  });
});

describe("store templates", () => {
  const template = (
    name: string,
    status: string,
    wabaId = "w1"
  ): MessageTemplate =>
    ({
      _id: name,
      name,
      language: "en",
      status,
      wabaId,
      category: "UTILITY",
      components: []
    }) as unknown as MessageTemplate;

  it("lists approved, then in-review templates from the sending account", () => {
    const options = storeTemplateOptions(
      [
        template("b_pending", "PENDING"),
        template("rejected", "REJECTED"),
        template("a_approved", "APPROVED"),
        template("other_account", "APPROVED", "w2")
      ],
      "w1"
    );
    expect(options.map((option) => option.name)).toEqual([
      "a_approved",
      "b_pending"
    ]);
  });

  it("round-trips a template choice", () => {
    expect(templateChoiceKey("order_update", "en_US")).toBe(
      "order_update::en_US"
    );
    expect(parseTemplateChoiceKey("order_update::en_US")).toEqual({
      name: "order_update",
      language: "en_US"
    });
    expect(templateChoiceKey("order_update", null)).toBe("");
    expect(parseTemplateChoiceKey("")).toBeNull();
  });
});

describe("store formatting", () => {
  it("formats totals and store addresses", () => {
    expect(formatOrderTotal("1499.00", "INR")).toBe("₹1,499.00");
    expect(formatOrderTotal("12", undefined)).toBe("12.00");
    expect(formatOrderTotal(undefined)).toBe("-");
    expect(displayStoreUrl("https://mystore.com/")).toBe("mystore.com");
  });
});
