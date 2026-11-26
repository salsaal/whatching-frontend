import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignSource } from "@/client-api/types/campaigns.type";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (text: string) => toastError(text) }
}));

const botSettings: { value: Record<string, unknown> } = { value: {} };
const updateBotSettings = vi.fn();
vi.mock("@/client-api/functions/bot", () => ({
  getBotSettings: () =>
    Promise.resolve({
      status: "success",
      data: { settings: botSettings.value }
    }),
  updateBotSettings: (payload: unknown) => updateBotSettings(payload),
  getBotFlowTriggers: () =>
    Promise.resolve({
      status: "success",
      data: {
        triggers: [
          { triggerKey: "PRICE_LIST", name: "Price list", nodeId: "n1" },
          { triggerKey: "OPT_IN", name: "Subscribe", nodeId: "n2" }
        ]
      }
    }),
  isNoPublishedFlowError: () => false
}));

const campaigns: { list: CampaignSource[] } = { list: [] };
const performance: { value: Record<string, unknown> } = { value: {} };
const updateCampaignSource = vi.fn();
vi.mock("@/client-api/functions/campaigns", () => ({
  listCampaigns: () =>
    Promise.resolve({
      status: "success",
      data: {
        campaigns: campaigns.list,
        pagination: { page: 1, limit: 50, total: 1, pages: 1 }
      }
    }),
  updateCampaignSource: (args: unknown) => updateCampaignSource(args),
  getCampaignPerformance: () =>
    Promise.resolve({ status: "success", data: performance.value })
}));

const access = { flows: true };
vi.mock("@/hooks/useCurrentMembership", () => ({
  useCurrentMembership: () => ({
    can: (permission: string) =>
      permission === "flows:manage" ? access.flows : true,
    isLoading: false
  })
}));
vi.mock("@/stores/organizationStore", () => ({
  useOrganizationStore: (
    selector: (state: { activeOrganization: { _id: string } }) => unknown
  ) => selector({ activeOrganization: { _id: "org-1" } })
}));

const { AdReplyCard } = await import("@/components/campaigns/AdReplyCard");
const { AdReplyDialog } = await import("@/components/campaigns/AdReplyDialog");
const { default: CampaignsTab } = await import(
  "@/components/analytics/CampaignsTab"
);

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
};

const ad = (overrides: Partial<CampaignSource> = {}): CampaignSource => ({
  _id: "cs-1",
  orgId: "org-1",
  sourceId: "ad-1",
  label: "Summer Sale · Video 1",
  labelSource: "meta_api",
  campaignId: "c-1",
  campaignName: "Summer Sale",
  sourceType: "ad",
  firstSeenAt: "2026-11-01T00:00:00.000Z",
  lastTouchAt: "2026-11-20T00:00:00.000Z",
  touchCount: 9,
  subscriberCount: 7,
  ...overrides
});

afterEach(cleanup);
beforeEach(() => {
  toastError.mockReset();
  updateBotSettings.mockReset();
  updateCampaignSource.mockReset();
  botSettings.value = { isBotEnabled: true };
  campaigns.list = [];
  access.flows = true;
});

describe("Reply to people from your ads", () => {
  it("starts on the normal bot reply and saves a typed message", async () => {
    updateBotSettings.mockResolvedValue({
      status: "success",
      data: {
        settings: {
          isBotEnabled: true,
          adReply: { mode: "message", text: "Thanks!" }
        }
      }
    });
    wrap(<AdReplyCard />);

    const normal = await screen.findByRole("radio", {
      name: "Normal bot reply"
    });
    expect(normal.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("radio", { name: "Same as all ads" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Send a message" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Type the message to send.")).toBeTruthy();
    expect(updateBotSettings).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Message to send"), {
      target: { value: "Thanks!" }
    });
    expect(screen.getByText("7/1024")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateBotSettings).toHaveBeenCalledWith({
        adReply: { mode: "message", text: "Thanks!" }
      })
    );
  });

  it("says ads get no reply while the bot is off", async () => {
    botSettings.value = { isBotEnabled: false };
    wrap(<AdReplyCard />);
    expect(
      await screen.findByText(/Your bot is off, so ads get no automatic reply/)
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Bot settings" }).getAttribute("href")
    ).toBe("/bot/settings");
  });

  it("shows the backend's message when saving fails", async () => {
    updateBotSettings.mockRejectedValue({
      response: {
        data: {
          message:
            "That flow isn’t live in your bot. Publish it first, then choose it again."
        }
      }
    });
    botSettings.value = {
      isBotEnabled: true,
      adReply: { mode: "message", text: "Old" }
    };
    wrap(<AdReplyCard />);
    fireEvent.change(await screen.findByLabelText("Message to send"), {
      target: { value: "New" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That flow isn’t live in your bot. Publish it first, then choose it again."
      )
    );
  });
});

