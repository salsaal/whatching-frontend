import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  cancelBroadcast,
  consentToBroadcastMessagingLimitRetry,
  previewBroadcastAudienceCount,
  startBroadcast
} from "@/client-api/functions/broadcasts";
import { Broadcast } from "@/client-api/types/broadcasts.type";
import {
  buildScheduledLocal,
  DEFAULT_SCHEDULE,
  ScheduleFields,
  scheduleProblem,
  ScheduleValue
} from "@/components/broadcasts/ScheduleFields";
import { TemplateCategoryBadge } from "@/components/shared/StatusBadges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { describeAudience, warningText } from "@/lib/broadcastAudience";
import {
  hasBroadcastRetryPreference,
  setBroadcastRetryPreference
} from "@/lib/broadcastRetryPreference";
import { computeBroadcastFunnel } from "@/lib/broadcastFunnel";
import { formatCount } from "@/lib/displayFormat";
import { isBroadcastSending } from "@/lib/statusPresentation";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

const errorMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
  fallback;

export const broadcastSenderLabel = (broadcast: Broadcast) =>
  broadcast.whatsappSender?.displayPhoneNumber ||
  broadcast.displayPhoneNumber ||
  broadcast.whatsappSender?.phoneNumberId ||
  broadcast.whatsappPhoneNumberId ||
  broadcast.phoneNumberId ||
  "";

/** Org timezone the backend schedules in. */
export const useOrgTimezone = () =>
  useOrganizationStore(
    (state) => state.activeOrganization?.timezone || "Asia/Kolkata"
  );

/** "≈ 413 contacts" for a draft or schedule that hasn't fanned out yet. */
export function EstimatedAudience({
  broadcast,
  className
}: {
  broadcast: Broadcast;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["broadcast-audience-count", broadcast.audience],
    queryFn: () => previewBroadcastAudienceCount(broadcast.audience),
    staleTime: 60_000
  });
  if (isLoading) return <span className={className}>Counting…</span>;
  const count = data?.data?.count;
  return (
    <span className={className}>
      {typeof count === "number" ? `≈ ${formatCount(count)} contacts` : "-"}
    </span>
  );
}

// Thin stacked bar: green delivered+read, grey sent, amber waiting, red
// failed. Uses the cumulative funnel so "read" counts as delivered.
export function BroadcastProgress({ broadcast }: { broadcast: Broadcast }) {
  const funnel = computeBroadcastFunnel(broadcast.stats);
  if (broadcast.status === "draft" || broadcast.status === "scheduled") {
    return (
      <EstimatedAudience
        broadcast={broadcast}
        className="text-xs text-muted-foreground"
      />
    );
  }
  const total = Math.max(funnel.total, 1);
  const segment = (value: number) => `${(value / total) * 100}%`;
  return (
    <div className="min-w-40 space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className="bg-emerald-500"
          style={{ width: segment(funnel.delivered) }}
        />
        <span
          className="bg-slate-400"
          style={{ width: segment(funnel.sentOnly) }}
        />
        <span
          className="bg-amber-400"
          style={{ width: segment(funnel.waiting) }}
        />
        <span
          className="bg-red-500"
          style={{ width: segment(funnel.failed) }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatCount(funnel.delivered)} of {formatCount(funnel.total)} delivered
        {funnel.failed > 0 && ` · ${formatCount(funnel.failed)} failed`}
      </p>
    </div>
  );
}

