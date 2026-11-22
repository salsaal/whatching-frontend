import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  StoreConnection,
  StoreResponse
} from "@/client-api/types/stores.type";

// Radix's checkbox and switch measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const getStore = vi.fn();
const getStoreCarts = vi.fn();
const createStorePluginCode = vi.fn();
const createCartTemplate = vi.fn();
const updateStoreSettings = vi.fn();
const getStoreSummary = vi.fn();
const toastSuccess = vi.fn();
// The Store page keeps its tab in the URL (?tab=carts).
const routerQuery: Record<string, string> = {};

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: vi.fn(),
    warning: vi.fn()
  }
}));
vi.mock("@/client-api/functions/stores", () => ({
  getStore: () => getStore(),
  getStoreCarts: (args: unknown) => getStoreCarts(args),
  createStorePluginCode: (id: string) => createStorePluginCode(id),
  createCartTemplate: (args: unknown) => createCartTemplate(args),
  updateStoreSettings: (args: unknown) => updateStoreSettings(args),
  getStoreSummary: () => getStoreSummary(),
  getStoreOrders: () =>
    Promise.resolve({
      status: "success",
      data: { page: 1, limit: 25, total: 0, orders: [] }
    }),
  getStoreStatuses: () =>
    Promise.resolve({ status: "success", data: { statuses: [] } }),
  checkStoreConnection: vi.fn(),
  createStoreTemplates: vi.fn(),
  disconnectStore: vi.fn()
}));
vi.mock("@/client-api/functions/templates", () => ({
  getAllTemplates: () =>
    Promise.resolve({ status: "success", data: { templates: [] } })
}));
vi.mock("@/hooks/useCurrentMembership", () => ({
  useCurrentMembership: () => ({
    can: () => true,
    isOwner: true,
    isLoading: false
  })
}));
vi.mock("@/components/whatsapp/WhatsAppNumberSwitcher", () => ({
  useWhatsAppNumberContext: () => ({
    numbers: [{ phoneNumberId: "p1", wabaId: "waba-1", isDefault: true }]
  })
}));
vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    query: routerQuery,
    pathname: "/store"
  })
}));

const { ConnectedStore } = await import("@/components/store/ConnectedStore");
const { useStore } = await import("@/hooks/useStore");
const { useOrganizationStore } = await import("@/stores/organizationStore");

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapperWith = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

const linkedPlugin = {
  connected: true,
  connectedAt: "2026-11-21T09:48:04.605Z",
  version: "1.0.0",
  lastSeenAt: new Date(Date.now() - 3 * 3_600_000).toISOString()
};
const unlinkedPlugin = {
  connected: false,
  connectedAt: null,
  version: null,
  lastSeenAt: null
};

const connection = (extra: Partial<StoreConnection> = {}): StoreConnection => ({
  id: "c1",
  platform: "woocommerce",
  status: "connected",
  storeUrl: "https://shop.example",
  storeName: "Asha's Shop",
  settings: {
    senderPhoneNumberId: "p1",
    messages: {},
    cartReminders: {
      enabled: false,
      consentConfirmedAt: null,
      steps: [
        { enabled: true, delayMinutes: 60, templateName: null },
        { enabled: true, delayMinutes: 360, templateName: null },
        { enabled: true, delayMinutes: 1440, templateName: null }
      ]
    }
  },
  plugin: linkedPlugin,
  ...extra
});

const storeData = (
  storeConnection: StoreConnection
): StoreResponse["data"] => ({
  enabledForPlan: true,
  connection: storeConnection,
  templateVariables: {
    cart_reminder: [
      { variable: "{{1}}", label: "Customer’s first name" },
      { variable: "{{2}}", label: "Items in the cart" }
    ]
  },
  readyMadeTemplates: [],
  readyMadeCartTemplate: {
    name: "store_cart_reminder",
    body: "Hi {{1}}, you left {{2}} in your cart at {{3}}.",
    linkButton: "Complete my order"
  }
});

const renderStore = (
  storeConnection: StoreConnection,
  query: Record<string, string> = {}
) => {
  Object.assign(routerQuery, query);
  return render(
    <ConnectedStore data={storeData(storeConnection)} enabledForPlan />,
    { wrapper: wrapperWith(newClient()) }
  );
};

