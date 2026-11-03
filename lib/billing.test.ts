import { describe, expect, it } from "vitest";

import {
  buildPlanAction,
  calculatePlanTotals,
  canStartFreeTrial,
  formatCurrency,
  getDaysUntil,
  getChangeKind,
  getComplimentaryNotice,
  getDowngradeSeatCheck,
  getPaymentState,
  getOrganizationStatusLabel,
  getPrepaidUpgrade,
  getSubscriptionStatusLabel,
  humanizeBillingMessage,
  isAdminGrantedPlan,
  isSubscriptionCanceledWithAccess,
  plans,
  resolveChangePlanOutcome,
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
    expect(getDaysUntil(new Date(Date.now() - 86_400_000).toISOString())).toBe(
      0
    );
  });

  it("rounds a future date up to whole days", () => {
    const days = getDaysUntil(
      new Date(Date.now() + 3 * 86_400_000).toISOString()
    );
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(4);
  });
});

describe("canStartFreeTrial", () => {
  it("is only true with no plan and no recorded trial consumption", () => {
    expect(canStartFreeTrial(org({ planTier: "none" }))).toBe(true);
    expect(
      canStartFreeTrial(
        org({ planTier: "none", trialConsumedAt: "2026-01-01" })
      )
    ).toBe(false);
    expect(canStartFreeTrial(org({ planTier: "basic" }))).toBe(false);
    // No organization at all defaults permissively to "none" via the ||
    // fallback -- this is the documented, intentional behavior, not a gap.
    expect(canStartFreeTrial(null)).toBe(true);
  });

  it("never offers a trial to an org whose payment failed", () => {
    expect(
      canStartFreeTrial(
        org({ planTier: "none", subscriptionStatus: "past_due" })
      )
    ).toBe(false);
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
      buildPlanAction(
        proPlan,
        org({ planTier: "none", trialConsumedAt: "2026-01-01" })
      ).kind
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

  it("offers pay-again (subscribe) instead of a plan change while past_due", () => {
    const pastDue = org({ planTier: "pro", subscriptionStatus: "past_due" });
    const same = buildPlanAction(proPlan, pastDue);
    expect(same.kind).toBe("subscribe");
    expect(same.label).toBe("Pay now with another method");

    const basicPlan = plans.find((plan) => plan.id === "basic")!;
    const other = buildPlanAction(basicPlan, pastDue);
    expect(other.kind).toBe("subscribe");
    expect(other.label).toBe("Subscribe to Basic");

    const ended = org({ planTier: "none", subscriptionStatus: "past_due" });
    expect(buildPlanAction(proPlan, ended).kind).toBe("subscribe");
  });

  it("subscribes (not a trial) for a trialing org", () => {
    expect(
      buildPlanAction(
        proPlan,
        org({
          planTier: "pro",
          subscriptionStatus: "trialing",
          trialConsumedAt: "2026-10-01"
        })
      ).kind
    ).toBe("subscribe");
  });
});

describe("getPaymentState", () => {
  const day = 86_400_000;

  it("is ok unless past_due", () => {
    expect(getPaymentState(org({ subscriptionStatus: "active" }))).toBe("ok");
    expect(getPaymentState(null)).toBe("ok");
  });

  it("is grace while the plan still works", () => {
    expect(
      getPaymentState(
        org({
          planTier: "pro",
          subscriptionStatus: "past_due",
          paymentGraceUntil: new Date(Date.now() + 3 * day).toISOString()
        })
      )
    ).toBe("grace");
    expect(
      getPaymentState(org({ planTier: "pro", subscriptionStatus: "past_due" }))
    ).toBe("grace");
  });

  it("is ended with no tier or a lapsed grace date", () => {
    expect(
      getPaymentState(org({ planTier: "none", subscriptionStatus: "past_due" }))
    ).toBe("ended");
    expect(
      getPaymentState(
        org({
          planTier: "pro",
          subscriptionStatus: "past_due",
          paymentGraceUntil: new Date(Date.now() - day).toISOString()
        })
      )
    ).toBe("ended");
  });
});

describe("isAdminGrantedPlan", () => {
  it("matches an active plan with no Razorpay subscription", () => {
    expect(
      isAdminGrantedPlan(org({ planTier: "pro", subscriptionStatus: "active" }))
    ).toBe(true);
    expect(
      isAdminGrantedPlan(
        org({ planTier: "enterprise", subscriptionStatus: "active" })
      )
    ).toBe(true);
  });

  it("ignores paying, trialing and no-plan orgs", () => {
    expect(
      isAdminGrantedPlan(
        org({
          planTier: "pro",
          subscriptionStatus: "active",
          razorpaySubscriptionId: "sub_1"
        })
      )
    ).toBe(false);
    expect(
      isAdminGrantedPlan(
        org({
          planTier: "basic",
          subscriptionStatus: "active",
          pendingRazorpaySubscriptionId: "sub_2"
        })
      )
    ).toBe(false);
    expect(
      isAdminGrantedPlan(
        org({ planTier: "pro", subscriptionStatus: "trialing" })
      )
    ).toBe(false);
    expect(
      isAdminGrantedPlan(
        org({ planTier: "none", subscriptionStatus: "active" })
      )
    ).toBe(false);
  });
});

describe("getSubscriptionStatusLabel", () => {
  it("maps every status to readable copy", () => {
    expect(getSubscriptionStatusLabel("active")).toBe("Active");
    expect(getSubscriptionStatusLabel("trialing")).toBe("Free trial");
    expect(getSubscriptionStatusLabel("pending_payment")).toBe(
      "Waiting for payment"
    );
    expect(getSubscriptionStatusLabel("past_due")).toBe("Payment failed");
    expect(getSubscriptionStatusLabel("paused")).toBe("Paused");
    expect(getSubscriptionStatusLabel("canceled")).toBe("Cancelled");
    expect(getSubscriptionStatusLabel("")).toBe("");
    expect(getSubscriptionStatusLabel("something_new")).toBe("");
  });
});

describe("humanizeBillingMessage", () => {
  it("replaces raw ISO timestamps with dates", () => {
    expect(
      humanizeBillingMessage(
        "Your current plan remains active until 2026-11-30T10:15:00.000Z. Start later."
      )
    ).toBe("Your current plan remains active until 30 Nov 2026. Start later.");
    expect(humanizeBillingMessage("No dates here.")).toBe("No dates here.");
  });
});

describe("isSubscriptionCanceledWithAccess", () => {
  it("is true only when canceled with a still-future period end", () => {
    expect(
      isSubscriptionCanceledWithAccess(
        org({
          subscriptionStatus: "canceled",
          subscriptionCurrentPeriodEnd: new Date(
            Date.now() + 86_400_000
          ).toISOString()
        })
      )
    ).toBe(true);
    expect(
      isSubscriptionCanceledWithAccess(
        org({
          subscriptionStatus: "canceled",
          subscriptionCurrentPeriodEnd: new Date(
            Date.now() - 86_400_000
          ).toISOString()
        })
      )
    ).toBe(false);
    expect(
      isSubscriptionCanceledWithAccess(org({ subscriptionStatus: "active" }))
    ).toBe(false);
  });
});

describe("getDowngradeSeatCheck", () => {
  it("matches the backend's downgrade message", () => {
    expect(getDowngradeSeatCheck(5, "basic")).toEqual({
      excess: 3,
      message:
        "Basic includes 2 team members besides the owner, and you have 5. Remove 3 team members before switching plans."
    });
    expect(getDowngradeSeatCheck(3, "basic").message).toContain(
      "Remove 1 team member before"
    );
    expect(getDowngradeSeatCheck(2, "basic")).toEqual({
      excess: 0,
      message: ""
    });
  });
});

describe("plans", () => {
  it("lists role-based permissions under Basic only", () => {
    const feature = "Role-Based Team Permissions";
    expect(plans.find((plan) => plan.id === "basic")!.features).toContain(
      feature
    );
    expect(plans.find((plan) => plan.id === "pro")!.features).not.toContain(
      feature
    );
  });
});

describe("resolveChangePlanOutcome", () => {
  it("uses the backend outcome when present", () => {
    expect(
      resolveChangePlanOutcome({ outcome: "already_on_plan", changed: false })
    ).toBe("already_on_plan");
  });

  it("falls back to the response flags", () => {
    expect(resolveChangePlanOutcome({ changed: true })).toBe("upgraded");
    expect(
      resolveChangePlanOutcome({ changed: false, requestedPlanTier: "pro" })
    ).toBe("upgrade_pending");
    expect(
      resolveChangePlanOutcome({ scheduled: true, requestedPlanTier: "basic" })
    ).toBe("downgrade_scheduled");
    expect(
      resolveChangePlanOutcome({
        scheduled: true,
        requiresAuthorization: true,
        paymentMethodReplacement: true
      })
    ).toBe("replacement_requires_authorization");
    expect(
      resolveChangePlanOutcome({
        scheduled: true,
        replacementSubscriptionId: "sub_2"
      })
    ).toBe("replacement_pending");
    expect(
      resolveChangePlanOutcome({ changed: false, scheduled: false })
    ).toBeUndefined();
  });
});

describe("getChangeKind", () => {
  it("groups outcomes by what the customer sees", () => {
    expect(getChangeKind("upgraded")).toBe("upgrade");
    expect(getChangeKind("upgrade_pending")).toBe("upgrade");
    expect(getChangeKind("downgrade_scheduled")).toBe("downgrade");
    expect(getChangeKind("already_scheduled", "basic")).toBe("downgrade");
    expect(getChangeKind("already_scheduled", "pro")).toBe("replacement");
    expect(getChangeKind("replacement_requires_authorization")).toBe(
      "replacement"
    );
    expect(getChangeKind("already_on_plan")).toBeUndefined();
    expect(getChangeKind("pending_change_canceled")).toBeUndefined();
    expect(getChangeKind("scheduled_change_canceled")).toBeUndefined();
  });
});

describe("getPrepaidUpgrade", () => {
  const day = 86_400_000;

  it("is set only while the prepaid Pro period is still running", () => {
    const until = new Date(Date.now() + 5 * day).toISOString();
    expect(
      getPrepaidUpgrade(
        org({ prepaidUpgradeTier: "pro", prepaidUpgradeUntil: until })
      )
    ).toEqual({ tier: "pro", until });
    expect(
      getPrepaidUpgrade(
        org({
          prepaidUpgradeTier: "pro",
          prepaidUpgradeUntil: new Date(Date.now() - day).toISOString()
        })
      )
    ).toBeNull();
    expect(getPrepaidUpgrade(org({ prepaidUpgradeTier: null }))).toBeNull();
  });
});

describe("a plan change with an authorised replacement", () => {
  const upgrading = org({
    planTier: "pro",
    subscriptionStatus: "canceled",
    subscriptionCancelAtPeriodEnd: true,
    subscriptionCurrentPeriodEnd: new Date(
      Date.now() + 5 * 86_400_000
    ).toISOString(),
    pendingRazorpaySubscriptionId: "sub_new",
    pendingRazorpaySubscriptionStatus: "authenticated"
  });

  it("is not a cancellation", () => {
    expect(isSubscriptionCanceledWithAccess(upgrading)).toBe(false);
    expect(getOrganizationStatusLabel(upgrading)).toBe("Active");
  });

  it("still treats a real cancellation as cancelled", () => {
    const leaving = org({
      ...upgrading,
      pendingRazorpaySubscriptionId: null,
      pendingRazorpaySubscriptionStatus: null
    });
    expect(isSubscriptionCanceledWithAccess(leaving)).toBe(true);
    expect(getOrganizationStatusLabel(leaving)).toBe("Cancelled");
  });
});

describe("getComplimentaryNotice", () => {
  const day = 86_400_000;
  const now = Date.now();
  const granted = (untilMs: number) =>
    org({
      planTier: "pro",
      subscriptionStatus: "active",
      complimentaryPlan: {
        tier: "pro",
        until: new Date(untilMs).toISOString(),
        grantedAt: new Date(now - 27 * day).toISOString()
      },
      trialConsumedAt: new Date(now - 27 * day).toISOString(),
      trialConsumedReason: "complimentary_plan"
    });

  it("reminds in the last 3 days only", () => {
    expect(getComplimentaryNotice(granted(now + 2 * day), now)).toMatchObject({
      kind: "ending",
      planName: "Pro"
    });
    expect(getComplimentaryNotice(granted(now + 3 * day), now)?.kind).toBe(
      "ending"
    );
    expect(getComplimentaryNotice(granted(now + 4 * day), now)).toBeNull();
  });

  it("says it ended once there is no plan", () => {
    const ended = org({
      ...granted(now - day),
      planTier: "none",
      subscriptionStatus: "canceled"
    });
    expect(getComplimentaryNotice(ended, now)).toEqual({ kind: "ended" });
  });

  it("is quiet once a paid plan replaced it", () => {
    const paying = org({
      ...granted(now - day),
      planTier: "basic",
      razorpaySubscriptionId: "sub_1"
    });
    expect(getComplimentaryNotice(paying, now)).toBeNull();
  });

  it("never offers the free trial after a grant", () => {
    const ended = org({
      ...granted(now - day),
      planTier: "none",
      subscriptionStatus: "canceled"
    });
    expect(canStartFreeTrial(ended)).toBe(false);
    expect(buildPlanAction(plans[0], ended).kind).toBe("subscribe");
  });
});
