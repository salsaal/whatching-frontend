import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  addDripContacts,
  previewDripAudience,
  startDrip
} from "@/client-api/functions/drips";
import { BroadcastAudience } from "@/client-api/types/broadcasts.type";
import { Drip, DripAudiencePreview } from "@/client-api/types/drips.type";
import {
  AudiencePicker,
  EMPTY_AUDIENCE,
  useAudienceSources
} from "@/components/broadcasts/AudiencePicker";
import {
  buildScheduledLocal,
  DEFAULT_SCHEDULE,
  ScheduleFields,
  scheduleProblem,
  ScheduleValue
} from "@/components/broadcasts/ScheduleFields";
import { rememberDrip } from "@/components/drips/dripCache";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { formatCount, formatWhen } from "@/lib/displayFormat";
import { describeWait, dripErrorMessage } from "@/lib/drips";
import { hasAudienceSelection, warningText } from "@/lib/broadcastAudience";

const people = (count: number) =>
  `${formatCount(count)} ${count === 1 ? "person" : "people"}`;

/** The preview lines, leaving out the ones that are 0. */
export const previewLines = (preview: DripAudiencePreview) =>
  [
    preview.stoppedOffers > 0 &&
      `${people(preview.stoppedOffers)} asked not to get offers, so they're left out.`,
    preview.usNumbers > 0 &&
      `${people(preview.usNumbers)} ${preview.usNumbers === 1 ? "has a US number" : "have US numbers"}. WhatsApp doesn't deliver offers to US numbers, so they're left out.`,
    preview.cantMessage > 0 &&
      `${people(preview.cantMessage)} can't be messaged (they opted out, have no WhatsApp number, or are outside your plan's contact limit).`
  ].filter(Boolean) as string[];

/**
 * Who joins a drip: the broadcast audience picker with a live count, then
 * (to start) the consent tick and Start now or Schedule. "add" puts more
 * people into a drip that has already started.
 */
export function DripAudienceDialog({
  drip,
  mode,
  open,
  onOpenChange,
  onDone
}: {
  drip: Drip;
  mode: "start" | "add";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (drip: Drip) => void;
}) {
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<BroadcastAudience>(EMPTY_AUDIENCE);
  const [consent, setConsent] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [error, setError] = useState("");
  const sources = useAudienceSources(audience, open);
  const timezone = drip.sendWindow?.timezone || "Asia/Kolkata";

  // Each opening starts fresh.
  useEffect(() => {
    if (!open) return;
    setAudience(EMPTY_AUDIENCE);
    setConsent(false);
    setSchedule(DEFAULT_SCHEDULE);
    setError("");
  }, [open]);

  const [debounced, setDebounced] = useState(audience);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(audience), 400);
    return () => clearTimeout(timer);
  }, [audience]);
  const isReady = hasAudienceSelection(audience);
  const {
    data: preview,
    isFetching,
    isError: isPreviewError
  } = useQuery({
    queryKey: ["drip-audience-preview", drip.id, debounced],
    queryFn: () =>
      previewDripAudience({ dripId: drip.id, audience: debounced }),
    enabled: open && hasAudienceSelection(debounced),
    placeholderData: (previous) => previous
  });
  const shown = isReady ? preview : undefined;
  const warnings = (shown?.warnings || []).map(warningText).filter(Boolean);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      if (mode === "add") {
        return {
          drip: await addDripContacts({ dripId: drip.id, audience }),
          startAt: null as string | null
        };
      }
      return startDrip({
        dripId: drip.id,
        payload: {
          audience,
          consentConfirmed: true,
          ...(schedule.mode === "schedule"
            ? { scheduledLocal: buildScheduledLocal(schedule), timezone }
            : {})
        }
      });
    },
    meta: { showToast: false },
    onSuccess: ({ drip: saved, startAt }) => {
      rememberDrip(queryClient, saved);
      queryClient.invalidateQueries({ queryKey: ["drip-contacts", saved.id] });
      if (mode === "add") {
        toast.success(
          "People are being added. The numbers fill in over a few seconds."
        );
      } else if (schedule.mode === "schedule" && startAt) {
        toast.success(`Drip scheduled. People join ${formatWhen(startAt)}.`);
      } else {
        toast.success(
          "Drip started. People are joining now, so the numbers fill in over a few seconds."
        );
      }
      onOpenChange(false);
      onDone?.(saved);
    },
    onError: (failure) =>
      setError(dripErrorMessage(failure, "That didn't work. Please try again."))
  });

  const problem = !isReady
    ? "Choose who should join."
    : shown && shown.willJoin === 0
      ? "Nobody here can join this drip."
      : mode === "start" && !consent
        ? "Tick the box to confirm these contacts agreed."
        : mode === "start"
          ? scheduleProblem(schedule)
          : "";
  const firstWait = drip.steps[0]?.delayMinutes ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:rounded-none">
        <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 text-left">
          <DialogTitle>
            {mode === "start" ? "Choose who joins" : "Add people to this drip"}
          </DialogTitle>
          <DialogDescription>
            {mode === "start"
              ? `Everyone who joins gets message 1 ${firstWait ? `${describeWait(firstWait)} after joining` : "right away"}, then the rest in order.`
              : "New people start from message 1. Anyone already in this drip is skipped, as nobody goes through a drip twice."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <section className="space-y-3">
            {mode === "start" && (
              <h3 className="text-sm font-semibold">1. Who should join?</h3>
            )}
            <AudiencePicker
              audience={audience}
              onChange={setAudience}
              sources={sources}
              campaignLabel="People from an ad"
              campaignEmptyText="No ads have brought in contacts yet."
            />

            <div className="flex items-start gap-3 rounded-lg border bg-white p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="size-5" />
              </span>
              <div className="min-w-0 space-y-1 text-sm">
                {!isReady ? (
                  <p className="text-muted-foreground">
                    Choose who should join.
                  </p>
                ) : isPreviewError && !shown ? (
                  <p className="text-muted-foreground">
                    The count couldn&apos;t be loaded. You can still continue.
                  </p>
                ) : !shown ? (
                  <p>Counting people…</p>
                ) : (
                  <>
                    <p>
                      <span className="font-heading text-lg font-semibold">
                        {formatCount(shown.willJoin)}
                      </span>{" "}
                      {shown.willJoin === 1 ? "person" : "people"} will join
                      this drip.
                      {isFetching && (
                        <span className="text-muted-foreground">
                          {" "}
                          (updating…)
                        </span>
                      )}
                    </p>
                    {previewLines(shown).map((line) => (
                      <p key={line} className="text-xs text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </>
                )}
              </div>
            </div>

            {warnings.map((warning) => (
              <p
                key={warning}
                className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {warning}
              </p>
            ))}
          </section>

          {mode === "start" && (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">2. Permission</h3>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 text-sm">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(value) => setConsent(value === true)}
                    className="mt-0.5"
                  />
                  <span>
                    These contacts agreed to get messages from us on WhatsApp
                  </span>
                </label>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">3. When to start</h3>
                <ScheduleFields
                  value={schedule}
                  onChange={setSchedule}
                  timezone={timezone}
                  nowLabel="Start now"
                />
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Messages still only go out within the drip&apos;s sending
                  hours.
                </p>
              </section>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{problem}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={Boolean(problem)}
              isLoading={isPending}
              onClick={() => {
                setError("");
                submit();
              }}
            >
              {mode === "add"
                ? "Add people"
                : schedule.mode === "schedule"
                  ? "Schedule drip"
                  : "Start drip"}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
