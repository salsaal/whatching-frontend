import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "./authStore";
import { useOrganizationStore, Organization } from "./organizationStore";
import type { AuthUser } from "@/client-api/types/auth.type";

const user = (overrides: Partial<AuthUser> = {}): AuthUser =>
  ({
    _id: "user_1",
    name: "Asha",
    email: "asha@example.com",
    ...overrides
  }) as AuthUser;

const org = (overrides: Partial<Organization> = {}): Organization =>
  ({
    _id: "org_1",
    name: "Acme",
    slug: "acme",
    planTier: "pro",
    subscriptionStatus: "active",
    metaConfig: {},
    usage: { aiTokensUsed: 0, subscribersCount: 0 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  }) as Organization;

const resetStores = () => {
  useAuthStore.setState({
    token: null,
    user: null,
    hasHydrated: true,
    isAuthenticated: false,
    trialUnavailable: false
  });
  useOrganizationStore.setState({
    organizations: [],
    activeOrganization: null,
    integration: null,
    ownerUserId: null,
    hasHydrated: true,
    selectedWhatsAppPhoneNumberByOrg: {}
  });
};

beforeEach(resetStores);

describe("setAuth", () => {
  it("authenticates and tags the organization store with the logged-in user as owner", () => {
    useAuthStore.getState().setAuth({ token: "tok_1", user: user() });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe("tok_1");
    expect(useOrganizationStore.getState().ownerUserId).toBe("user_1");
  });

  it("preserves cached organization state on a same-user re-login (e.g. token refresh)", () => {
    useAuthStore.getState().setAuth({ token: "tok_1", user: user() });
    useOrganizationStore.getState().setActiveOrganization(org());
    useAuthStore.getState().markTrialUnavailable();

    // Same user logging in again (e.g. after a refresh) must not wipe the
    // org they already had loaded, or silently forget the trial-used flag.
    useAuthStore.getState().setAuth({ token: "tok_2", user: user() });

    expect(useOrganizationStore.getState().activeOrganization?._id).toBe(
      "org_1"
    );
    expect(useAuthStore.getState().trialUnavailable).toBe(true);
  });

  it("clears cached organization state and resets trialUnavailable when a different user logs in", () => {
    useAuthStore
      .getState()
      .setAuth({ token: "tok_1", user: user({ _id: "user_1" }) });
    useOrganizationStore.getState().setActiveOrganization(org());
    useAuthStore.getState().markTrialUnavailable();

    // A different account logging into the same browser session must never
    // inherit the previous user's organization or trial-used state.
    useAuthStore
      .getState()
      .setAuth({ token: "tok_2", user: user({ _id: "user_2" }) });

    expect(useOrganizationStore.getState().activeOrganization).toBeNull();
    expect(useOrganizationStore.getState().ownerUserId).toBe("user_2");
    expect(useAuthStore.getState().trialUnavailable).toBe(false);
  });

  it("clears stale organization state left with no recorded owner (pre-owner-tracking data)", () => {
    // Simulates organization state that predates ownerUserId tracking --
    // present, but with no owner recorded.
    useOrganizationStore.setState({
      activeOrganization: org(),
      ownerUserId: null
    });

    useAuthStore.getState().setAuth({ token: "tok_1", user: user() });

    expect(useOrganizationStore.getState().activeOrganization).toBeNull();
    expect(useOrganizationStore.getState().ownerUserId).toBe("user_1");
  });
});

describe("logout", () => {
  it("clears auth state, trial flag, and the organization store together", () => {
    useAuthStore.getState().setAuth({ token: "tok_1", user: user() });
    useOrganizationStore.getState().setActiveOrganization(org());
    useAuthStore.getState().markTrialUnavailable();

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().trialUnavailable).toBe(false);
    expect(useOrganizationStore.getState().activeOrganization).toBeNull();
  });
});
