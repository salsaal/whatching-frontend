import type { BillingProfile } from "@/client-api/types/organizations.type";
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

export const plans: PlanDefinition[] = [
  {
    id: "basic",
    name: "Basic",
    priceLabel: "Rs. 2,499",
    monthlyPrice: 2499,
    description: "Ideal for small businesses",
    features: [
      "Bulk WhatsApp Messaging",
      "5,000 Subscribers",
      "0% Markup Fees",
      "Owner + 2 Team Members",
      "Role-Based Team Permissions",
      "Drag & Drop Chatbot Builder",
      "WhatsApp AI Agent",
      "100,000 AI Message Tokens",
      "Single Phone Number Integration",
      "Coexistence with WhatsApp Business App",
      "Messaging Template Management",
      "Analytics Dashboard",
      "Unlimited Free Incoming Conversations",
      "Unlimited Chatbot Sessions",
      "Multi Agent Shared Inbox",
      "Automated Follow Up Bot",
      "WhatsApp Chat Widget",
      "Dedicated Customer Database"
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
      "15,000 Subscribers",
      "0% Markup Fees",
      "Up to 2 Phone Numbers per Organization",
      "Owner + 5 Team Members",
      "Role-Based Team Permissions",
      "Unlimited AI Message Tokens",
      "Coexistence with WhatsApp Business App",
      "WhatsApp AI Agent",
      'Remove "Powered by Whatching" Branding'
    ],
    comingSoon: [
      "Instagram Automations",
      "Drag & Drop Chatbot Builder for Instagram",
      "Instagram AI Agent",
      "Automated Instagram Comments Reply"
    ]
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
  return currentPlan === "none" && !organization?.trialConsumedAt;
};

export const buildPlanAction = (
  plan: PlanDefinition,
  organization: Organization | null | undefined,
  options?: { preferDirectSubscribe?: boolean }
): PlanAction => {
  const currentPlan = organization?.planTier || "none";
  const isNoPlan = currentPlan === "none";
  const isTrialing = organization?.subscriptionStatus === "trialing";
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