export function StartBroadcastDialog({
  broadcast,
  open,
  onOpenChange,
  onStarted
}: {
  broadcast: Broadcast | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted?: () => void;
}) {
  const queryClient = useQueryClient();
  const timezone = useOrgTimezone();
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSchedule(DEFAULT_SCHEDULE);
      setError("");
    }
  }, [open]);

  const { mutate, isPending } = useMutation({
    mutationFn: startBroadcast,
    meta: { showToast: false },
    onSuccess: async (response) => {
      toast.success(response.message || "Broadcast started.");
      (response.data?.warnings || [])
        .map(warningText)
        .filter(Boolean)
        .forEach((message) => toast.info(message));
      await queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      await queryClient.invalidateQueries({ queryKey: ["broadcast-detail"] });
      onOpenChange(false);
      onStarted?.();
    },
    onError: (failure) =>
      setError(errorMessage(failure, "Couldn't start this broadcast."))
  });

  const problem = scheduleProblem(schedule);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-sm:h-dvh max-sm:max-w-none max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle>Start or schedule</DialogTitle>
          <DialogDescription>
            Nothing is sent until you confirm.
          </DialogDescription>
        </DialogHeader>
        {broadcast && (
          <dl className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Broadcast</dt>
              <dd className="truncate font-medium">{broadcast.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Template</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">
                  {broadcast.template?.name}
                </span>
                <TemplateCategoryBadge
                  category={broadcast.template?.category}
                />
              </dd>
            </div>
            {broadcastSenderLabel(broadcast) && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">From</dt>
                <dd className="font-medium">
                  {broadcastSenderLabel(broadcast)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">To</dt>
              <dd className="text-right font-medium">
                <EstimatedAudience broadcast={broadcast} />
                <span className="block text-xs font-normal text-muted-foreground">
                  {describeAudience(broadcast.audience)}
                </span>
              </dd>
            </div>
          </dl>
        )}
        <ScheduleFields
          value={schedule}
          onChange={setSchedule}
          timezone={timezone}
          disabled={isPending}
        />
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={!broadcast || Boolean(problem)}
            isLoading={isPending}
            onClick={() =>
              broadcast &&
              mutate({
                broadcastId: broadcast._id,
                payload:
                  schedule.mode === "schedule"
                    ? {
                        scheduledLocal: buildScheduledLocal(schedule),
                        timezone
                      }
                    : {}
              })
            }
          >
            {schedule.mode === "schedule" ? "Schedule" : "Send now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Discard a draft, cancel a schedule, or stop a broadcast mid-send. */
export function CancelBroadcastDialog({
  broadcast,
  open,
  onOpenChange,
  onDone
}: {
  broadcast: Broadcast | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: cancelBroadcast,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success(
        broadcast?.status === "draft"
          ? "Draft discarded."
          : "Broadcast canceled."
      );
      await queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      await queryClient.invalidateQueries({ queryKey: ["broadcast-detail"] });
      onOpenChange(false);
      onDone?.();
    },
    onError: (failure) =>
      toast.error(errorMessage(failure, "Couldn't cancel this broadcast."))
  });

  const status = broadcast?.status;
  const copy =
    status === "draft"
      ? {
          title: "Discard this draft?",
          body: "Nothing has been sent. The draft is removed from your list of active broadcasts.",
          action: "Discard draft"
        }
      : status === "scheduled"
        ? {
            title: "Cancel this schedule?",
            body: "Nothing has been sent yet, and nothing will be.",
            action: "Cancel schedule"
          }
        : {
            title: "Cancel this broadcast?",
            body: "Messages already sent stay sent. Contacts who haven't received it yet won't get it.",
            action: "Cancel broadcast"
          };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              if (broadcast) mutate(broadcast._id);
            }}
          >
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Grants the messaging-limit retry for broadcasts created with "Retry after
 * a Meta messaging-limit pause" on (a per-browser preference), as soon as
 * the backend asks for consent.
 */
export function useAutoConsentRetry(broadcasts: Broadcast[]) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: consentToBroadcastMessagingLimitRetry,
    meta: { showToast: false },
    onSuccess: async (response) => {
      toast.success(response.message);
      setBroadcastRetryPreference(response.data.broadcastId, false);
      await queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      await queryClient.invalidateQueries({ queryKey: ["broadcast-detail"] });
    },
    onError: (failure, broadcastId) => {
      setBroadcastRetryPreference(broadcastId, false);
      toast.error(errorMessage(failure, "Couldn't resume this broadcast."));
    }
  });

  useEffect(() => {
    const candidate = broadcasts.find(
      (broadcast) =>
        broadcast.status === "paused_limit" &&
        broadcast.messagingLimitRetry?.status === "awaiting_consent" &&
        hasBroadcastRetryPreference(broadcast._id)
    );
    if (candidate && !isPending) mutate(candidate._id);
  }, [broadcasts, isPending, mutate]);

  return { consent: mutate, isConsenting: isPending };
}

/** Which actions a broadcast offers, by status (list and details agree). */
export const broadcastActionsFor = (broadcast: Broadcast) => {
  const status = broadcast.status;
  return {
    canStart: status === "draft",
    canDiscard: status === "draft",
    canCancelSchedule: status === "scheduled",
    canCancel: isBroadcastSending(status) || status === "paused_limit",
    canDuplicate: ["completed", "failed", "canceled"].includes(status),
    needsRetryConsent:
      status === "paused_limit" &&
      broadcast.messagingLimitRetry?.status === "awaiting_consent"
  };
};

export const retryingPillClass = cn(
  "inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
);
