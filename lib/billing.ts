import type {
  BillingProfile,
  ChangePlanOutcome
} from "@/client-api/types/organizations.type";
import type { Organization } from "@/stores/organizationStore";

export type PaidPlanTier = "basic" | "pro";
export type PlanTier = PaidPlanTier | "enterprise";
export type PlanActionKind = "trial" | "subscribe" | "change" | "enterprise";

export type PlanDefinition = {
  id: PlanTier;
  name: string;
  priceLabel: string;
  monthlyPrice: number | null;
  description: string;
  highlighted?: boolean;
  features: string[];
  bonusFeatures?: { title: string; items: string[] };
  comingSoon?: string[];
};

export type PlanAction = {
  kind: PlanActionKind;
  tier: PlanTier;
  planName: string;
  label: string;
  description: string;
};

export const GST_RATE = 0.18;

// Agent seats per plan, on top of the owner (backend config/planConfig.ts).
export const planAgentLimits: Record<PaidPlanTier, number> = {
  basic: 2,
  pro: 5
};

// How many agents must go before moving to `tier`, and the same sentence the
// backend's change-plan 409 uses.
export const getDowngradeSeatCheck = (
  activeAgents: number,
  tier: PaidPlanTier
) => {
  const allowed = planAgentLimits[tier];
  const excess = Math.max(0, activeAgents - allowed);
  const name = tier === "basic" ? "Basic" : "Pro";
  return {
    excess,
    message: excess
      ? `${name} includes ${allowed} team member${allowed === 1 ? "" : "s"} besides the owner, and you have ${activeAgents}. Remove ${excess} team member${excess === 1 ? "" : "s"} before switching plans.`
      : ""
  };
};

export const plans: PlanDefinition[] = [
  {
    id: "basic",
    name: "Basic",
    priceLabel: "Rs. 2,499",
    monthlyPrice: 2499,
    description: "Ideal for small businesses",
    features: [
      "Bulk WhatsApp Messaging",
      "10k WhatsApp Contacts",
      "Automatic Lead Qualification",
      "0% Markup Fees",
      "Drag & Drop Chatbot Builder",
      "Automated Follow Up Bot",
      "WhatsApp AI Agent",
      "1M AI Message Tokens",
      "Owner + 2 Team Members",
      "Role-Based Team Permissions",
      "Sync WhatsApp Business App",
      "Single Phone Number Integration",
      "Messaging Template Management",
      "Analytics Dashboard",
      "Unlimited Free Incoming Conversation",
      "Multi Agent Shared Inbox",
      "Track Meta Ad Campaigns"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "Rs. 3,999",
    monthlyPrice: 3999,
    description: "Advanced features for growing businesses",
    highlighted: true,
    features: [
      "Includes all Basic features",
      "25k WhatsApp Contacts",
      "Upto 2 Phone Numbers per Organization",
      "Owner + 5 Team Members",
      "3M AI Message Tokens"
    ],
    bonusFeatures: {
      title: "Instagram",
      items: [
        "Instagram Automations",
        "Unlimited Instagram Conversations",
        "Drag & Drop Chatbot Builder for Instagram",
        "Instagram AI Agent",
        "Automated Instagram Comments Reply"
      ]
    },
    comingSoon: ["Whatsapp Forms"]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "For Scale",
    monthlyPrice: null,
    description: "For high-scale businesses",
    features: [
      "Includes all Pro features",
      "High Volume Subscribers",
      "Any Custom Business Logic",
      "Unlimited Team Members",
      "More WhatsApp Numbers",
      "Dedicated Account Manager",
      "Priority Support"
    ]
  }
];

export const paidPlans = plans.filter(
  (plan): plan is PlanDefinition & { id: PaidPlanTier; monthlyPrice: number } =>
    plan.id === "basic" || plan.id === "pro"
);

export const indiaStates = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
] as const;

export const emptyBillingProfile: BillingProfile = {
  legalName: "",
  billingEmail: "",
  address: "",
  state: "",
  pinCode: "",
  gstin: ""
};

