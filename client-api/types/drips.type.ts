import { BroadcastAudience } from "./broadcasts.type";

export type DripStatus = "draft" | "active" | "paused" | "archived";

export type DripWaitingReason =
  | "sending_hours"
  | "once_a_day"
  | "daily_limit"
  | "whatsapp_limit_retry";

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
  stopOnReply?: boolean;
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
  audience: DripAudience;
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
  steps: DripStepReport[];
}

export type DripContactStatus = "active" | "completed" | "stopped";

export interface DripContactRow {
  id: string;
  contact: { id: string; name: string | null; phone: string | null } | null;
  status: DripContactStatus;
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
