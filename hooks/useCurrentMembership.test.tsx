import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MEMBERSHIP_RETRY_MS,
  isTemporaryMembershipFailure,
  useCurrentMembership
} from "@/hooks/useCurrentMembership";

const getCurrentMembership = vi.fn();

vi.mock("@/client-api/functions/organizations", () => ({
  getCurrentMembership: () => getCurrentMembership()
}));

vi.mock("@/stores/organizationStore", () => ({
  useOrganizationStore: (
    selector: (state: { activeOrganization: { _id: string } }) => unknown
  ) => selector({ activeOrganization: { _id: "org-1" } })
}));

const networkError = Object.assign(new Error("Network Error"), {
  isAxiosError: true
});
const forbidden = Object.assign(new Error("Forbidden"), {
  isAxiosError: true,
  response: { status: 403 }
});
const owner = { role: "owner", effectivePermissionGrants: [] };

function renderMembership() {
  // The app's own defaults, with instant retries so the test needn't wait.
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: 0,
        retryDelay: 0
      }
    }
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCurrentMembership(), { wrapper });
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("useCurrentMembership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getCurrentMembership.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a network failure as not known yet and keeps asking", async () => {
    getCurrentMembership
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(owner);
    const { result } = renderMembership();

    await advance(100);
    // The first try and three retries failed: still waiting, not "no access".
    expect(getCurrentMembership).toHaveBeenCalledTimes(4);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isOwner).toBe(false);

    await advance(MEMBERSHIP_RETRY_MS);
    expect(getCurrentMembership).toHaveBeenCalledTimes(5);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isOwner).toBe(true);
  });

  it("takes a 403 as a real answer, without retrying", async () => {
    getCurrentMembership.mockRejectedValue(forbidden);
    const { result } = renderMembership();

    await advance(MEMBERSHIP_RETRY_MS * 2);
    expect(getCurrentMembership).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.can("integrations:view")).toBe(false);
  });

  it("tells temporary failures from real answers", () => {
    expect(isTemporaryMembershipFailure(networkError)).toBe(true);
    expect(isTemporaryMembershipFailure({ response: { status: 502 } })).toBe(
      true
    );
    expect(isTemporaryMembershipFailure({ response: { status: 429 } })).toBe(
      true
    );
    expect(isTemporaryMembershipFailure(forbidden)).toBe(false);
    expect(isTemporaryMembershipFailure({ response: { status: 401 } })).toBe(
      false
    );
    expect(isTemporaryMembershipFailure({ response: { status: 404 } })).toBe(
      false
    );
  });
});
