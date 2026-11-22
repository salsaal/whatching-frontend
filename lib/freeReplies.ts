// Wording for the Analytics "Free customer replies this month" card. Spec:
// the backend's docs/FREE_REPLIES_FRONTEND_SPEC.md.

import type {
  FreeReplyNumber,
  FreeReplyState
} from "@/client-api/types/analytics.type";
import { formatRelative } from "@/lib/displayFormat";

const countFormat = new Intl.NumberFormat("en-IN");
const dayMonthLong = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long"
});

/** "2026-12-01" as "1 December"; other text unchanged. */
export const formatResetDay = (dayKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey;
  const date = new Date(`${dayKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dayKey : dayMonthLong.format(date);
};

export const freeRepliesSubtitle = (perMonth: number, resetsOn: string) =>
  `WhatsApp gives each number ${countFormat.format(perMonth)} free replies a month. Starts again on ${formatResetDay(resetsOn)}.`;

export const FREE_REPLIES_WAITING =
  "We'll show your free replies here within a few hours.";

/** The small print under the rows; "Updated …" only once counts exist. */
export const freeRepliesFooter = (
  perMonth: number,
  lastUpdatedAt: string | null,
  now: Date = new Date()
) => {
  const charges = `After ${countFormat.format(perMonth)}, WhatsApp (Meta) charges for each reply at its rate for the customer's country.`;
  const estimate =
    "These counts are close estimates; Meta's own count is final.";
  if (!lastUpdatedAt) return `${charges} ${estimate}`;
  const relative = formatRelative(lastUpdatedAt, now);
  const updated = relative === "Just now" ? "just now" : relative;
  return `${charges} Updated ${updated}. ${estimate}`;
};

const plural = (count: number, one: string, many: string) =>
  `${countFormat.format(count)} ${count === 1 ? one : many}`;

/** One number's row: the used count, the bar's share and its warning. */
export const freeReplyRow = (
  number: Pick<
    FreeReplyNumber,
    "freeRepliesUsed" | "freeRepliesLeft" | "chargedReplies" | "state"
  >,
  perMonth: number
): {
  used: string;
  percent: number;
  tone: FreeReplyState;
  note?: string;
} => {
  const used = `${countFormat.format(number.freeRepliesUsed)} of ${countFormat.format(perMonth)} used`;
  const percent =
    perMonth > 0
      ? Math.min(100, Math.max(0, (number.freeRepliesUsed / perMonth) * 100))
      : 0;
  switch (number.state) {
    case "nearly_used":
      return {
        used,
        percent,
        tone: "nearly_used",
        note: `${plural(number.freeRepliesLeft, "free reply", "free replies")} left`
      };
    case "used_up":
      return {
        used,
        percent,
        tone: "used_up",
        note:
          number.chargedReplies > 0
            ? `All free replies used · ${plural(number.chargedReplies, "charged reply", "charged replies")} so far`
            : "All free replies used"
      };
    default:
      return { used, percent, tone: "ok" };
  }
};
