import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
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

vi.mock("@/client-api/functions/stores", () => ({
  getStore: () => getStore(),
  getStoreOrders: () => getStoreOrders(),
  getStoreStatuses: () => getStoreStatuses(),
  checkStoreConnection: vi.fn(),
  connectWooCommerce: vi.fn(),
  createStoreTemplates: vi.fn(),
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
            components: []
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {} })
}));

const { ConnectedStore } = await import("@/components/store/ConnectedStore");
const { StoreConnectForm, StorePlanNotice } = await import(
  "@/components/store/StoreConnectScreens"
);
const { useStore } = await import("@/hooks/useStore");
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
    custom_status: [{ variable: "{{4}}", label: "Order status" }]
  },
  readyMadeTemplates: [
    {
      kind: "order_confirmed",
      name: "store_order_confirmed",
      body: "Hi {{1}}",
      buttons: []
    }
  ]
});

afterEach(cleanup);

beforeEach(() => {
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
  getStoreOrders.mockResolvedValue({
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
  });
});

describe("Store screens", () => {
  it("shows a connected store with its messages, COD and orders", async () => {
    render(
      <ConnectedStore
        data={storeData(connection("connected"))}
        enabledForPlan
      />,
      { wrapper }
    );
    expect(screen.getByText("Asha's Shop")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText(/Meta bills you directly/)).toBeTruthy();
    expect(screen.getByText("Order confirmed")).toBeTruthy();
    expect(screen.getByText("Cash on delivery check")).toBeTruthy();
    expect(screen.getByText("Order completed / shipped")).toBeTruthy();
    expect(screen.getByText("Order cancelled")).toBeTruthy();
    expect(
      screen.getByText("Send a message when an order moves to…")
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        "Cancel the order in my store when the customer taps Cancel"
      ).length
    ).toBeGreaterThan(0);
    // Two numbers: the sender step shows until one is chosen.
    expect(
      await screen.findByText("Choose the WhatsApp number to send from")
    ).toBeTruthy();

    expect(await screen.findByText("#1201")).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("₹1,499.00")).toBeTruthy();
    expect(screen.getByText("Waiting for customer")).toBeTruthy();
    expect(screen.getByText("Not sent")).toBeTruthy();
    expect(
      screen.getByText("No template is chosen for this message yet.")
    ).toBeTruthy();
    expect(screen.getAllByText("Out for delivery").length).toBeGreaterThan(0);
  });

  it("explains a store that needs attention and offers Reconnect", () => {
    render(
      <ConnectedStore
        data={storeData(
          connection("needs_attention", {
            attention: {
              reason: "unreachable",
              message:
                "Whatching hasn’t been able to reach your store for the last 30 minutes."
            }
          })
        )}
        enabledForPlan
      />,
      { wrapper }
    );
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText(/for the last 30 minutes/)).toBeTruthy();
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
