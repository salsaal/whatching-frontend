import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Broadcast } from "@/client-api/types/broadcasts.type";
import { WorkspacePausedNotice } from "@/components/app/WorkspacePausedNotice";
import { setBroadcastRetryPreference } from "@/lib/broadcastRetryPreference";
import { isWorkspacePaused, useWorkspacePaused } from "@/lib/workspacePause";
import { Organization, useOrganizationStore } from "@/stores/organizationStore";

const consent = vi.fn();
vi.mock("@/client-api/functions/broadcasts", () => ({
  consentToBroadcastMessagingLimitRetry: (id: string) => consent(id),
  cancelBroadcast: vi.fn(),
  previewBroadcastAudienceCount: vi.fn(),
  startBroadcast: vi.fn()
}));

const { useAutoConsentRetry } = await import(
  "@/components/broadcasts/BroadcastActions"
);

const setPaused = (pausedAt: string | null) =>
  act(() =>
    useOrganizationStore.setState({
      activeOrganization: { _id: "org-1", pausedAt } as Organization
    })
  );

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  consent.mockReset();
  consent.mockResolvedValue({
    message: "Retrying.",
    data: { broadcastId: "b1" }
  });
  setPaused(null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("paused workspace", () => {
  it("is paused only while pausedAt is set", () => {
    expect(isWorkspacePaused(null)).toBe(false);
    expect(isWorkspacePaused({ pausedAt: null })).toBe(false);
    expect(isWorkspacePaused({ pausedAt: "2026-11-27T10:00:00.000Z" })).toBe(
      true
    );
    const { result } = renderHook(() => useWorkspacePaused());
    expect(result.current).toBe(false);
    setPaused("2026-11-27T10:00:00.000Z");
    expect(result.current).toBe(true);
  });

  it("shows the banner text and a way to reach support", () => {
    render(<WorkspacePausedNotice />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Your workspace is paused. Nothing is being sent to your customers. Please contact support."
    );
    expect(
      screen.getByRole("link", { name: "Contact support" }).getAttribute("href")
    ).toBe("/settings/help");
  });

  it("holds an automatic broadcast retry until the workspace is unpaused", async () => {
    const waiting = [
      {
        _id: "b1",
        status: "paused_limit",
        messagingLimitRetry: { status: "awaiting_consent" }
      } as Broadcast
    ];
    setBroadcastRetryPreference("b1", true);
    setPaused("2026-11-27T10:00:00.000Z");

    const { result } = renderHook(() => useAutoConsentRetry(waiting), {
      wrapper
    });
    expect(result.current.isPaused).toBe(true);
    expect(consent).not.toHaveBeenCalled();

    setPaused(null);
    await vi.waitFor(() => expect(consent).toHaveBeenCalledWith("b1"));
  });
});