const CARTS_TAB = { tab: "carts" };

/** The "···" menu, then one of its items. */
const chooseFromMenu = async (item: string) => {
  fireEvent.keyDown(
    screen.getByRole("button", { name: "More store options" }),
    { key: "Enter" }
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
};

const summary = (extra: Record<string, unknown> = {}) => ({
  status: "success",
  data: {
    month: "2026-11",
    ordersMessaged: 0,
    cod: { waiting: 0, confirmed: 0, cancelRequested: 0, cancelled: 0, noReply: 0 },
    carts: { remindersSent: 0, recoveredCount: 0, recoveredTotals: [] },
    notSent: { orders: 0, cartReminders: 0 },
    ...extra
  }
});

const savedWith = (storeConnection: StoreConnection) =>
  updateStoreSettings.mockResolvedValue({
    status: "success",
    data: { connection: storeConnection, warnings: [] }
  });

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(routerQuery)) delete routerQuery[key];
  getStoreSummary.mockResolvedValue(summary());
  useOrganizationStore.setState({
    activeOrganization: { _id: "org-1", name: "Asha's Shop" }
  } as never);
  getStoreCarts.mockResolvedValue({
    status: "success",
    data: {
      page: 1,
      limit: 25,
      total: 0,
      summary: { recoveredCount: 0, recoveredTotals: [] },
      carts: []
    }
  });
});