export const validateBillingProfile = (profile: BillingProfile) => ({
  legalName:
    profile.legalName.trim().length >= 2
      ? ""
      : "Enter the legal name (at least 2 characters).",
  billingEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.billingEmail.trim())
    ? ""
    : "Enter a valid billing email.",
  address:
    profile.address.trim().length >= 5
      ? ""
      : "Enter the complete billing address.",
  state: profile.state.trim() ? "" : "Select a state or union territory.",
  pinCode: /^\d{6}$/.test(profile.pinCode.trim())
    ? ""
    : "Enter a valid 6-digit Indian PIN code.",
  gstin:
    !profile.gstin?.trim() ||
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i.test(
      profile.gstin.trim()
    )
      ? ""
      : "Enter a valid 15-character GSTIN."
});

export const getPlanByTier = (tier?: string | string[]) => {
  const normalized = Array.isArray(tier) ? tier[0] : tier;
  return plans.find((plan) => plan.id === normalized) || null;
};

export const calculatePlanTotals = (baseAmount: number) => {
  const gstAmount = Number((baseAmount * GST_RATE).toFixed(2));
  return {
    baseAmount,
    gstAmount,
    totalAmount: Number((baseAmount + gstAmount).toFixed(2))
  };
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);

export const formatDate = (date?: string | null) => {
  if (!date) return "-";
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
};

export const getDaysUntil = (date?: string | null) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return null;
  return Math.max(
    0,
    Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
};

// trialConsumedAt lives on the organisation document, so a brand-new org
// always starts with it unset -- it does NOT mean the trial is actually
// available. The backend also dedupes a trial by owner phone number and
// email across every organisation that owner has ever created (see
// findPriorOwnerTrial), so a second org can still be rejected with a 409
// even though this local check passes. Callers that offer a trial action
// should always pair it with a direct-subscribe fallback (see
// buildPlanAction's { kind: "trial" } case) rather than assuming success.
export const canStartFreeTrial = (
  organization: Organization | null | undefined
) => {
  const currentPlan = organization?.planTier || "none";
  // A past_due org whose grace ran out drops to "none" but has paid before,
  // so it never gets a trial offer (the backend would 409 it anyway).
  return (
    currentPlan === "none" &&
    !organization?.trialConsumedAt &&
    organization?.subscriptionStatus !== "past_due"
  );
};

export const buildPlanAction = (
  plan: PlanDefinition,
  organization: Organization | null | undefined,
  options?: { preferDirectSubscribe?: boolean }
): PlanAction => {
  const currentPlan = organization?.planTier || "none";
  const isNoPlan = currentPlan === "none";
  const isTrialing = organization?.subscriptionStatus === "trialing";
  const isPastDue = organization?.subscriptionStatus === "past_due";
  const canStartTrial = canStartFreeTrial(organization);

  if (plan.id === "enterprise") {
    return {
      kind: "enterprise",
      tier: "enterprise",
      planName: plan.name,
      label: "Contact Sales",
      description:
        "Enterprise setup is handled by the Whatching team for custom usage, more numbers, and dedicated support."
    };
  }

  // change-plan returns 409 for a failing subscription; subscribing again
  // stops it and starts a fresh checkout with a new payment method.
  if (isPastDue) {
    return {
      kind: "subscribe",
      tier: plan.id,
      planName: plan.name,
      label:
        plan.id === currentPlan
          ? "Pay now with another method"
          : `Subscribe to ${plan.name}`,
      description:
        "Your last payment didn't go through. Review your GST billing details, then pay with a different method."
    };
  }

  if (canStartTrial && !options?.preferDirectSubscribe) {
    return {
      kind: "trial",
      tier: plan.id,
      planName: plan.name,
      label: "Start free trial",
      description: `Start a 7-day ${plan.name} trial for this organisation. No payment method is required. Only your first trial across all organisations is free -- if you've already used one, subscribe directly instead.`
    };
  }

  if (isNoPlan || isTrialing) {
    return {
      kind: "subscribe",
      tier: plan.id,
      planName: plan.name,
      label: `Subscribe to ${plan.name}`,
      description:
        "Review GST billing details before opening Razorpay checkout."
    };
  }

  return {
    kind: "change",
    tier: plan.id,
    planName: plan.name,
    label:
      currentPlan === "basic" && plan.id === "pro"
        ? "Upgrade plan"
        : `Downgrade to ${plan.name}`,
    description:
      "Review GST billing details before scheduling or authorizing this plan change."
  };
};

