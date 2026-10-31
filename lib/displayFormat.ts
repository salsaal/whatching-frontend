// Shared number and date wording for templates and broadcasts, so every page
// says "12,480", "0.4%" and "Today, 11:00 am" the same way.

const countFormat = new Intl.NumberFormat("en-IN");

export const formatCount = (value: number | null | undefined) =>
  countFormat.format(Number.isFinite(value) ? Number(value) : 0);

/** Whole percent, except a single decimal below 1% so small shares aren't 0%. */
export const formatPercent = (value: number, total: number) => {
  if (!total || !Number.isFinite(value)) return "0%";
  const percent = (value / total) * 100;
  if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
};

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});
const dayMonthFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short"
});
const dayMonthYearFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

const toDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const time = (date: Date) => timeFormat.format(date).toLowerCase();

/**
 * "12 min ago" within the last hour, "Today, 11:00 am" later the same day,
 * otherwise "30 Oct, 11:00 am" (with the year when it isn't this year).
 */
export const formatWhen = (
  value?: string | Date | null,
  now: Date = new Date()
) => {
  const date = toDate(value);
  if (!date) return "-";
  const diffMs = now.getTime() - date.getTime();
  if (diffMs >= 0 && diffMs < 60 * 60 * 1000) {
    const minutes = Math.floor(diffMs / 60_000);
    return minutes < 1 ? "Just now" : `${minutes} min ago`;
  }
  if (isSameDay(date, now)) return `Today, ${time(date)}`;
  const day =
    date.getFullYear() === now.getFullYear()
      ? dayMonthFormat.format(date)
      : dayMonthYearFormat.format(date);
  return `${day}, ${time(date)}`;
};

/** Short relative time either side of now: "3 h ago", "in 2 d". */
export const formatRelative = (
  value?: string | Date | null,
  now: Date = new Date()
) => {
  const date = toDate(value);
  if (!date) return "-";
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const amount =
    minutes < 1
      ? null
      : minutes < 60
        ? `${minutes} min`
        : hours < 24
          ? `${hours} h`
          : days < 30
            ? `${days} d`
            : null;
  if (amount === null) {
    return minutes < 1 ? "Just now" : dayMonthYearFormat.format(date);
  }
  return diffMs >= 0 ? `in ${amount}` : `${amount} ago`;
};

/** "2 h 14 min" until a future time; "now" once it has passed. */
export const formatCountdown = (
  value?: string | Date | null,
  now: Date = new Date()
) => {
  const date = toDate(value);
  if (!date) return "";
  const totalMinutes = Math.round((date.getTime() - now.getTime()) / 60_000);
  if (totalMinutes <= 0) return "now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} d` : "",
    hours ? `${hours} h` : "",
    !days && minutes ? `${minutes} min` : ""
  ]
    .filter(Boolean)
    .join(" ");
};

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
