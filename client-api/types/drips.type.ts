import { BroadcastAudience } from "./broadcasts.type";

export type DripStatus = "draft" | "active" | "paused" | "archived";

export type DripWaitingReason =
  | "sending_hours"
  | "once_a_day"
  | "daily_limit"
  | "whatsapp_limit_retry"
  | "chatting";

/** How people join: added by the business, or when a contact gets a tag. */
export interface DripTrigger {
  type: "manual" | "tag_added";
  tag?: string | null;
}

/** What a reply does: stop the drip, pause while chatting, or carry on. */
export type DripOnReply = "stop" | "pause" | "continue";

export type DripComponent = Record<string, unknown>;

export interface DripStep {
  /** 1-based. */
  step: number;
  templateId: string;
  templateName: string;
  templateLanguage: string;
  templateCategory: string | null;
  hasStopButton: boolean;
  /** Variable values, in the broadcast composer's shape (no header file). */
  components: DripComponent[];
  delayMinutes: number;
}

export interface DripSendWindow {
  startHour: number;
  endHour: number;
  timezone: string;
}

export interface DripContactTotals {
  active: number;
  completed: number;
  stopped: number;
  total: number;
}

export interface Drip {
  id: string;
  name: string;
  status: DripStatus;
  pausedBy: string | null;
  pausedReason: string | null;
  pausedReasonText: string | null;
  phoneNumberId: string | null;
  steps: DripStep[];
  sendWindow: DripSendWindow;
  trigger: DripTrigger;
  /** Getting one of these tags ends the drip as "goal reached". */
  stopTags: string[];
  onReply: DripOnReply;
  /** Older field; read onReply. */
  stopOnReply: boolean;
  consentConfirmedAt?: string | null;
  activatedAt: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: DripContactTotals;
}

export interface DripStepInput {
  templateId: string;
  components: DripComponent[];
  delayMinutes: number;
}

export interface DripPayload {
  name?: string;
  phoneNumberId?: string;
  steps?: DripStepInput[];
  sendWindow?: Partial<DripSendWindow>;
  trigger?: DripTrigger;
  stopTags?: string[];
  onReply?: DripOnReply;
}

export type DripAudience = Pick<
  BroadcastAudience,
  "mode" | "tags" | "tagMatch" | "subscriberIds" | "campaignSourceIds"
>;

export interface DripAudiencePreview {
  matched: number;
  willJoin: number;
  stoppedOffers: number;
  usNumbers: number;
  cantMessage: number;
  warnings: unknown[];
}

export interface StartDripPayload {
  /** Not sent for a tag drip. */
  audience?: DripAudience;
  /** Tag drips: also add the contacts who already have the tag. */
  includeExisting?: boolean;
  consentConfirmed: true;
  scheduledAt?: string;
  scheduledLocal?: string;
  timezone?: string;
}

export interface DripStepReport {
  step: number;
  templateName: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  stoppedOffers: number;
  notDelivered: number;
  failed: number;
  skipped: number;
  retrying: number;
}

export interface DripStopReasonCount {
  reason: string;
  text: string | null;
  count: number;
}

export interface DripReport {
  drip: Drip;
  stopReasons: DripStopReasonCount[];
  waiting: Partial<Record<DripWaitingReason, number>>;
  /** Each time through counts. */
  joined?: { total: number; byHand: number; byTag: number };
  goal?: { reached: number; rate: number };
  steps: DripStepReport[];
}

export type DripContactStatus = "active" | "completed" | "stopped";

export interface DripContactRow {
  id: string;
  contact: { id: string; name: string | null; phone: string | null } | null;
  status: DripContactStatus;
  /** 2 or more: joined this drip again (tag drips). */
  round: number;
  joinedBy?: "tag" | "hand";
  nextStep: number | null;
  nextRunAt: string | null;
  waitingReason: DripWaitingReason | null;
  stepsSent: number;
  stopReason: string | null;
  stopReasonText: string | null;
  enrolledAt: string;
  lastSentAt: string | null;
  completedAt: string | null;
  stoppedAt: string | null;
}

export interface DripContactsParams {
  status?: DripContactStatus;
  stopReason?: string;
  page?: number;
  limit?: number;
}

export interface DripContactsPage {
  contacts: DripContactRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** A drip one contact is in, or was recently (the inbox contact panel). */
export interface ContactDripRow {
  id: string;
  drip: { id: string; name: string; status: DripStatus; steps: number };
  status: DripContactStatus;
  round: number;
  nextStep: number | null;
  nextRunAt: string | null;
  waitingReason: DripWaitingReason | null;
  stepsSent: number;
  stopReasonText: string | null;
  enrolledAt: string;
  endedAt: string | null;
}
