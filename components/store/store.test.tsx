import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  StoreConnection,
  StoreResponse
} from "@/client-api/types/stores.type";

// Radix's checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const getStore = vi.fn();
const getStoreOrders = vi.fn();
const getStoreStatuses = vi.fn();
const getStoreSummary = vi.fn();
const getStoreCarts = vi.fn();
const createStoreTemplates = vi.fn();
// The Store page keeps its tab and filter in the URL.
const routerQuery: Record<string, string> = {};
const routerReplace = vi.fn();

vi.mock("@/client-api/functions/stores", () => ({
  getStore: () => getStore(),
  getStoreOrders: (args: unknown) => getStoreOrders(args),
  getStoreStatuses: () => getStoreStatuses(),
  getStoreSummary: () => getStoreSummary(),
  getStoreCarts: (args: unknown) => getStoreCarts(args),
  checkStoreConnection: vi.fn(),
  connectWooCommerce: vi.fn(),
  createStoreTemplates: (args: unknown) => createStoreTemplates(args),
  disconnectStore: vi.fn(),
  updateStoreSettings: vi.fn()
}));
vi.mock("@/client-api/functions/templates", () => ({
  getAllTemplates: () =>
    Promise.resolve({
      status: "success",
      data: {
        templates: [
          {
            _id: "t1",
            name: "store_order_confirmed",
            language: "en",
            status: "APPROVED",
            category: "UTILITY",
            wabaId: "waba-1",
            components: [
              {
                type: "BODY",
                text: "Hi {{1}}, thanks for order #{{2}} at {{3}}. Total {{4}}."
              }
            ]
          }
        ]
      }
    })
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
    numbers: [
      {
        phoneNumberId: "p1",
        wabaId: "waba-1",
        displayPhoneNumber: "+91 70447 02435",
        isDefault: true
      },
      {
        phoneNumberId: "p2",
        wabaId: "waba-1",
        displayPhoneNumber: "+91 98310 59165",
        isDefault: false
      }
    ]
  })
}));
vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: routerReplace,
    query: routerQuery,
    pathname: "/store"
  })
}));

const { ConnectedStore } = await import("@/components/store/ConnectedStore");
const { StoreConnectForm, StorePlanNotice } = await import(
  "@/components/store/StoreConnectScreens"
);
const { StorePastOrders } = await import("@/components/store/StorePastOrders");
const { useStore } = await import("@/hooks/useStore");
const { formatDayMonth } = await import("@/lib/storePage");
const { useOrganizationStore } = await import("@/stores/organizationStore");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

const connection = (
  status: StoreConnection["status"],
  extra: Partial<StoreConnection> = {}
): StoreConnection => ({
  id: "c1",
  platform: "woocommerce",
  status,
  storeUrl: "https://shop.example",
  storeName: "Asha's Shop",
  lastSyncAt: new Date().toISOString(),
  settings: {
    shippedStatuses: ["completed"],
    messages: {
      order_confirmed: {
        enabled: true,
        templateName: "store_order_confirmed",
        templateLanguage: "en"
      },
      cod_confirmation: { enabled: true },
      order_shipped: { enabled: true },
      order_cancelled: { enabled: false }
    },
    customStatusRules: [
      {
        status: "out-for-delivery",
        statusLabel: "Out for delivery",
        enabled: true
      }
    ],
    cod: { autoCancel: false, paymentMethods: ["cod"] }
  },
  ...extra
});

const storeData = (
  storeConnection: StoreConnection | null
): StoreResponse["data"] => ({
  enabledForPlan: true,
  connection: storeConnection,
  templateVariables: {
    order_confirmed: [{ variable: "{{1}}", label: "Customer’s first name" }],
    cod_confirmation: [
      { variable: "{{1}}", label: "Customer’s first name" },
      { variable: "{{2}}", label: "Order number" },
      { variable: "{{3}}", label: "Store name" }
    ],
    custom_status: [{ variable: "{{4}}", label: "Order status" }]
  },
  readyMadeTemplates: [
    {
      kind: "order_confirmed",
      name: "store_order_confirmed",
      body: "Hi {{1}}",
      buttons: []
    },
    {
      kind: "cod_confirmation",
      name: "store_cod_confirmation",
      body: "Hi {{1}}, you placed order #{{2}} with {{3}}.",
      buttons: ["Confirm order", "Cancel order"]
    }
  ]
});

const renderStore = (
  storeConnection: StoreConnection,
  query: Record<string, string> = {}
) => {
  Object.assign(routerQuery, query);
  return render(
    <ConnectedStore data={storeData(storeConnection)} enabledForPlan />,
    { wrapper }
  );
};

