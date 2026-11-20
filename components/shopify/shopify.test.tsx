import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShopifyStoreData } from "@/client-api/types/shopify.type";
import type { StoreConnection } from "@/client-api/types/stores.type";

// Radix measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const api = {
  openShopifySession: vi.fn(),
  linkShopify: vi.fn(),
  unlinkShopify: vi.fn(),
  getShopifyStore: vi.fn(),
  updateShopifyStoreSettings: vi.fn(),
  createShopifyStoreTemplates: vi.fn(),
  getShopifyStoreOrders: vi.fn(),
  checkShopifyStore: vi.fn()
};
vi.mock("@/client-api/functions/shopify", () => ({
  openShopifySession: () => api.openShopifySession(),
  linkShopify: (payload: unknown) => api.linkShopify(payload),
  unlinkShopify: () => api.unlinkShopify(),
  getShopifyStore: () => api.getShopifyStore(),
  updateShopifyStoreSettings: (payload: unknown) =>
    api.updateShopifyStoreSettings(payload),
  createShopifyStoreTemplates: (payload: unknown) =>
    api.createShopifyStoreTemplates(payload),
  getShopifyStoreOrders: (args: unknown) => api.getShopifyStoreOrders(args),
  checkShopifyStore: () => api.checkShopifyStore()
}));

const { ShopifyApp } = await import("@/components/shopify/ShopifyApp");
const { NotInShopifyError } = await import("@/client-api/shopifyInstance");

const shop = { domain: "whatching-test.myshopify.com", name: "Whatching Test" };
const session = (linked: boolean) => ({
  status: "success",
  data: {
    shop,
    link: linked ? { workspaceName: "Acme", linkedAt: null } : null
  }
});

const connection = (extra: Partial<StoreConnection> = {}): StoreConnection => ({
  id: "c1",
  platform: "shopify",
  status: "connected",
  storeUrl: "https://whatching-test.myshopify.com",
  storeName: "Whatching Test",
  settings: {
    messages: {
      order_confirmed: { enabled: true },
      cod_confirmation: { enabled: true },
      order_shipped: { enabled: true },
      order_cancelled: { enabled: false }
    },
    cod: { autoCancel: false }
  },
  ...extra
});

const storeData = (extra: Partial<ShopifyStoreData> = {}) => ({
  status: "success",
  data: {
    enabledForPlan: true,
    connection: connection(),
    templateVariables: {
      order_shipped: [{ variable: "{{1}}", label: "Customer’s first name" }]
    },
    readyMadeTemplates: [
      {
        kind: "order_confirmed",
        name: "store_order_confirmed",
        body: "Hi {{1}}, thanks for your order.",
        buttons: []
      }
    ],
    workspace: { name: "Acme" },
    whatsappConnected: false,
    whatchingUrl: "https://app.whatching.example",
    templates: [
      {
        name: "store_order_confirmed",
        language: "en",
        category: "UTILITY",
        status: "APPROVED"
      }
    ],
    ...extra
  }
});

const renderApp = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ShopifyApp />
    </QueryClientProvider>
  );

const openTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }));

const fillLinkForm = () => {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@example.com" }
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret-password" }
  });
};

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getShopifyStore.mockResolvedValue(storeData());
  api.getShopifyStoreOrders.mockResolvedValue({
    status: "success",
    data: {
      page: 1,
      limit: 25,
      total: 1,
      orders: [
        {
          id: "o1",
          orderNumber: "1001",
          status: "paid",
          isCod: false,
          total: "500.00",
          currency: "INR",
          customerName: "Asha Rao",
          subscriberId: "s1",
          placedAt: new Date().toISOString(),
          cod: null,
          messages: [{ kind: "order_shipped", status: "delivered" }]
        }
      ]
    }
  });
});
afterEach(cleanup);