describe("one ad's reply", () => {
  it("goes back to the all-ads reply with 'Same as all ads'", async () => {
    updateCampaignSource.mockResolvedValue({
      status: "success",
      data: { campaign: ad() }
    });
    wrap(
      <AdReplyDialog
        campaign={ad({ reply: { mode: "message", text: "Hi" } })}
        onOpenChange={() => undefined}
      />
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Summer Sale · Video 1")).toBeTruthy();
    expect(
      (within(dialog).getByLabelText("Message to send") as HTMLTextAreaElement)
        .value
    ).toBe("Hi");

    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Same as all ads" })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateCampaignSource).toHaveBeenCalledWith({
        campaignSourceId: "cs-1",
        reply: { mode: "default" }
      })
    );
  });

  it("asks for a flow before saving 'Start a flow'", async () => {
    wrap(<AdReplyDialog campaign={ad()} onOpenChange={() => undefined} />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Start a flow" })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByText("Choose the flow to start.")).toBeTruthy();
    expect(updateCampaignSource).not.toHaveBeenCalled();
  });
});

describe("Ads page table", () => {
  it("shows each ad's own name and its reply", async () => {
    campaigns.list = [
      ad({ reply: { mode: "flow", triggerKey: "PRICE_LIST" } }),
      ad({ _id: "cs-2", sourceId: "ad-2", label: "Summer Sale · Photo" })
    ];
    wrap(<CampaignsTab />);
    expect(await screen.findByText("Summer Sale · Video 1")).toBeTruthy();
    expect(screen.getByText("Summer Sale · Photo")).toBeTruthy();
    expect(await screen.findByText("Flow: Price list")).toBeTruthy();
    expect(screen.getByText("Same as all ads")).toBeTruthy();
  });

  it("leaves out the Reply column without bot access", async () => {
    access.flows = false;
    campaigns.list = [ad()];
    wrap(<CampaignsTab />);
    await screen.findByText("Summer Sale · Video 1");
    expect(screen.queryByRole("columnheader", { name: "Reply" })).toBeNull();
    expect(screen.queryByText("Same as all ads")).toBeNull();
  });

  it("shows spend for the whole campaign, with its currency", async () => {
    campaigns.list = [ad()];
    performance.value = {
      campaign: ad(),
      scope: "campaign",
      campaignName: "Summer Sale",
      adsInCampaign: 3,
      spendAvailable: true,
      range: { start: "2026-10-27", end: "2026-11-26" },
      spend: {
        amount: 1200,
        currency: "INR",
        impressions: 5000,
        clicks: 120,
        reach: 4000
      },
      leadsInRange: 0,
      touches: { subscriberCount: 40, touchCount: 55 },
      costPerConversation: null
    };
    wrap(<CampaignsTab />);
    await screen.findByText("Summer Sale · Video 1");
    fireEvent.click(
      screen.getByRole("button", { name: "View spend & cost-per-outcome" })
    );
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("(3 ads)")).toBeTruthy();
    expect(within(dialog).getByText("₹1,200.00")).toBeTruthy();
    expect(within(dialog).getByText("–")).toBeTruthy();
    expect(
      within(dialog).getByText(/All-time leads from this ad:/).textContent
    ).toContain("40");
  });

  it("says there's no spend yet instead of showing ₹0", async () => {
    campaigns.list = [ad()];
    performance.value = {
      campaign: ad(),
      scope: "campaign",
      campaignName: "Summer Sale",
      adsInCampaign: 1,
      spendAvailable: false,
      message: "No ad spend has been synced for these dates yet.",
      range: { start: "2026-10-27", end: "2026-11-26" },
      spend: null,
      leadsInRange: 4,
      touches: { subscriberCount: 7, touchCount: 9 },
      costPerConversation: null
    };
    wrap(<CampaignsTab />);
    await screen.findByText("Summer Sale · Video 1");
    fireEvent.click(
      screen.getByRole("button", { name: "View spend & cost-per-outcome" })
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(/No ad spend for these dates yet\./)
    ).toBeTruthy();
    expect(within(dialog).getByText("(1 ad)")).toBeTruthy();
    expect(within(dialog).queryByText(/₹0/)).toBeNull();
  });
});
