import {
  AdReplySetting,
  AdSourceReplySetting
} from "@/client-api/types/campaigns.type";
import { BotCanvasTrigger } from "@/client-api/types/bot.type";

// Ad replies: what we answer to the first message someone sends after
// tapping a Click-to-WhatsApp ad. One setting for all ads (bot settings),
// and each ad can set its own (the ad's `reply`).

export const AD_REPLY_TEXT_MAX = 1024;

/** The subscribe and unsubscribe flows can't be an ad reply. */
const HIDDEN_TRIGGER_KEYS = new Set(["OPT_IN", "OPT_OUT"]);

export type AdReplyChoiceMode = AdSourceReplySetting["mode"];

export interface AdReplyDraft {
  mode: AdReplyChoiceMode;
  text: string;
  triggerKey: string;
}

export const AD_REPLY_OPTIONS: Array<{
  value: AdReplyChoiceMode;
  label: string;
  help: string;
}> = [
  {
    value: "default",
    label: "Same as all ads",
    help: "Use the reply set at the top of this page."
  },
  {
    value: "off",
    label: "Normal bot reply",
    help: "Your bot answers the way it answers any message."
  },
  {
    value: "message",
    label: "Send a message",
    help: "Answer with a message you type."
  },
  {
    value: "flow",
    label: "Start a flow",
    help: "Answer with one of your bot flows."
  }
];

export const adReplyFlowChoices = (triggers: BotCanvasTrigger[] = []) =>
  triggers.filter(
    (trigger) => !HIDDEN_TRIGGER_KEYS.has(trigger.triggerKey.toUpperCase())
  );

/** The all-ads setting as a draft. Missing means the normal bot reply. */
export const draftFromAllAds = (
  setting?: Partial<AdReplySetting> | null
): AdReplyDraft => ({
  mode: setting?.mode || "off",
  text: setting?.text || "",
  triggerKey: setting?.triggerKey || ""
});

/** One ad's setting as a draft. Missing means "same as all ads". */
export const draftFromAd = (
  setting?: Partial<AdSourceReplySetting> | null
): AdReplyDraft => ({
  mode: setting?.mode || "default",
  text: setting?.text || "",
  triggerKey: setting?.triggerKey || ""
});

/** Only the field the mode needs, like the backend keeps it. */
export const draftToSetting = (draft: AdReplyDraft) => ({
  mode: draft.mode,
  ...(draft.mode === "message" ? { text: draft.text.trim() } : {}),
  ...(draft.mode === "flow" ? { triggerKey: draft.triggerKey } : {})
});

export const sameDraft = (a: AdReplyDraft, b: AdReplyDraft) =>
  JSON.stringify(draftToSetting(a)) === JSON.stringify(draftToSetting(b));

/** Same wording as the backend's 400s, caught before saving. */
export const adReplyProblem = (draft: AdReplyDraft) => {
  if (draft.mode === "message" && !draft.text.trim()) {
    return "Type the message to send.";
  }
  if (draft.mode === "flow" && !draft.triggerKey) {
    return "Choose the flow to start.";
  }
  return "";
};

const flowName = (triggerKey: string | undefined, flows: BotCanvasTrigger[]) =>
  flows.find((flow) => flow.triggerKey === triggerKey)?.name || "";

/** The short label on an ad row's Reply control. */
export const adReplyLabel = (
  setting: Partial<AdSourceReplySetting> | null | undefined,
  flows: BotCanvasTrigger[]
) => {
  const mode = setting?.mode || "default";
  if (mode === "message") return "Message";
  if (mode === "off") return "Normal bot reply";
  if (mode === "flow") {
    const name = flowName(setting?.triggerKey, flows);
    return name ? `Flow: ${name}` : "Flow (not live)";
  }
  return "Same as all ads";
};
