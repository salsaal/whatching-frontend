import { InstagramCommentRule } from "@/client-api/types/instagram.type";

type RuleSummaryInput = Pick<
  InstagramCommentRule,
  | "keywords"
  | "keywordMode"
  | "scope"
  | "mediaIds"
  | "sendPublicReply"
  | "sendPrivateReply"
>;

const quoteList = (words: string[], joiner: "or" | "and") => {
  const quoted = words.map((word) => `"${word}"`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} ${joiner} ${quoted[quoted.length - 1]}`;
};

/**
 * What a comment automation does, in one sentence, matching the server:
 * no keywords means every comment, and keywords match anywhere in the
 * comment. "Replies publicly and by DM to any comment on all your posts."
 */
export const describeCommentRule = (rule: RuleSummaryInput) => {
  const keywords = (rule.keywords || [])
    .map((word) => word.trim())
    .filter(Boolean);
  const how =
    rule.sendPublicReply && rule.sendPrivateReply
      ? "Replies publicly and by DM"
      : rule.sendPublicReply
        ? "Replies publicly"
        : rule.sendPrivateReply
          ? "Replies by DM"
          : "Doesn't reply";
  const which = !keywords.length
    ? "any comment"
    : keywords.length === 1
      ? `comments containing "${keywords[0]}"`
      : rule.keywordMode === "all"
        ? `comments containing ${quoteList(keywords, "and")}`
        : `comments containing ${quoteList(keywords, "or")}`;
  const mediaCount = rule.mediaIds?.length || 0;
  const where =
    rule.scope === "all_media"
      ? "on all your posts"
      : `on ${mediaCount} selected post${mediaCount === 1 ? "" : "s"}`;
  return `${how} to ${which} ${where}.`;
};

/** True when the automation answers every comment it sees. */
export const repliesToEveryComment = (
  rule: Pick<RuleSummaryInput, "keywords">
) => !(rule.keywords || []).some((word) => word.trim());
