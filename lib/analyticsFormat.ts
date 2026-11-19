import { AnalyticsTrend } from "@/client-api/types/analytics.type";

const countFormat = new Intl.NumberFormat("en-IN");

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDayKey = (key: string) => {
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
};

/**
 * Meta's daily figures only include days that had conversations. Fills the
 * rest of the range with zeros, so the chart's days are evenly spaced and a
 * gap reads as a quiet day, not as two days next to each other.
 */
export const fillDailyGaps = <T extends { date: string }>(
  rows: T[],
  start: string | undefined,
  end: string | undefined,
  empty: (date: string) => T
): T[] => {
  const from = start ? parseDayKey(start) : null;
  const to = end ? parseDayKey(end) : null;
  if (from === null || to === null || to < from) return rows;
  // A broken range shouldn't draw years of empty bars.
  if ((to - from) / DAY_MS > 400) return rows;
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const filled: T[] = [];
  for (let time = from; time <= to; time += DAY_MS) {
    const key = new Date(time).toISOString().slice(0, 10);
    filled.push(byDate.get(key) || empty(key));
  }
  return filled;
};

export type TrendDirection = "up" | "down" | "flat";

export interface TrendDescription {
  label: string;
  direction: TrendDirection;
  title: string;
}

// Below this, a percentage change says more about the small starting number
// than about the change ("+1620%" from 5), so the two numbers are shown.
const SMALL_BASE = 20;
const LARGE_CHANGE_PERCENT = 300;

/**
 * How a figure moved since the previous period, in words that hold up:
 * - a rate changes by points ("+4.2 pts"), not by a percentage of itself;
 * - a count from a small base, or with a huge swing, shows both numbers
 *   ("86 vs 5");
 * - otherwise a whole percentage ("+12%").
 * Null when there is nothing to compare.
 */
export const describeTrend = (
  trend: AnalyticsTrend | undefined,
  kind: "count" | "rate" = "count"
): TrendDescription | null => {
  if (!trend) return null;
  const { current, previous } = trend;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0 && current === 0) return null;

  if (kind === "rate") {
    const points = Math.round((current - previous) * 10) / 10;
    const direction: TrendDirection =
      points > 0 ? "up" : points < 0 ? "down" : "flat";
    return {
      label:
        direction === "flat"
          ? "No change"
          : `${points > 0 ? "+" : ""}${points} pts`,
      direction,
      title: `${previous}% in the previous period`
    };
  }

  const direction: TrendDirection =
    current > previous ? "up" : current < previous ? "down" : "flat";
  const title = `${countFormat.format(previous)} in the previous period`;
  if (previous === 0) return { label: "New", direction: "up", title };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (previous < SMALL_BASE || Math.abs(percent) > LARGE_CHANGE_PERCENT) {
    return {
      label: `${countFormat.format(current)} vs ${countFormat.format(previous)}`,
      direction,
      title
    };
  }
  return {
    label:
      direction === "flat"
        ? "No change"
        : `${percent > 0 ? "+" : ""}${percent}%`,
    direction,
    title
  };
};

export interface HealthAlertInput {
  code?: string;
  message?: string;
}

export interface HealthAlertDescription {
  text: string;
  actionUrl?: string;
  actionLabel?: string;
}

const URL_PATTERN = /https?:\/\/[^\s)]+/g;
const HAS_URL = /https?:\/\//;

const PAYMENT_BLOCKED_CODES = new Set([
  "META_PAYMENT_BLOCKED",
  "META_PAYMENT_METHOD_REQUIRED"
]);

/**
 * An alert from Meta, readable: links come out of the sentence and become a
 * button, and the payment block, which Meta words at length, gets one short
 * sentence.
 */
export const describeHealthAlert = (
  alert: HealthAlertInput
): HealthAlertDescription => {
  const message = (alert.message || "").trim();
  const url = message.match(URL_PATTERN)?.[0]?.replace(/[.,]+$/, "");
  if (alert.code && PAYMENT_BLOCKED_CODES.has(alert.code)) {
    return {
      text: "Meta won't send messages from this number until a payment method is added to your WhatsApp Business account.",
      actionUrl: url,
      actionLabel: url ? "Add payment method" : undefined
    };
  }
  // Drop the sentences that only carry a link ("Visit https://… to resolve
  // this issue.").
  const text = message
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .filter((sentence) => !HAS_URL.test(sentence))
    .join(" ")
    .trim();
  return {
    text: text || message.replace(URL_PATTERN, "").trim(),
    actionUrl: url,
    actionLabel: url ? "Open in Meta" : undefined
  };
};
