// One mapping from backend status values to what users see. Raw values like
// "in_progress" or "PENDING" never reach the screen.

import { formatWhen } from "@/lib/displayFormat";

export type BadgeTone =
  | "green"
  | "amber"
  | "red"
  | "orange"
  | "blue"
  | "grey"
  | "red-outline"
  | "green-outline"
  | "blue-outline"
  | "grey-outline";

export interface StatusPresentation {
  label: string;
  tone: BadgeTone;
  /** Shows a pulsing dot (something is actively happening). */
  live?: boolean;
}

export const templateStatusPresentation = (
  status?: string | null
): StatusPresentation => {
  const value = String(status || "").toUpperCase();
  switch (value) {
    case "APPROVED":
      return { label: "Approved", tone: "green" };
    case "PENDING":
    case "IN_REVIEW":
    case "PENDING_REVIEW":
    case "IN_APPEAL":
      return { label: "In review", tone: "amber" };
    case "REJECTED":
      return { label: "Rejected", tone: "red" };
    case "PAUSED":
      return { label: "Paused by Meta", tone: "orange" };
    case "DISABLED":
      return { label: "Disabled by Meta", tone: "red-outline" };
    case "DRAFT":
      return { label: "Draft", tone: "grey" };
    case "ACTION_REQUIRED":
      return { label: "Needs media", tone: "orange" };
    default:
      return {
        label: value
          ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ")
          : "Unknown",
        tone: "grey"
      };
  }
};

/** One-line explanation shown under a template's status badge. */
export const templateStatusHint = (status?: string | null) => {
  switch (String(status || "").toUpperCase()) {
    case "REJECTED":
      return "Meta rejected this — edit and resubmit";
    case "PAUSED":
      return "Paused by Meta for low engagement. It may resume automatically.";
    case "DISABLED":
      return "Disabled by Meta. Create a new template.";
    case "PENDING":
    case "IN_REVIEW":
    case "PENDING_REVIEW":
      return "Usually reviewed within minutes to a few hours.";
    case "DRAFT":
      return "Draft · not submitted";
    default:
      return "";
  }
};

/** Rejected, paused or disabled: the template can't be sent as-is. */
export const isTemplateNeedingAttention = (status?: string | null) =>
  ["REJECTED", "PAUSED", "DISABLED"].includes(
    String(status || "").toUpperCase()
  );

export const isTemplateInReview = (status?: string | null) =>
  ["PENDING", "IN_REVIEW", "PENDING_REVIEW", "IN_APPEAL"].includes(
    String(status || "").toUpperCase()
  );

export const templateCategoryPresentation = (
  category?: string | null
): StatusPresentation => {
  switch (String(category || "").toUpperCase()) {
    case "MARKETING":
      return { label: "Marketing", tone: "green-outline" };
    case "UTILITY":
      return { label: "Utility", tone: "blue-outline" };
    case "AUTHENTICATION":
      return { label: "Authentication", tone: "grey-outline" };
    default:
      return { label: "Uncategorised", tone: "grey-outline" };
  }
};

export const broadcastStatusPresentation = (
  status?: string | null,
  scheduledAt?: string | null
): StatusPresentation => {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "grey" };
    case "scheduled":
      return {
        label: scheduledAt
          ? `Scheduled · ${formatWhen(scheduledAt)}`
          : "Scheduled",
        tone: "blue"
      };
    case "processing":
    case "in_progress":
      return { label: "Sending", tone: "green", live: true };
    case "paused_limit":
      return { label: "Paused · messaging limit", tone: "orange" };
    case "completed":
      return { label: "Completed", tone: "green" };
    case "failed":
      return { label: "Failed", tone: "red" };
    case "canceled":
      return { label: "Canceled", tone: "grey" };
    default:
      return { label: "Unknown", tone: "grey" };
  }
};

export const isBroadcastSending = (status?: string | null) =>
  status === "processing" || status === "in_progress";

export const isBroadcastFinished = (status?: string | null) =>
  status === "completed" || status === "failed" || status === "canceled";

export const badgeToneClass: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  orange: "bg-orange-50 text-orange-700",
  blue: "bg-sky-50 text-sky-700",
  grey: "bg-slate-100 text-slate-600",
  "red-outline": "border border-red-300 text-red-700",
  "green-outline": "border border-emerald-300 text-emerald-700",
  "blue-outline": "border border-sky-300 text-sky-700",
  "grey-outline": "border border-slate-300 text-slate-600"
};