/** Radix tabs switch on mouse-down. */
const openTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

/** The "···" menu, then one of its items. */
const chooseFromMenu = async (item: string) => {
  fireEvent.keyDown(
    screen.getByRole("button", { name: "More store options" }),
    { key: "Enter" }
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(routerQuery)) delete routerQuery[key];
  getStoreSummary.mockResolvedValue({
    status: "success",
    data: {
      month: "2026-11",
      ordersMessaged: 21,
      cod: {
        waiting: 1,
        confirmed: 8,
        cancelRequested: 0,
        cancelled: 2,
        noReply: 1
      },
      carts: {
        remindersSent: 0,
        recoveredCount: 3,
        recoveredTotals: [{ currency: "INR", amount: "897.00" }]
      },
      notSent: { orders: 1, cartReminders: 0 }
    }
  });
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
  useOrganizationStore.setState({
    activeOrganization: { _id: "org-1", name: "Asha's Shop" }
  } as never);
  getStoreStatuses.mockResolvedValue({
    status: "success",
    data: {
      statuses: [
        { slug: "completed", name: "Completed" },
        { slug: "out-for-delivery", name: "Out for delivery" },
        { slug: "packed", name: "Packed" }
      ]
    }
  });
  getStoreOrders.mockImplementation(async (args: { show?: string }) =>
    args.show === "not_sent"
      ? {
          status: "success",
          data: { page: 1, limit: 25, total: 0, orders: [] }
        }
      : ordersPage
  );
});

const ordersPage = {
  status: "success",
  data: {
    page: 1,
    limit: 25,
    total: 1,
    orders: [
      {
        id: "o1",
        orderNumber: "1201",
        status: "processing",
        isCod: true,
        total: "1499.00",
        currency: "INR",
        customerName: "Asha Rao",
        subscriberId: "s1",
        placedAt: new Date().toISOString(),
        cod: { state: "awaiting" },
        messages: [
          {
            kind: "cod_confirmation",
            status: "skipped",
            reason: "No template is chosen for this message yet."
          },
          { kind: "status_out-for-delivery", status: "read" }
        ]
      }
    ]
  }
};

