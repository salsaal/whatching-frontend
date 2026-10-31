// What happened to one broadcast recipient, in plain words. Used by the
// details page (KPIs, reasons card, recipient table) and anywhere else a
// recipient status or Meta error code is shown.

import { formatWhen } from "@/lib/displayFormat";

export type OutcomeTone = "green" | "blue" | "grey" | "amber" | "red";

export interface RecipientOutcome {
  label: string;
  /** Sub-line or tooltip; empty when the label says it all. */
  explanation: string;
  tone: OutcomeTone;
}

// Meta retries a 131049 (per-person marketing limit) recipient once, a
// day later; the backend schedules it 24h10m after the deferral.
const ENGAGEMENT_RETRY_DELAY_MS = (24 * 60 + 10) * 60 * 1000;

export const describeRecipientOutcome = ({
  status,
  errorCode,
  errorMessage,
  deferredAt
}: {
  status?: string | null;
  errorCode?: string | number | null;
  errorMessage?: string | null;
  deferredAt?: string | null;
}): RecipientOutcome => {
  const code = errorCode ? String(errorCode) : "";
  switch (status) {
    case "read":
      return { label: "Read", explanation: "", tone: "green" };
    case "delivered":
      return { label: "Delivered", explanation: "", tone: "green" };
    case "sent":
      return {
        label: "Sent",
        explanation: "Waiting for the phone to confirm delivery",
        tone: "blue"
      };
    case "queued":
    case "pending":
      return { label: "Queued", explanation: "", tone: "grey" };
    case "deferred": {
      if (code === "131049") {
        const retryAt = deferredAt
          ? new Date(new Date(deferredAt).getTime() + ENGAGEMENT_RETRY_DELAY_MS)
          : null;
        return {
          label: "Waiting to retry",
          explanation: retryAt
            ? `Meta limited marketing to this person. Retrying on ${formatWhen(retryAt)}`
            : "Meta limited marketing to this person. Retrying in about a day",
          tone: "amber"
        };
      }
      return {
        label: "Waiting",
        explanation: "Paused by the messaging limit; resumes automatically",
        tone: "amber"
      };
    }
    case "failed":
      switch (code) {
        case "131049":
          return {
            label: "Limited by Meta",
            explanation:
              "Meta limits marketing messages per person, especially people who haven't replied recently",
            tone: "red"
          };
        case "131050":
          return {
            label: "Marketing turned off",
            explanation:
              "This person turned off your marketing messages in WhatsApp",
            tone: "red"
          };
        case "131026":
          return {
            label: "Can't receive",
            explanation: "This number can't receive WhatsApp messages",
            tone: "red"
          };
        case "130472":
          return {
            label: "Held back by Meta",
            explanation: "Part of a Meta experiment; not delivered",
            tone: "red"
          };
        case "131042":
          return {
            label: "Payment issue",
            explanation: "Add a payment method for this WhatsApp account",
            tone: "red"
          };
        default:
          return {
            label: "Couldn't deliver",
            explanation: errorMessage || "Meta didn't deliver this message",
            tone: "red"
          };
      }
    case "skipped":
      return {
        label: "Skipped",
        explanation: errorMessage || "",
        tone: "grey"
      };
    case "canceled":
      return { label: "Canceled", explanation: "", tone: "grey" };
    default:
      return {
        label: status
          ? status.charAt(0).toUpperCase() + status.slice(1)
          : "Unknown",
        explanation: errorMessage || "",
        tone: "grey"
      };
  }
};

export const outcomeToneClass: Record<OutcomeTone, string> = {
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-700",
  grey: "bg-slate-100 text-slate-600",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700"
};
