import type { QuickReply } from "@/client-api/types/quickReplies.type";

// Pure helpers for team quick replies: the "/" picker in the inbox composer
// and the form in Settings.

export const QUICK_REPLY_LIMITS = {
  shortcut: 30,
  title: 60,
  text: 4096,
  perWorkspace: 200
} as const;

/** What the server stores: no leading "/", lowercase, trimmed. */
export const normalizeShortcut = (value: string) => {
  const trimmed = value.trim();
  return (trimmed.startsWith("/") ? trimmed.slice(1) : trimmed).toLowerCase();
};

const SHORTCUT_PATTERN = /^[a-z0-9_-]+$/;

/** Plain-words problem with a shortcut, or "" when it's fine. */
export const shortcutProblem = (value: string) => {
  const shortcut = normalizeShortcut(value);
  if (!shortcut) return "Add a shortcut, like thanks.";
  if (shortcut.length > QUICK_REPLY_LIMITS.shortcut) {
    return `Keep the shortcut to ${QUICK_REPLY_LIMITS.shortcut} characters.`;
  }
  if (!SHORTCUT_PATTERN.test(shortcut)) {
    return "Use only letters, numbers, - and _ (no spaces).";
  }
  return "";
};

/**
 * The "/word" being typed at the cursor, if any: a "/" at the start or after
 * a space, followed by shortcut characters up to the cursor. `start` is where
 * the "/" is, so choosing a reply can replace it.
 */
export const findSlashQuery = (text: string, caret: number) => {
  const before = text.slice(0, caret);
  const match = /(^|\s)\/([a-z0-9_-]*)$/i.exec(before);
  if (!match) return null;
  return {
    start: match.index + match[1].length,
    query: match[2].toLowerCase()
  };
};

/**
 * Replies for the picker: shortcuts that start with the query first, then
 * ones whose shortcut or title contains it.
 */
export const matchQuickReplies = (
  replies: QuickReply[],
  query: string,
  limit = 8
) => {
  const q = query.trim().toLowerCase();
  if (!q) return replies.slice(0, limit);
  const starts: QuickReply[] = [];
  const contains: QuickReply[] = [];
  for (const reply of replies) {
    if (reply.shortcut.startsWith(q)) starts.push(reply);
    else if (
      reply.shortcut.includes(q) ||
      reply.title.toLowerCase().includes(q)
    ) {
      contains.push(reply);
    }
  }
  return [...starts, ...contains].slice(0, limit);
};

/** The composer text with the "/word" swapped for the reply's text. */
export const insertQuickReply = (
  text: string,
  slash: { start: number },
  caret: number,
  replyText: string
) => {
  const next = text.slice(0, slash.start) + replyText + text.slice(caret);
  return { text: next, caret: slash.start + replyText.length };
};

/** First line of the reply, for the picker and the list. */
export const firstLine = (text: string) =>
  text
    .split("\n")
    .find((line) => line.trim())
    ?.trim() || "";