describe("Store screens", () => {
  it("shows the store card, this month's summary and the Overview", async () => {
    renderStore(connection("connected"));
    expect(screen.getByText("Asha's Shop")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText(/· WooCommerce · checked just now/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "shop.example" }).getAttribute("href")
    ).toBe("https://shop.example");

    // Summary
    expect(await screen.findByText("Orders messaged")).toBeTruthy();
    expect(screen.getByText("21")).toBeTruthy();
    expect(screen.getByText("8 confirmed")).toBeTruthy();
    expect(
      screen.getByText("2 cancelled · 1 no reply · 1 waiting")
    ).toBeTruthy();
    expect(screen.getByText("₹897.00")).toBeTruthy();
    expect(screen.getByText("Link the plugin to start")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /See Activity for why/ })
    ).toBeTruthy();

    // Tabs: no Cart reminders without the plugin field.
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Order messages",
      "Activity"
    ]);
    expect(
      screen
        .getByRole("tab", { name: "Overview" })
        .getAttribute("aria-selected")
    ).toBe("true");

    // What customers receive
    expect(screen.getByText("What your customers receive")).toBeTruthy();
    expect(screen.getByText("Order confirmed")).toBeTruthy();
    expect(screen.getByText("Cash on delivery check")).toBeTruthy();
    expect(screen.getByText("Order completed")).toBeTruthy();
    expect(screen.getByText("When the order is marked Completed")).toBeTruthy();
    expect(screen.getByText("Order cancelled")).toBeTruthy();
    expect(
      screen.getByText("When the order moves to Out for delivery")
    ).toBeTruthy();
    expect(screen.getAllByText("On")).toHaveLength(4);
    expect(screen.getAllByText("Off")).toHaveLength(1);

    // Setup, which stays
    expect(screen.getByText("Orders reach Whatching")).toBeTruthy();
    expect(await screen.findByText("1 of 4 approved by WhatsApp")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create ready-made templates" })
    ).toBeTruthy();
    // Two numbers and none chosen.
    expect(
      screen.getByRole("button", { name: "Choose a number" })
    ).toBeTruthy();
    expect(
      screen.getByText(/charges for each order message and cart reminder/)
    ).toBeTruthy();
  });

  it("opens Order messages, with what each customer reads", async () => {
    renderStore(connection("connected"));
    openTab("Order messages");
    expect(routerReplace).toHaveBeenCalledWith(
      { pathname: "/store", query: { tab: "messages" } },
      undefined,
      { shallow: true, scroll: false }
    );
    expect(
      screen.getByText(
        "Turn messages on or off. Each preview shows what a customer reads."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ready-made templates" })
    ).toBeTruthy();

    expect(await screen.findByText("Approved by WhatsApp")).toBeTruthy();
    expect(
      await screen.findByText(
        "Hi Zaki, thanks for order #1042 at Asha's Shop. Total ₹499.00."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", {
        name: "Change the template for Order confirmed"
      })
    ).toBeTruthy();
    // The others have no template yet.
    expect(
      screen.getAllByText("Choose a template to see what customers will read.")
    ).toHaveLength(4);
    expect(
      screen.getByRole("combobox", {
        name: "Choose the template for Cash on delivery check"
      })
    ).toBeTruthy();

    expect(screen.getByText("Send when an order is marked")).toBeTruthy();
    expect(screen.getByText("Message for other order statuses")).toBeTruthy();
    expect(
      screen.getByText(
        /like Refunded or On hold, or one added by a shipping plugin/
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("switch", {
        name: "Cancel the order when the customer taps Cancel"
      })
    ).toBeTruthy();
    expect(
      screen.getByText(/Cash-on-delivery payment methods/).textContent
    ).toBe("Cash-on-delivery payment methods: Cash on delivery · Change");
    expect(screen.getByText(/Customers get tags you can use/)).toBeTruthy();
  });

  it("offers ready-made templates for the messages without one", async () => {
    createStoreTemplates.mockResolvedValue({
      status: "success",
      data: {
        results: [
          { kind: "cod_confirmation", outcome: "created", status: "PENDING" }
        ]
      }
    });
    renderStore(connection("connected"), { tab: "messages" });
    // Wait for the templates, so the dialog knows which are set up.
    await screen.findByText("Approved by WhatsApp");
    fireEvent.click(
      screen.getByRole("button", { name: "Ready-made templates" })
    );

    expect(await screen.findByText("Already set up")).toBeTruthy();
    expect(screen.getByText("No approved template")).toBeTruthy();
    expect(
      screen
        .getByRole("checkbox", { name: "Create “Order confirmed”" })
        .getAttribute("aria-checked")
    ).toBe("false");
    expect(
      screen
        .getByRole("checkbox", { name: "Create “Cash on delivery check”" })
        .getAttribute("aria-checked")
    ).toBe("true");
    // What customers see, with its buttons.
    expect(
      screen.getByText("Hi Zaki, you placed order #1042 with Asha's Shop.")
    ).toBeTruthy();
    expect(screen.getByText("Confirm order")).toBeTruthy();

    const text = screen.getByLabelText(
      "Cash on delivery check message"
    ) as HTMLTextAreaElement;
    fireEvent.click(screen.getByRole("button", { name: "Order number" }));
    expect(text.value.match(/\{\{2\}\}/g)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Create 1 template" }));
    await waitFor(() =>
      expect(createStoreTemplates).toHaveBeenCalledWith({
        connectionId: "c1",
        payload: {
          language: "en",
          kinds: ["cod_confirmation"],
          bodyOverrides: { cod_confirmation: text.value.trim() }
        }
      })
    );
    expect(
      await screen.findByText(/Created and selected. Waiting for WhatsApp/)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });

  it("lists orders in Activity, with filters", async () => {
    renderStore(connection("connected"), { tab: "activity" });
    expect(await screen.findByText("#1201")).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("₹1,499.00")).toBeTruthy();
    // The filter, and the order's cash-on-delivery state.
    expect(screen.getAllByText("Waiting for customer")).toHaveLength(2);
    expect(
      screen.getByText("No template is chosen for this message yet.")
    ).toBeTruthy();
    expect(screen.getByText("Out for delivery")).toBeTruthy();

    const notSent = screen.getByRole("button", { name: /Not sent/ });
    // This month's count from the summary.
    await waitFor(() => expect(notSent.textContent).toBe("Not sent1"));
    fireEvent.click(notSent);
    expect(
      await screen.findByText("Nothing to fix. Every message went out.")
    ).toBeTruthy();
    expect(getStoreOrders).toHaveBeenCalledWith({
      connectionId: "c1",
      page: 1,
      limit: 25,
      show: "not_sent"
    });
    expect(notSent.getAttribute("aria-pressed")).toBe("true");
  });

  it("opens Activity's Not sent orders from the summary", async () => {
    renderStore(connection("connected"));
    fireEvent.click(
      await screen.findByRole("button", { name: /See Activity for why/ })
    );
    expect(
      screen
        .getByRole("tab", { name: "Activity" })
        .getAttribute("aria-selected")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /Not sent/ })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("keeps Reconnect and Disconnect in the store's menu", async () => {
    renderStore(connection("connected"));
    await chooseFromMenu("Reconnect");
    expect(await screen.findByText("Reconnect your store?")).toBeTruthy();
  });

  it("explains a store that needs attention and offers Reconnect", () => {
    renderStore(
      connection("needs_attention", {
        attention: {
          reason: "unreachable",
          message:
            "Whatching hasn’t been able to reach your store for the last 30 minutes."
        }
      })
    );
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(
      screen.getAllByText(/for the last 30 minutes/).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeTruthy();
  });

  it("hides Check connection while the store is still setting up", () => {
    render(
      <ConnectedStore
        data={storeData(connection("connecting"))}
        enabledForPlan
      />,
      { wrapper }
    );
    expect(screen.getByText("Setting up")).toBeTruthy();
    expect(screen.getByText(/finishing setting up your store/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check connection" })).toBe(
      null
    );
  });

  it("shows why the last setup failed on the connect screen", () => {
    render(
      <StoreConnectForm
        previous={connection("disconnected", {
          setupFailure: { message: "Setting up took too long." }
        })}
      />,
      { wrapper }
    );
    expect(screen.getByText("Setting up took too long.")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://yourstore.com")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Connect WooCommerce"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText(/WooCommerce will ask you/)).toBeTruthy();
  });

  it("keeps a disconnected store's past orders for 30 days", async () => {
    const disconnectedAt = new Date(Date.now() - 3 * 86_400_000);
    const previous = connection("disconnected", {
      disconnectedAt: disconnectedAt.toISOString()
    });
    render(
      <>
        <StoreConnectForm previous={previous} />
        <StorePastOrders connection={previous} />
      </>,
      { wrapper }
    );
    expect(
      screen.getByText(
        `You disconnected Asha's Shop on ${formatDayMonth(disconnectedAt)}. Connect it again below.`
      )
    ).toBeTruthy();
    expect(
      screen.getByText(/cash-on-delivery checks and completed-order updates/)
    ).toBeTruthy();
    expect(screen.getByText("Past orders from Asha's Shop")).toBeTruthy();
    const until = new Date(disconnectedAt.getTime() + 30 * 86_400_000);
    expect(
      screen.getByText(`Kept until ${formatDayMonth(until)}, then deleted.`)
    ).toBeTruthy();
    expect(await screen.findByText("#1201")).toBeTruthy();
    // No carts: no Carts list.
    await waitFor(() => expect(getStoreCarts).toHaveBeenCalled());
    expect(screen.queryByText("Carts")).toBe(null);
  });

  it("shows nothing once a disconnected store's history is gone", () => {
    const { container } = render(
      <StorePastOrders
        connection={connection("disconnected", {
          disconnectedAt: new Date(Date.now() - 31 * 86_400_000).toISOString()
        })}
      />,
      { wrapper }
    );
    expect(container.innerHTML).toBe("");
    expect(getStoreOrders).not.toHaveBeenCalled();
  });

  it("tells a workspace without the plan where stores are included", () => {
    render(<StorePlanNotice />, { wrapper });
    expect(
      screen.getByText(/included in the Basic and Pro plans/)
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "See plans" })).toBeTruthy();
  });
});

describe("useStore", () => {
  it("stays hidden, quietly, while the backend has no stores (404)", async () => {
    getStore.mockRejectedValue({ response: { status: 404 } });
    const { result } = renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.isHidden).toBe(true));
    expect(result.current.isAvailable).toBe(false);
    expect(getStore).toHaveBeenCalledTimes(1);
  });

  it("asks again every 5 seconds while the store is setting up", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getStore
        .mockReset()
        .mockResolvedValueOnce({
          status: "success",
          data: storeData(connection("connecting"))
        })
        .mockResolvedValue({
          status: "success",
          data: storeData(connection("connected"))
        });
      const { result } = renderHook(
        () => useStore({ fresh: true, pollWhileSettingUp: true }),
        { wrapper }
      );
      await waitFor(() =>
        expect(result.current.data?.data.connection?.status).toBe("connecting")
      );
      await vi.advanceTimersByTimeAsync(5_000);
      await waitFor(() =>
        expect(result.current.data?.data.connection?.status).toBe("connected")
      );
      // Connected: no more asking.
      await vi.advanceTimersByTimeAsync(15_000);
      expect(getStore).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows once the backend answers", async () => {
    getStore.mockResolvedValue({ status: "success", data: storeData(null) });
    const { result } = renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.isAvailable).toBe(true));
    expect(result.current.isHidden).toBe(false);
  });
});
