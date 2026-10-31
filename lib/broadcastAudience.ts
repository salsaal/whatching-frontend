import { BroadcastAudience } from "@/client-api/types/broadcasts.type";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** "All contacts", "Tags: vip, new", "12 selected contacts", "2 campaigns". */
export const describeAudience = (audience?: BroadcastAudience | null) => {
  if (!audience) return "All contacts";
  switch (audience.mode) {
    case "tags": {
      const tags = audience.tags || [];
      const shown = tags.slice(0, 3).join(", ");
      const extra = tags.length > 3 ? ` +${tags.length - 3}` : "";
      return tags.length
        ? `Tags (${audience.tagMatch === "all" ? "all of" : "any of"}): ${shown}${extra}`
        : "Tags";
    }
    case "specific":
      return plural(audience.subscriberIds?.length || 0, "selected contact");
    case "campaign":
      return plural(audience.campaignSourceIds?.length || 0, "campaign");
    default:
      return "All contacts";
  }
};

export const hasAudienceSelection = (audience: BroadcastAudience) =>
  audience.mode === "all" ||
  (audience.mode === "tags" && Boolean(audience.tags?.length)) ||
  (audience.mode === "specific" && Boolean(audience.subscriberIds?.length)) ||
  (audience.mode === "campaign" && Boolean(audience.campaignSourceIds?.length));

/** Backend warnings arrive as strings or { code, message } objects. */
export const warningText = (warning: unknown) =>
  typeof warning === "string"
    ? warning
    : warning && typeof warning === "object" && "message" in warning
      ? String((warning as { message?: unknown }).message || "")
      : "";
