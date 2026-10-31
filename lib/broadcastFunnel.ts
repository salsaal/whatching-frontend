import { BroadcastStats } from "@/client-api/types/broadcasts.type";

// The backend's per-status counters are exclusive: a recipient who read the
// message is counted only in readRecipients, not also in delivered/sent.
// Shown raw, a broadcast everyone read reported "Delivered 0%". The funnel
// is therefore cumulative: read implies delivered implies sent.
export interface BroadcastFunnel {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  notDelivered: number;
  waiting: number;
  queued: number;
  canceled: number;
  /** Sent but not yet confirmed delivered. */
  sentOnly: number;
}

export const computeBroadcastFunnel = (
  stats?: Partial<BroadcastStats> | null
): BroadcastFunnel => {
  const n = (value?: number) => (Number.isFinite(value) ? Number(value) : 0);
  const read = n(stats?.readRecipients);
  const delivered = n(stats?.deliveredRecipients) + read;
  const sent = n(stats?.sentRecipients) + delivered;
  const failed = n(stats?.failedRecipients);
  const skipped = n(stats?.skippedRecipients);
  return {
    total: n(stats?.totalRecipients),
    sent,
    delivered,
    read,
    failed,
    skipped,
    notDelivered: failed + skipped,
    waiting: n(stats?.deferredRecipients),
    queued: n(stats?.queuedRecipients),
    canceled: n(stats?.canceledRecipients),
    sentOnly: n(stats?.sentRecipients)
  };
};