describe("Link screen", () => {
  it("connects only once the checkout box is ticked", async () => {
    api.openShopifySession.mockResolvedValue(session(false));
    api.linkShopify.mockResolvedValue(session(true));
    renderApp();

    expect(
      await screen.findByText("Connect your Whatching account")
    ).toBeTruthy();
    fillLinkForm();
    const connect = screen.getByRole("button", { name: "Connect" });
    expect((connect as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "My store's checkout tells customers they'll get order updates on WhatsApp."
      })
    );
    expect((connect as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(connect);

    await waitFor(() =>
      expect(api.linkShopify).toHaveBeenCalledWith({
        email: "owner@example.com",
        password: "secret-password",
        optInConfirmed: true
      })
    );
    // Linked: the store screens load.
    expect(await screen.findByRole("tab", { name: "Home" })).toBeTruthy();
  });

  it("opens Whatching sign-up in a new tab", async () => {
    api.openShopifySession.mockResolvedValue(session(false));
    renderApp();
    const signUp = await screen.findByRole("link", {
      name: "Create an account"
    });
    expect(signUp.getAttribute("href")).toBe("/auth/signup");
    expect(signUp.getAttribute("target")).toBe("_blank");
  });

  it("asks which workspace, then sends the same details with it", async () => {
    api.openShopifySession.mockResolvedValue(session(false));
    api.linkShopify
      .mockResolvedValueOnce({
        status: "success",
        data: {
          needsWorkspace: true,
          workspaces: [
            { id: "w1", name: "Acme" },
            { id: "w2", name: "Beta" }
          ]
        }
      })
      .mockResolvedValueOnce(session(true));
    renderApp();

    await screen.findByText("Connect your Whatching account");
    fillLinkForm();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(
      await screen.findByText("Which workspace should this store use?")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(api.linkShopify).toHaveBeenLastCalledWith({
        email: "owner@example.com",
        password: "secret-password",
        optInConfirmed: true,
        workspaceId: "w2"
      })
    );
  });

  it("shows the reason a link was refused", async () => {
    api.openShopifySession.mockResolvedValue(session(false));
    api.linkShopify.mockRejectedValue({
      response: {
        status: 403,
        data: { message: "Please verify your email first." }
      }
    });
    renderApp();

    await screen.findByText("Connect your Whatching account");
    fillLinkForm();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(
      await screen.findByText("Please verify your email first.")
    ).toBeTruthy();
  });

  it("explains when opened outside Shopify admin", async () => {
    api.openShopifySession.mockRejectedValue(new NotInShopifyError());
    renderApp();
    expect(
      await screen.findByText("Open Whatching from your Shopify admin.")
    ).toBeTruthy();
  });
});

describe("Store screens", () => {
  beforeEach(() => {
    api.openShopifySession.mockResolvedValue(session(true));
  });

  it("shows the status and the setup checklist on Home", async () => {
    renderApp();
    expect(await screen.findByText("Setup")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("Whatching account connected")).toBeTruthy();
    expect(screen.getByText("Linked to the Acme workspace.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Connect WhatsApp on Whatching/ })
        .getAttribute("href")
    ).toBe("https://app.whatching.example");
    expect(screen.getByText("Message templates ready")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create ready-made templates" })
    ).toBeTruthy();
    expect(screen.getByText("Phone number at checkout")).toBeTruthy();
    expect(
      screen.getByText(/set Shipping address phone number to Required/)
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Editing the checkout form options/ })
        .getAttribute("href")
    ).toContain("checkout-form-options#customer-contact-method");
    expect(
      screen.queryByText(/plan doesn’t include|plan doesn't include/)
    ).toBe(null);
  });

  it("opens the ready-made templates inline, not in a pop-up", async () => {
    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: "Create ready-made templates" })
    );
    expect(
      screen.getByRole("button", { name: "Create templates" })
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBe(null);
  });

  it("says when the plan doesn't include store messages", async () => {
    api.getShopifyStore.mockResolvedValue(storeData({ enabledForPlan: false }));
    renderApp();
    expect(
      await screen.findByText(/plan doesn.t include store messages/)
    ).toBeTruthy();
  });

  it("words Messages for Shopify, without order statuses", async () => {
    renderApp();
    await screen.findByText("Setup");
    openTab("Messages");
    expect(await screen.findByText("Order shipped")).toBeTruthy();
    expect(
      screen.getByText("Sent when you mark the order fulfilled in Shopify.")
    ).toBeTruthy();
    expect(screen.queryByText("Send when an order is marked")).toBe(null);
    expect(screen.queryByText("Send a message when an order moves to…")).toBe(
      null
    );
  });

  it("words Cash on delivery for Shopify, without payment methods", async () => {
    renderApp();
    await screen.findByText("Setup");
    openTab("Cash on delivery");
    expect(
      await screen.findByText(
        "Cancel the order in Shopify when the customer taps Cancel"
      )
    ).toBeTruthy();
    expect(
      screen.getByText(/Only orders that haven.t been fulfilled are cancelled/)
    ).toBeTruthy();
    expect(screen.getByText(/COD No Reply/)).toBeTruthy();
    expect(screen.queryByText("Advanced")).toBe(null);
  });

  it("lists orders with their messages, without chat links", async () => {
    renderApp();
    await screen.findByText("Setup");
    openTab("Orders");
    expect(await screen.findByText("#1001")).toBeTruthy();
    expect(screen.getByText("Asha Rao").tagName).toBe("SPAN");
    expect(screen.getByText("Order shipped")).toBeTruthy();
  });

  it("goes back to the Link screen when the store isn't linked", async () => {
    api.getShopifyStore.mockRejectedValue({
      response: { status: 409, data: { code: "not_linked" } }
    });
    renderApp();
    expect(
      await screen.findByText("Connect your Whatching account")
    ).toBeTruthy();
  });

  it("unlinks after an inline confirmation", async () => {
    api.unlinkShopify.mockResolvedValue(session(false));
    renderApp();
    await screen.findByText("Setup");
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    expect(
      screen.getByText(
        "Whatching will stop sending order messages for this store. You can connect again any time."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBe(null);
    const buttons = screen.getAllByRole("button", { name: "Unlink" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(
      await screen.findByText("Connect your Whatching account")
    ).toBeTruthy();
    expect(api.unlinkShopify).toHaveBeenCalledTimes(1);
  });
});
