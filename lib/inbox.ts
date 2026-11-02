import { formatPhoneNumberIntl } from "react-phone-number-input/input";

import type {
  ChatMessage,
  ConversationStatus
} from "@/client-api/types/chat.type";

// Pure helpers for the inbox (pages/conversations.tsx), kept out of the page
// so they can be unit-tested.

export const STATUS_DESCRIPTIONS: Record<ConversationStatus, string> = {
  open: "An active conversation, with the bot or a person handling it.",
  pending:
    "A customer asked for a person and nobody has picked it up yet. The bot is paused.",
  resolved: "Done. A new message from the customer reopens it."
};

// ---------------------------------------------------------------------------
// WhatsApp text formatting: *bold*, _italic_, ~strike~ and ```mono```.
// Returns a tree of plain strings and formatted nodes; the page renders it
// as React elements, so everything else stays escaped.

export type FormattedText =
  | string
  | {
      type: "bold" | "italic" | "strike" | "mono";
      children: FormattedText[];
    };

const BOUNDARY = "[\\s\\p{P}\\p{S}]";

// A marker only counts at a word boundary and must hug its text, like
// WhatsApp: "*bold*" formats, "file_name_here" and "2 * 3 * 4" don't.
const inlinePattern = (marker: string) => {
  // Unicode regexes reject needless escapes like "\_", so escape only "*".
  const m = marker === "*" ? "\\*" : marker;
  return new RegExp(
    `(^|${BOUNDARY})${m}(\\S(?:[^${m}\\n]*?\\S)?)${m}(?=$|${BOUNDARY})`,
    "u"
  );
};

const FORMAT_PATTERNS: Array<{
  type: Exclude<FormattedText, string>["type"];
  pattern: RegExp;
  hasPrefix: boolean;
}> = [
  { type: "mono", pattern: /```([\s\S]+?)```/, hasPrefix: false },
  { type: "bold", pattern: inlinePattern("*"), hasPrefix: true },
  { type: "italic", pattern: inlinePattern("_"), hasPrefix: true },
  { type: "strike", pattern: inlinePattern("~"), hasPrefix: true }
];

export const parseWhatsAppFormatting = (text: string): FormattedText[] => {
  let earliest: {
    type: Exclude<FormattedText, string>["type"];
    start: number;
    end: number;
    inner: string;
  } | null = null;

  for (const { type, pattern, hasPrefix } of FORMAT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const prefix = hasPrefix ? match[1] : "";
    const start = match.index + prefix.length;
    if (!earliest || start < earliest.start) {
      earliest = {
        type,
        start,
        end: match.index + match[0].length,
        inner: hasPrefix ? match[2] : match[1]
      };
    }
  }

  if (!earliest) return text ? [text] : [];

  const nodes: FormattedText[] = [];
  if (earliest.start > 0) nodes.push(text.slice(0, earliest.start));
  nodes.push({
    type: earliest.type,
    children:
      earliest.type === "mono"
        ? [earliest.inner]
        : parseWhatsAppFormatting(earliest.inner)
  });
  nodes.push(...parseWhatsAppFormatting(text.slice(earliest.end)));
  return nodes;
};

const flattenFormatting = (nodes: FormattedText[]): string =>
  nodes
    .map((node) =>
      typeof node === "string"
        ? node
        : node.type === "mono"
          ? `\`\`\`${flattenFormatting(node.children)}\`\`\``
          : flattenFormatting(node.children)
    )
    .join("");

// For one-line previews: drops the *, _ and ~ that format text, and keeps
// any that are just part of it ("file_name", "2 * 3").
export const stripWhatsAppFormatting = (text: string) =>
  flattenFormatting(parseWhatsAppFormatting(text));

// ---------------------------------------------------------------------------
// Dates and times. Everything takes `now` so tests don't depend on the clock.

const DAY_MS = 24 * 60 * 60 * 1000;

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});
const dayMonthFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short"
});
const dayMonthYearFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric"
});
const weekdayFormatter = new Intl.DateTimeFormat("en-IN", {
  weekday: "short"
});
const longWeekdayFormatter = new Intl.DateTimeFormat("en-IN", {
  weekday: "long"
});

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// Calendar days between two dates, not 24-hour periods: 11 pm yesterday is
// one day ago at 1 am today.
const daysBetween = (date: Date, now: Date) =>
  Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);

const toDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// "4:20 pm"
export const formatClockTime = (value?: string | Date | null) => {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "";
};

const formatDayMonth = (date: Date, now: Date) =>
  date.getFullYear() === now.getFullYear()
    ? dayMonthFormatter.format(date)
    : dayMonthYearFormatter.format(date);

// List rows: "4:20 pm" today, "Yesterday", the weekday within a week, then
// "30 Oct".
export const formatListTime = (
  value?: string | Date | null,
  now: Date = new Date()
) => {
  const date = toDate(value);
  if (!date) return "";
  const days = daysBetween(date, now);
  if (days <= 0) return timeFormatter.format(date);
  if (days === 1) return "Yesterday";
  if (days < 7) return longWeekdayFormatter.format(date);
  return formatDayMonth(date, now);
};