export const isSubscriptionCanceledWithAccess = (
  organization: Organization | null | undefined
) => {
  const periodEnd = organization?.subscriptionCurrentPeriodEnd;
  return (
    organization?.subscriptionStatus === "canceled" &&
    Boolean(periodEnd) &&
    new Date(periodEnd as string).getTime() > Date.now()
  );
};

export type PaymentState = "ok" | "grace" | "ended";

// past_due with a tier and grace still open -> "grace" (the plan keeps
// working while Razorpay retries); past_due with no tier or a lapsed grace
// date -> "ended" (the backend job drops the tier shortly after the date).
export const getPaymentState = (
  organization: Organization | null | undefined
): PaymentState => {
  if (organization?.subscriptionStatus !== "past_due") return "ok";
  if ((organization.planTier || "none") === "none") return "ended";
  const graceUntil = organization.paymentGraceUntil;
  if (graceUntil && new Date(graceUntil).getTime() <= Date.now()) {
    return "ended";
  }
  return "grace";
};

// A plan the Whatching team granted by hand: active, a real tier, and no
// Razorpay subscription behind it (a trial is "trialing", so never matches).
export const isAdminGrantedPlan = (
  organization: Organization | null | undefined
) =>
  organization?.subscriptionStatus === "active" &&
  (organization?.planTier || "none") !== "none" &&
  !organization?.razorpaySubscriptionId &&
  !organization?.pendingRazorpaySubscriptionId;

const subscriptionStatusLabels: Record<string, string> = {
  active: "Active",
  trialing: "Free trial",
  pending_payment: "Waiting for payment",
  past_due: "Payment failed",
  paused: "Paused",
  canceled: "Cancelled"
};

// Empty for a missing or unknown status, so each page picks its own fallback.
export const getSubscriptionStatusLabel = (status?: string | null) =>
  (status && subscriptionStatusLabels[status]) || "";

// Backend billing messages can carry raw ISO timestamps; show them as dates.
export const humanizeBillingMessage = (message: string) =>
  message.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, (iso) => formatDate(iso));

export type ChangeKind = "upgrade" | "downgrade" | "replacement";

type ChangePlanResult = {
  outcome?: ChangePlanOutcome;
  changed?: boolean;
  scheduled?: boolean;
  requiresAuthorization?: boolean;
  paymentMethodReplacement?: boolean;
  replacementSubscriptionId?: string;
  requestedPlanTier?: string;
};

// The backend names the change-plan outcome; responses without one (older
// deploys) are read from the flags they carry instead.
export const resolveChangePlanOutcome = (
  data?: ChangePlanResult | null
): ChangePlanOutcome | undefined => {
  if (!data) return undefined;
  if (data.outcome) return data.outcome;
  if (data.requiresAuthorization && data.paymentMethodReplacement) {
    return "replacement_requires_authorization";
  }
  if (data.scheduled) {
    if (data.replacementSubscriptionId) return "replacement_pending";
    return data.requestedPlanTier === "basic"
      ? "downgrade_scheduled"
      : "already_scheduled";
  }
  if (data.changed) return "upgraded";
  // Of the unscheduled responses, only the upgrade carries requestedPlanTier.
  if (data.requestedPlanTier === "pro") return "upgrade_pending";
  return undefined;
};

// What the congratulations page shows; undefined means nothing changed.
export const getChangeKind = (
  outcome: ChangePlanOutcome | undefined,
  requestedPlanTier?: string
): ChangeKind | undefined => {
  switch (outcome) {
    case "upgraded":
    case "upgrade_pending":
      return "upgrade";
    case "downgrade_scheduled":
      return "downgrade";
    case "replacement_pending":
    case "replacement_requires_authorization":
      return "replacement";
    case "already_scheduled":
      return requestedPlanTier === "basic" ? "downgrade" : "replacement";
    default:
      return undefined;
  }
};
