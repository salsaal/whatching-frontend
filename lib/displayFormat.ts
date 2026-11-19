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

/** The app's one date style: "19 Nov 2026". */
export const formatDate = (value?: string | Date | null) => {
  const date = toDate(value);
  return date ? dayMonthYearFormat.format(date) : "-";
};

/** The same with the time: "19 Nov 2026, 3:23 pm". */
export const formatDateTime = (value?: string | Date | null) => {
  const date = toDate(value);
  return date ? `${dayMonthYearFormat.format(date)}, ${time(date)}` : "-";
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A "2026-10-22" day key (as the analytics API sends) read as that local
 * day: "22 Oct", or "22 Oct 2026" with `withYear`. Other text is returned
 * unchanged.
 */
export const formatDayKey = (key: string, withYear = false) => {
  if (!DAY_KEY.test(key)) return key;
  const date = toDate(`${key}T00:00:00`);
  if (!date) return key;
  return (withYear ? dayMonthYearFormat : dayMonthFormat).format(date);
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

const LETTER = new RegExp("\\p{L}", "u");

/**
 * Up to two initials from a name ("Riya Shah" is "RS", "@riya" is "R").
 * Empty when the name has no letters, such as a phone number, so the caller
 * can show a person icon instead of "+9".
 */
export const getInitials = (name?: string | null) =>
  (name || "")
    .split(/\s+/)
    .map((part) => Array.from(part).find((char) => LETTER.test(char)) || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * A timezone as people know it: "Asia/Calcutta" is "IST". Zones without a
 * common short name read "Dubai (GMT+4)".
 */
export const formatTimezone = (timeZone?: string | null) => {
  if (!timeZone) return "";
  try {
    const shortName = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      timeZoneName: "short"
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    if (shortName && !/^(GMT|UTC)/.test(shortName)) return shortName;
    const city = (timeZone.split("/").pop() || timeZone).replace(/_/g, " ");
    return shortName ? `${city} (${shortName})` : city;
  } catch {
    return timeZone;
  }
};

/**
 * A timezone for a picker: "Kolkata (IST)", "Dubai (GST)",
 * "Kathmandu (GMT+5:45)". UTC stays "UTC".
 */
export const formatTimezoneOption = (timeZone: string) => {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  const city = (timeZone.split("/").pop() || timeZone).replace(/_/g, " ");
  try {
    const shortName = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      timeZoneName: "short"
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return shortName ? `${city} (${shortName})` : city;
  } catch {
    return timeZone;
  }
};

let languageNames: Intl.DisplayNames | null | undefined;

/** A template language code as a name: "en_US" is "English (US)". */
export const formatLanguage = (code?: string | null) => {
  const raw = (code || "").trim();
  if (!raw) return "";
  const [language, region] = raw.replace(/-/g, "_").split("_");
  try {
    if (languageNames === undefined) {
      languageNames = new Intl.DisplayNames(["en"], { type: "language" });
    }
    const name = languageNames?.of(language);
    if (!name || name === language) return raw;
    return region ? `${name} (${region.toUpperCase()})` : name;
  } catch {
    languageNames = null;
    return raw;
  }
};

/**
 * A template's Meta name as words, for things people name themselves:
 * "festive_template_amidex" is "Festive template amidex".
 */
export const humanizeTemplateName = (name?: string | null) => {
  const words = (name || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return words
    ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
    : "";
};