// Thread dividers: "Today", "Yesterday", then "Mon 30 Oct".
export const formatDayDivider = (
  value?: string | Date | null,
  now: Date = new Date()
) => {
  const date = toDate(value);
  if (!date) return "";
  const days = daysBetween(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${weekdayFormatter.format(date)} ${formatDayMonth(date, now)}`;
};

export const dayKey = (value?: string | Date | null) => {
  const date = toDate(value);
  return date
    ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    : "";
};

// "5:30 pm" when it's today, "3 Nov, 5:30 pm" otherwise.
export const formatUntil = (
  value?: string | Date | null,
  now: Date = new Date()
) => {
  const date = toDate(value);
  if (!date) return "";
  return daysBetween(date, now) === 0
    ? timeFormatter.format(date)
    : `${formatDayMonth(date, now)}, ${timeFormatter.format(date)}`;
};

// ---------------------------------------------------------------------------
// Contacts

// Same shape as the WhatsApp number chip: "+91 87770 19926".
export const formatPhoneNumber = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return formatPhoneNumberIntl(`+${digits}`) || raw;
};

// ---------------------------------------------------------------------------
// Bot state

const HANDOFF_REASON_LABELS: Record<string, string> = {
  customer_requested_agent: "Customer asked for a person",
  ai_handoff_confirmed: "Customer asked for a person",
  instagram_ai_handoff_confirmed: "Customer asked for a person",
  interactive_escalation: "Customer tapped a 'talk to us' button",
  instagram_flow_handoff: "The flow handed over to a person",
  ai_requested_human_help: "AI suggested a person",
  ai_provider_unavailable: "AI was unavailable",
  ai_token_quota_exhausted: "AI credits ran out",
  marked_pending: "Marked as Pending by the team"
};

export const describeHandoffReason = (reason?: string | null) =>
  (reason && HANDOFF_REASON_LABELS[reason]) || "Asked for a person";

// ---------------------------------------------------------------------------
// Messages

// Older system notes were written with internal words; newer ones already
// read fine and pass through unchanged.
const SYSTEM_NOTE_REWRITES: Array<[RegExp, string]> = [
  [/^Instagram automation routed to node:\s*([\s\S]+)$/, "Bot sent: $1"],
  [/^Bot routed to flow:\s*([\s\S]+)$/, "Bot sent: $1"],
  [
    /^(?:Instagram )?AI fallback handled the latest customer message\.?$/,
    "AI assistant replied"
  ]
];

export const rewriteSystemNote = (text: string) => {
  const trimmed = text.trim();
  for (const [pattern, replacement] of SYSTEM_NOTE_REWRITES) {
    if (pattern.test(trimmed)) return trimmed.replace(pattern, replacement);
  }
  return text;
};

export const messageTimestamp = (
  message: Pick<ChatMessage, "sentAt" | "createdAt">
) => message.sentAt || message.createdAt;

// The order the API returns a thread in: sentAt, then _id.
export const compareMessages = (
  a: Pick<ChatMessage, "_id" | "sentAt" | "createdAt">,
  b: Pick<ChatMessage, "_id" | "sentAt" | "createdAt">
) => {
  const timeA = new Date(messageTimestamp(a)).getTime() || 0;
  const timeB = new Date(messageTimestamp(b)).getTime() || 0;
  if (timeA !== timeB) return timeA - timeB;
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
};

// Places a realtime message where a reload would put it, not at the end.
export const insertMessageInOrder = <
  T extends Pick<ChatMessage, "_id" | "sentAt" | "createdAt">
>(
  messages: T[],
  message: T
) => {
  let index = messages.length;
  while (index > 0 && compareMessages(messages[index - 1], message) > 0) {
    index -= 1;
  }
  return [...messages.slice(0, index), message, ...messages.slice(index)];
};

export type CarouselCard = {
  key: string;
  mediaType: "image" | "video" | null;
  mediaUrl: string;
  title: string;
  body: string;
  buttons: string[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const mediaLink = (value: unknown) => {
  const media = asRecord(value);
  return firstString(
    media.link,
    media.url,
    media.mediaUrl,
    media.cloudinaryUrl
  );
};

// Cards from a WhatsApp interactive carousel or an Instagram generic
// template, in one shape for the bubble.
export const getCarouselCards = (payload: Record<string, unknown> = {}) => {
  const cards: CarouselCard[] = [];

  const interactive = asRecord(payload.interactive);
  asArray(asRecord(interactive.action).cards).forEach((card, index) => {
    const record = asRecord(card);
    const header = asRecord(record.header);
    const headerType = firstString(header.type);
    const mediaType =
      headerType === "image" || headerType === "video" ? headerType : null;
    const action = asRecord(record.action);
    const buttons = [
      firstString(asRecord(action.parameters).display_text),
      ...asArray(action.buttons).map((button) => {
        const buttonRecord = asRecord(button);
        return firstString(
          asRecord(buttonRecord.quick_reply).title,
          asRecord(buttonRecord.reply).title,
          buttonRecord.title
        );
      })
    ].filter(Boolean);
    cards.push({
      key: `wa-${index}`,
      mediaType,
      mediaUrl: mediaType ? mediaLink(header[mediaType]) : "",
      title: "",
      body: firstString(asRecord(record.body).text),
      buttons
    });
  });

  const instagramTemplate = asRecord(
    asRecord(asRecord(payload.instagramMessage).attachment).payload
  );
  if (instagramTemplate.template_type === "generic") {
    asArray(instagramTemplate.elements).forEach((element, index) => {
      const record = asRecord(element);
      const imageUrl = firstString(record.image_url);
      cards.push({
        key: `ig-${index}`,
        mediaType: imageUrl ? "image" : null,
        mediaUrl: imageUrl,
        title: firstString(record.title),
        body: firstString(record.subtitle),
        buttons: asArray(record.buttons)
          .map((button) => firstString(asRecord(button).title))
          .filter(Boolean)
      });
    });
  }

  return cards;
};
