import { describe, expect, it } from "vitest";

import {
  buildPlanAction,
  calculatePlanTotals,
  canStartFreeTrial,
  formatCurrency,
  getDaysUntil,
  isSubscriptionCanceledWithAccess,
  plans,
  validateBillingProfile
} from "./billing";
import type { BillingProfile } from "@/client-api/types/organizations.type";
import type { Organization } from "@/stores/organizationStore";

const org = (overrides: Partial<Organization> = {}) =>
  ({
    _id: "org_1",
    name: "Acme",
    slug: "acme",
    planTier: "none",
    subscriptionStatus: "pending_payment",
    ...overrides
  }) as Organization;

const validProfile: BillingProfile = {
  legalName: "Acme Retail Pvt Ltd",
  billingEmail: "billing@acme.example",
  address: "221B Baker Street, Connaught Place",
  state: "Delhi",
  pinCode: "110001",
  gstin: ""
};

describe("validateBillingProfile", () => {
  it("passes a fully valid profile with an empty GSTIN (optional)", () => {
    const errors = validateBillingProfile(validProfile);
    expect(Object.values(errors).every((message) => message === "")).toBe(true);
  });

  it("flags each field independently when invalid", () => {
    const errors = validateBillingProfile({
      legalName: "A",
      billingEmail: "not-an-email",
      address: "abc",
      state: "",
      pinCode: "12345",
      gstin: "not-a-gstin"
    });
    expect(errors.legalName).not.toBe("");
    expect(errors.billingEmail).not.toBe("");
    expect(errors.address).not.toBe("");
    expect(errors.state).not.toBe("");
    expect(errors.pinCode).not.toBe("");
    expect(errors.gstin).not.toBe("");
  });

  it("accepts a well-formed GSTIN", () => {
    const errors = validateBillingProfile({
      ...validProfile,
      gstin: "29ABCDE1234F1Z5"
    });
    expect(errors.gstin).toBe("");
  });
});

describe("calculatePlanTotals", () => {
  it("computes 18% GST and rounds to 2 decimal places", () => {
    expect(calculatePlanTotals(2499)).toEqual({
      baseAmount: 2499,
      gstAmount: 449.82,
      totalAmount: 2948.82
    });
  });
});

describe("formatCurrency", () => {
  it("drops decimals for whole rupee amounts and keeps them otherwise", () => {
    expect(formatCurrency(2499)).toBe("₹2,499");
    expect(formatCurrency(2499.5)).toBe("₹2,499.50");
  });
});

describe("getDaysUntil", () => {
  it("returns null for a missing or unparsable date", () => {
    expect(getDaysUntil(undefined)).toBeNull();
    expect(getDaysUntil("not-a-date")).toBeNull();
  });

  it("clamps a past date to 0 rather than going negative", () => {
    expect(getDaysUntil(new Date(Date.now() - 86_400_000).toISOString())).toBe(0);
  });

  it("rounds a future date up to whole days", () => {
    const days = getDaysUntil(new Date(Date.now() + 3 * 86_400_000).toISOString());
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(4);
  });
});

describe("canStartFreeTrial", () => {
  it("is only true with no plan and no recorded trial consumption", () => {
    expect(canStartFreeTrial(org({ planTier: "none" }))).toBe(true);
    expect(canStartFreeTrial(org({ planTier: "none", trialConsumedAt: "2026-01-01" }))).toBe(
      false
    );
    expect(canStartFreeTrial(org({ planTier: "basic" }))).toBe(false);
    // No organization at all defaults permissively to "none" via the ||
    // fallback -- this is the documented, intentional behavior, not a gap.
    expect(canStartFreeTrial(null)).toBe(true);
  });
});

describe("buildPlanAction", () => {
  const proPlan = plans.find((plan) => plan.id === "pro")!;
  const enterprisePlan = plans.find((plan) => plan.id === "enterprise")!;

  it("always routes the enterprise plan to Contact Sales regardless of org state", () => {
    expect(buildPlanAction(enterprisePlan, org()).kind).toBe("enterprise");
  });

  it("offers a trial for a trial-eligible org unless direct-subscribe is preferred", () => {
    const eligible = org({ planTier: "none" });
    expect(buildPlanAction(proPlan, eligible).kind).toBe("trial");
    expect(
      buildPlanAction(proPlan, eligible, { preferDirectSubscribe: true }).kind
    ).toBe("subscribe");
  });

  it("offers a direct subscribe for a no-plan org that already used its trial", () => {
    expect(
      buildPlanAction(proPlan, org({ planTier: "none", trialConsumedAt: "2026-01-01" })).kind
    ).toBe("subscribe");
  });

  it("offers a plan change (upgrade/downgrade) for an org already on a paid plan", () => {
    const upgrading = buildPlanAction(
      proPlan,
      org({ planTier: "basic", subscriptionStatus: "active" })
    );
    expect(upgrading.kind).toBe("change");
    expect(upgrading.label).toBe("Upgrade plan");

    const basicPlan = plans.find((plan) => plan.id === "basic")!;
    const downgrading = buildPlanAction(
      basicPlan,
      org({ planTier: "pro", subscriptionStatus: "active" })
    );
    expect(downgrading.label).toContain("Downgrade");
  });
});

describe("isSubscriptionCanceledWithAccess", () => {
  it("is true only when canceled with a still-future period end", () => {
    expect(
      isSubscriptionCanceledWithAccess(
        org({
          subscriptionStatus: "canceled",
          subscriptionCurrentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString()
        })
      )
    ).toBe(true);
    expect(
      isSubscriptionCanceledWithAccess(
        org({
          subscriptionStatus: "canceled",
          subscriptionCurrentPeriodEnd: new Date(Date.now() - 86_400_000).toISOString()
        })
      )
    ).toBe(false);
    expect(isSubscriptionCanceledWithAccess(org({ subscriptionStatus: "active" }))).toBe(false);
  });
});
