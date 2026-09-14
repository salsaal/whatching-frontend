import { beforeEach, describe, expect, it } from "vitest";

import { Organization, useOrganizationStore } from "./organizationStore";

const org = (id: string, overrides: Partial<Organization> = {}): Organization =>
  ({
    _id: id,
    name: `Org ${id}`,
    slug: id,
    planTier: "pro",
    subscriptionStatus: "active",
    metaConfig: {},
    usage: { aiTokensUsed: 0, subscribersCount: 0 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  }) as Organization;

beforeEach(() => {
  useOrganizationStore.setState({
    organizations: [],
    activeOrganization: null,
    integration: null,
    ownerUserId: null,
    hasHydrated: true,
    selectedWhatsAppPhoneNumberByOrg: {}
  });
});

describe("setOrganizations", () => {
  it("keeps the active organization selected when it's still present in the fresh list", () => {
    useOrganizationStore.getState().setActiveOrganization(org("a"));
    useOrganizationStore.getState().setOrganizations([org("a"), org("b")]);
    expect(useOrganizationStore.getState().activeOrganization?._id).toBe("a");
  });

  it("clears the active organization if it's no longer in the fresh list (e.g. removed/archived)", () => {
    useOrganizationStore.getState().setActiveOrganization(org("a"));
    useOrganizationStore.getState().setOrganizations([org("b"), org("c")]);
    expect(useOrganizationStore.getState().activeOrganization).toBeNull();
  });
});

describe("addOrganization", () => {
  it("prepends a new organization and de-duplicates by id if it already existed", () => {
    useOrganizationStore.getState().addOrganization(org("a"));
    useOrganizationStore.getState().addOrganization(org("b"));
    useOrganizationStore.getState().addOrganization(org("a", { name: "Renamed A" }));

    const ids = useOrganizationStore.getState().organizations.map((o) => o._id);
    expect(ids).toEqual(["a", "b"]);
    expect(useOrganizationStore.getState().organizations[0].name).toBe("Renamed A");
  });
});

describe("upsertOrganization", () => {
  it("updates an existing organization in place without changing list order", () => {
    useOrganizationStore.getState().setOrganizations([org("a"), org("b")]);
    useOrganizationStore.getState().upsertOrganization(org("b", { name: "Renamed B" }));

    const state = useOrganizationStore.getState();
    expect(state.organizations.map((o) => o._id)).toEqual(["a", "b"]);
    expect(state.organizations[1].name).toBe("Renamed B");
  });

  it("prepends when the organization doesn't exist yet", () => {
    useOrganizationStore.getState().setOrganizations([org("a")]);
    useOrganizationStore.getState().upsertOrganization(org("new"));
    expect(
      useOrganizationStore.getState().organizations.map((o) => o._id)
    ).toEqual(["new", "a"]);
  });

  it("also refreshes activeOrganization when it's the one being upserted", () => {
    useOrganizationStore.getState().setOrganizations([org("a")]);
    useOrganizationStore.getState().setActiveOrganization(org("a"));
    useOrganizationStore.getState().upsertOrganization(org("a", { name: "Renamed A" }));
    expect(useOrganizationStore.getState().activeOrganization?.name).toBe("Renamed A");
  });
});

describe("clearOrganizations", () => {
  it("resets every field, including ownerUserId", () => {
    useOrganizationStore.getState().setOrganizationOwner("user_1");
    useOrganizationStore.getState().setOrganizations([org("a")]);
    useOrganizationStore.getState().setActiveOrganization(org("a"));

    useOrganizationStore.getState().clearOrganizations();

    const state = useOrganizationStore.getState();
    expect(state.organizations).toEqual([]);
    expect(state.activeOrganization).toBeNull();
    expect(state.ownerUserId).toBeNull();
  });
});
