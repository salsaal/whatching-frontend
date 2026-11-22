import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ConversationCostResponse,
  FreeRepliesResponse
} from "@/client-api/types/analytics.type";

// Recharts' ResponsiveContainer measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const getFreeReplies = vi.fn();

vi.mock("@/client-api/functions/analytics", () => ({
  getFreeReplies: () => getFreeReplies()
}));

const { FreeRepliesCard } = await import(
  "@/components/analytics/FreeRepliesCard"
);
const { SpendHeroCard } = await import("@/components/analytics/SpendHeroCard");
const { useOrganizationStore } = await import("@/stores/organizationStore");

const renderWithQueries = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
};

const usage = (
  data: Partial<FreeRepliesResponse["data"]> = {}
): FreeRepliesResponse => ({
  status: "success",
  data: {
    month: "2026-11",
    resetsOn: "2026-12-01",
    freeRepliesPerMonth: 1000,
    lastUpdatedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    numbers: [
      {
        phoneNumberId: "p1",
        displayPhoneNumber: "+91 98765 43210",
        verifiedName: "Acme Store",
        freeRepliesUsed: 812,
        freeRepliesLeft: 188,
        chargedReplies: 0,
        state: "nearly_used"
      },
      {
        phoneNumberId: "p2",
        displayPhoneNumber: "+91 91234 56789",
        verifiedName: "Acme Support",
        freeRepliesUsed: 1000,
        freeRepliesLeft: 0,
        chargedReplies: 37,
        state: "used_up"
      },
      {
        phoneNumberId: "p3",
        displayPhoneNumber: "+91 90000 00000",
        verifiedName: null,
        freeRepliesUsed: 40,
        freeRepliesLeft: 960,
        chargedReplies: 0,
        state: "ok"
      }
    ],
    ...data
  }
});

beforeEach(() => {
  getFreeReplies.mockReset();
  useOrganizationStore.setState({
    activeOrganization: { _id: "org-1", name: "Acme" }
  } as never);
});

afterEach(cleanup);

describe("FreeRepliesCard", () => {
  it("shows each number's free replies", async () => {
    getFreeReplies.mockResolvedValue(usage());
    renderWithQueries(<FreeRepliesCard />);

    expect(
      await screen.findByText("Free customer replies this month")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "WhatsApp gives each number 1,000 free replies a month. Starts again on 1 December."
      )
    ).toBeTruthy();

    expect(screen.getByText("Acme Store")).toBeTruthy();
    expect(screen.getByText("+91 98765 43210")).toBeTruthy();
    expect(screen.getByText("812 of 1,000 used")).toBeTruthy();
    expect(screen.getByText("188 free replies left")).toBeTruthy();

    expect(screen.getByText("1,000 of 1,000 used")).toBeTruthy();
    expect(
      screen.getByText("All free replies used · 37 charged replies so far")
    ).toBeTruthy();

    // No name: the number is the name, shown once.
    expect(screen.getAllByText("+91 90000 00000")).toHaveLength(1);
    expect(screen.getByText("40 of 1,000 used")).toBeTruthy();

    const bars = screen.getAllByRole("progressbar");
    expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual([
      "812",
      "1000",
      "40"
    ]);
    expect(
      screen.getByText(/Updated 3 h ago\. These counts are close estimates/)
    ).toBeTruthy();
  });

  it("says the counts are on their way before the first refresh", async () => {
    getFreeReplies.mockResolvedValue(usage({ lastUpdatedAt: null }));
    renderWithQueries(<FreeRepliesCard />);

    expect(
      await screen.findByText(
        "We'll show your free replies here within a few hours."
      )
    ).toBeTruthy();
    expect(screen.queryByText("Acme Store")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/Updated/)).toBeNull();
  });

  it("is hidden with no numbers, or when it can't load", async () => {
    getFreeReplies.mockResolvedValue(usage({ numbers: [] }));
    const { container, unmount } = renderWithQueries(<FreeRepliesCard />);
    await waitFor(() => expect(getFreeReplies).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
    unmount();

    getFreeReplies.mockRejectedValue({ response: { status: 403 } });
    const failed = renderWithQueries(<FreeRepliesCard />);
    await waitFor(() => expect(getFreeReplies).toHaveBeenCalledTimes(2));
    expect(failed.container.innerHTML).toBe("");
  });
});

describe("SpendHeroCard wording", () => {
  it("counts Meta's messages, charged or free", () => {
    const costs: ConversationCostResponse["data"] = {
      range: { start: "2026-10-24", end: "2026-11-22" },
      groupBy: "category",
      currency: null,
      lastSyncedDate: "2026-11-22",
      costDataAvailable: false,
      totals: { conversationCount: 200, cost: 0, costPerConversation: 0 },
      previousPeriod: {
        conversationCount: 150,
        cost: 0,
        costPerConversation: 0
      },
      billable: { conversationCount: 50, cost: 0 },
      freeTier: { conversationCount: 150, cost: 0 },
      daily: [],
      breakdown: []
    };
    render(<SpendHeroCard costs={costs} />);

    expect(screen.getByText("Messages in this period")).toBeTruthy();
    expect(screen.getByText("Prior period 150 messages")).toBeTruthy();
    expect(screen.getByText("Charged share")).toBeTruthy();
    expect(screen.getByText("25% charged")).toBeTruthy();
    expect(screen.getByText("50 charged · 150 free")).toBeTruthy();
    expect(screen.getByText("Daily message volume")).toBeTruthy();
    expect(screen.queryByText(/conversation|billable/i)).toBeNull();
  });
});