describe("Cart reminders on the Store page", () => {
  it("stays hidden until the backend sends the plugin", async () => {
    renderStore(connection({ plugin: undefined }), CARTS_TAB);
    expect(screen.queryByRole("tab", { name: "Cart reminders" })).toBe(null);
    expect(screen.queryByText("Cart reminders plugin")).toBe(null);
    // Without it, ?tab=carts falls back to Overview, with no carts step.
    expect(screen.getByText("What your customers receive")).toBeTruthy();
    expect(screen.queryByText("Link the cart plugin")).toBe(null);
    expect(getStoreCarts).not.toHaveBeenCalled();
    await chooseFromMenu("Disconnect store");
    expect(
      await screen.findByText(
        "Order messages will stop. Your order history here is kept for 30 days."
      )
    ).toBeTruthy();
  });

  it("says Disconnect also stops cart reminders", async () => {
    renderStore(connection());
    await chooseFromMenu("Disconnect store");
    expect(
      await screen.findByText(
        "Order messages and cart reminders will stop. Your order history here is kept for 30 days."
      )
    ).toBeTruthy();
  });

  it("leads from Setup to linking the plugin", () => {
    renderStore(connection({ plugin: unlinkedPlugin }));
    expect(
      screen.getByText("Install and link the plugin to turn them on")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Link the cart plugin" }));
    expect(
      screen.getByRole("tab", { name: "Cart reminders" }).getAttribute(
        "aria-selected"
      )
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Get code" })).toBeTruthy();
  });

  it("walks through installing and linking the plugin", () => {
    renderStore(connection({ plugin: unlinkedPlugin }), CARTS_TAB);
    expect(screen.getByText("Cart reminders plugin")).toBeTruthy();
    expect(screen.getByText(/Install our free WordPress plugin/)).toBeTruthy();
    const download = screen.getByRole("link", {
      name: /Download plugin \(\.zip\)/
    });
    expect(download.getAttribute("href")).toBe(
      "/downloads/whatching-cart-recovery.zip"
    );
    expect(screen.getByText(/Plugins › Add New › Upload Plugin/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Get code" })).toBeTruthy();
    // Nothing to set up until the plugin is linked.
    expect(
      screen.queryByRole("switch", { name: "Send cart reminders" })
    ).toBe(null);
    expect(screen.queryByText("Save reminders")).toBe(null);
  });

  it("shows the code, asks every 5 seconds, then says the plugin is linked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const notLinked = connection({ plugin: unlinkedPlugin });
      getStore.mockResolvedValue({
        status: "success",
        data: storeData(notLinked)
      });
      createStorePluginCode.mockResolvedValue({
        status: "success",
        data: {
          code: "a1b2c3d4e5f6a1b2c3d4e5f6",
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
        }
      });
      Object.assign(routerQuery, CARTS_TAB);
      function Page() {
        const store = useStore({ fresh: true });
        return store.data ? (
          <ConnectedStore data={store.data.data} enabledForPlan />
        ) : null;
      }
      render(<Page />, { wrapper: wrapperWith(newClient()) });

      fireEvent.click(await screen.findByRole("button", { name: "Get code" }));
      expect(await screen.findByText("a1b2c3d4e5f6a1b2c3d4e5f6")).toBeTruthy();
      expect(
        screen.getByText(/paste this code and click Connect/)
      ).toBeTruthy();
      expect(createStorePluginCode).toHaveBeenCalledWith("c1");
      const asked = getStore.mock.calls.length;

      getStore.mockResolvedValue({
        status: "success",
        data: storeData(connection({ plugin: linkedPlugin }))
      });
      await vi.advanceTimersByTimeAsync(5_000);
      await waitFor(() =>
        expect(toastSuccess).toHaveBeenCalledWith("Plugin linked.")
      );
      expect(getStore.mock.calls.length).toBeGreaterThan(asked);
      expect(screen.getByText("Linked")).toBeTruthy();
      expect(screen.queryByText("a1b2c3d4e5f6a1b2c3d4e5f6")).toBe(null);

      // Linked: no more asking.
      const after = getStore.mock.calls.length;
      await vi.advanceTimersByTimeAsync(20_000);
      expect(getStore.mock.calls.length).toBe(after);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers a new code once the code expires", async () => {
    createStorePluginCode.mockResolvedValue({
      status: "success",
      data: {
        code: "a1b2c3d4e5f6a1b2c3d4e5f6",
        expiresAt: new Date(Date.now() - 1000).toISOString()
      }
    });
    renderStore(connection({ plugin: unlinkedPlugin }), CARTS_TAB);
    fireEvent.click(screen.getByRole("button", { name: "Get code" }));
    expect(
      await screen.findByRole("button", { name: "Get a new code" })
    ).toBeTruthy();
    expect(screen.queryByText("a1b2c3d4e5f6a1b2c3d4e5f6")).toBe(null);
  });

  it("shows a linked plugin, and warns when it's been quiet", () => {
    renderStore(connection(), CARTS_TAB);
    expect(screen.getByText("Whatching Cart Recovery plugin")).toBeTruthy();
    expect(screen.getByText("Linked")).toBeTruthy();
    expect(screen.getByText("Version 1.0.0 · checked in 3 h ago")).toBeTruthy();
    expect(screen.queryByText(/haven't heard from the plugin/)).toBe(null);
    expect(screen.getByRole("button", { name: "Get a new code" })).toBeTruthy();
    expect(
      screen.getByText(
        "Use this if you reinstalled the plugin or moved your store."
      )
    ).toBeTruthy();
    cleanup();

    renderStore(
      connection({
        plugin: {
          ...linkedPlugin,
          lastSeenAt: new Date(Date.now() - 30 * 3_600_000).toISOString()
        }
      }),
      CARTS_TAB
    );
    expect(
      screen.getByText(
        /haven't heard from the plugin in a while. Check it's still active in WordPress./
      )
    ).toBeTruthy();
  });

  it("asks for consent the first time reminders are turned on", async () => {
    const current = connection();
    savedWith(current);
    renderStore(current, CARTS_TAB);
    expect(screen.getByText(/get up to 3 WhatsApp reminders/)).toBeTruthy();
    expect(screen.getByText(/charges its marketing rate/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("switch", { name: "Send cart reminders" })
    );
    const turnOn = await screen.findByRole("button", { name: "Turn on" });
    expect((turnOn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((turnOn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(turnOn);
    await waitFor(() =>
      expect(updateStoreSettings).toHaveBeenCalledWith({
        connectionId: "c1",
        payload: { cartReminders: { enabled: true, consentConfirmed: true } }
      })
    );
  });

  it("switches without asking once consent is confirmed", async () => {
    const current = connection({
      settings: {
        ...connection().settings,
        cartReminders: {
          ...connection().settings?.cartReminders,
          enabled: true,
          consentConfirmedAt: "2026-11-21T09:49:05.069Z"
        }
      }
    });
    savedWith(current);
    renderStore(current, CARTS_TAB);
    fireEvent.click(
      screen.getByRole("switch", { name: "Send cart reminders" })
    );
    await waitFor(() =>
      expect(updateStoreSettings).toHaveBeenCalledWith({
        connectionId: "c1",
        payload: { cartReminders: { enabled: false } }
      })
    );
    expect(screen.queryByRole("button", { name: "Turn on" })).toBe(null);
  });

  it("checks the delays, then saves all three reminders", async () => {
    const current = connection();
    savedWith(current);
    renderStore(current, CARTS_TAB);
    const save = screen.getByRole("button", { name: "Save reminders" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("You have unsaved changes")).toBe(null);

    const second = screen.getByLabelText("Send after the shopper leaves", {
      selector: "#cart-delay-1"
    });
    fireEvent.change(second, { target: { value: "0.5" } });
    expect(
      screen.getByText("Reminder 2 must be sent later than reminder 1.")
    ).toBeTruthy();
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(second, { target: { value: "80" } });
    expect(
      screen.getByText(
        "Each reminder can be sent between 30 minutes and 72 hours after the shopper leaves."
      )
    ).toBeTruthy();

    fireEvent.change(second, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("switch", { name: "Send reminder 3" }));
    expect((save as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    fireEvent.click(save);
    await waitFor(() =>
      expect(updateStoreSettings).toHaveBeenCalledWith({
        connectionId: "c1",
        payload: {
          cartReminders: {
            steps: [
              {
                enabled: true,
                delayMinutes: 60,
                templateName: null,
                templateLanguage: null
              },
              {
                enabled: true,
                delayMinutes: 480,
                templateName: null,
                templateLanguage: null
              },
              {
                enabled: false,
                delayMinutes: 1440,
                templateName: null,
                templateLanguage: null
              }
            ]
          }
        }
      })
    );
  });

  it("shows the backend's reason when the reminders are refused", async () => {
    updateStoreSettings.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message:
            "Cart reminders need a template with a link button whose web address ends in {{1}}, so the button can bring back the shopper’s cart."
        }
      }
    });
    renderStore(connection(), CARTS_TAB);
    fireEvent.change(
      screen.getByLabelText("Send after the shopper leaves", {
        selector: "#cart-delay-0"
      }),
      { target: { value: "2" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save reminders" }));
    expect(
      await screen.findByText(
        "Cart reminders need a template with a link button whose web address ends in {{1}}, so the button can bring back the shopper’s cart."
      )
    ).toBeTruthy();
  });

  it("creates the ready-made reminder template", async () => {
    createCartTemplate.mockResolvedValue({
      status: "success",
      data: {
        outcome: "created",
        templateName: "store_cart_reminder",
        language: "en",
        status: "PENDING",
        category: "MARKETING"
      }
    });
    renderStore(connection(), CARTS_TAB);
    // Each reminder previews what the shopper reads, until a template is chosen.
    expect(
      screen.getAllByText("Choose a template to see what customers will read.")
    ).toHaveLength(3);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Create ready-made reminder template"
      })
    );
    expect(await screen.findByText("Complete my order")).toBeTruthy();
    expect(screen.getByText("Items in the cart")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));
    await waitFor(() =>
      expect(createCartTemplate).toHaveBeenCalledWith({
        connectionId: "c1",
        payload: { language: "en" }
      })
    );
    expect(
      await screen.findByText(
        /Created, and your reminders now use it. Waiting for WhatsApp/
      )
    ).toBeTruthy();
  });

  it("waits for WhatsApp's approval instead of offering the template again", () => {
    renderStore(
      connection({
        settings: {
          ...connection().settings,
          cartReminders: {
            enabled: true,
            consentConfirmedAt: "2026-11-21T09:49:05.069Z",
            steps: [
              {
                enabled: true,
                delayMinutes: 60,
                templateName: "store_cart_reminder",
                templateLanguage: "en"
              },
              { enabled: true, delayMinutes: 360 },
              { enabled: true, delayMinutes: 1440 }
            ]
          }
        }
      }),
      CARTS_TAB
    );
    expect(
      screen.getByText(/Waiting for WhatsApp to approve your template/)
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Create ready-made reminder template"
      })
    ).toBe(null);
  });
});

describe("Activity › Carts", () => {
  const CARTS_VIEW = { tab: "activity", view: "carts" };

  it("asks to link the plugin first", () => {
    renderStore(connection({ plugin: unlinkedPlugin }), CARTS_VIEW);
    expect(
      screen.getByText("Link the cart plugin to see carts here.")
    ).toBeTruthy();
    expect(getStoreCarts).not.toHaveBeenCalled();
  });

  it("lists carts with what happened to each", async () => {
    getStoreSummary.mockResolvedValue(
      summary({
        carts: {
          remindersSent: 3,
          recoveredCount: 1,
          recoveredTotals: [{ currency: "INR", amount: "299.00" }]
        }
      })
    );
    getStoreCarts.mockResolvedValue({
      status: "success",
      data: {
        page: 1,
        limit: 25,
        total: 3,
        summary: {
          recoveredCount: 1,
          recoveredTotals: [{ currency: "INR", amount: "299.00" }]
        },
        carts: [
          {
            id: "k1",
            customerName: "Zaki",
            subscriberId: "s1",
            items: "Test Mug",
            itemCount: 1,
            total: "299.00",
            currency: "INR",
            status: "converted",
            stopReason: null,
            recovered: true,
            orderNumber: "18",
            lastActivityAt: new Date().toISOString(),
            nextReminderAt: null,
            reminders: [
              {
                step: 1,
                status: "read",
                reason: null,
                templateName: "store_cart_reminder",
                at: new Date().toISOString()
              }
            ]
          },
          {
            id: "k2",
            customerName: null,
            subscriberId: null,
            items: "Blue T-shirt ×2",
            itemCount: 2,
            total: "998.00",
            currency: "INR",
            status: "stopped",
            stopReason: "The shopper replied on WhatsApp.",
            recovered: false,
            orderNumber: null,
            lastActivityAt: new Date().toISOString(),
            nextReminderAt: null,
            reminders: [
              {
                step: 1,
                status: "skipped",
                reason: "No template is chosen for this reminder yet.",
                templateName: null,
                at: new Date().toISOString()
              },
              {
                step: 2,
                status: "failed",
                reason: null,
                templateName: "store_cart_reminder",
                at: new Date().toISOString()
              }
            ]
          }
        ]
      }
    });
    renderStore(connection(), CARTS_VIEW);
    expect(await screen.findByText("Zaki")).toBeTruthy();
    expect(getStoreCarts).toHaveBeenCalledWith({
      connectionId: "c1",
      page: 1,
      limit: 25
    });
    expect(
      await screen.findByText("Recovered this month: 1 cart · ₹299.00")
    ).toBeTruthy();
    expect(
      screen.getByText(/Carts that became orders after a reminder/)
    ).toBeTruthy();
    // Orders filters belong to Orders only.
    expect(screen.queryByRole("button", { name: "Not sent" })).toBe(null);
    expect(screen.getByText("Recovered · order #18")).toBeTruthy();
    expect(screen.getByText("Reminder 1: Read")).toBeTruthy();
    // The column heading, and the cart without a name.
    expect(screen.getAllByText("Shopper")).toHaveLength(2);
    expect(screen.getByText("Stopped")).toBeTruthy();
    expect(screen.getByText("The shopper replied on WhatsApp.")).toBeTruthy();
    expect(screen.getByText("Reminder 1: Not sent")).toBeTruthy();
    expect(
      screen.getByText("No template is chosen for this reminder yet.")
    ).toBeTruthy();
    // A failed reminder can come without a reason: the chip alone.
    const failed = screen.getByText("Reminder 2: Failed");
    expect(failed.closest("li")?.querySelector("p")).toBeNull();
  });

  it("explains an empty log", async () => {
    renderStore(connection(), CARTS_VIEW);
    expect(
      await screen.findByText(
        "No carts yet. When a shopper types their phone number at checkout and leaves, it shows up here."
      )
    ).toBeTruthy();
    expect(
      await screen.findByText("Recovered this month: 0 carts")
    ).toBeTruthy();
  });
});
