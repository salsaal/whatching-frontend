import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getSubscriberById,
  updateSubscriber
} from "@/client-api/functions/subscribers";
import {
  OffersStoppedReason,
  Subscriber
} from "@/client-api/types/subscribers.type";
import { Switch } from "@/components/ui/switch";
import { badgeToneClass } from "@/lib/statusPresentation";
import { cn } from "@/lib/utils";

export const OFFERS_STOPPED_REASON_TEXT: Record<OffersStoppedReason, string> = {
  stop_button: "Tapped Stop promotions",
  whatsapp_setting: "Turned off in WhatsApp",
  meta_error: "A message couldn't be delivered because they stopped offers",
  manual: "Marked by you"
};

type OffersState = Pick<Subscriber, "offersStopped" | "offersStoppedReason">;

/**
 * "Stop offers for this contact": offers (marketing templates, drips) stop,
 * order updates and replies still go. Without `initial` (the inbox), the
 * contact is loaded to read the current setting.
 */
export function OffersStoppedControl({
  subscriberId,
  initial,
  className
}: {
  subscriberId: string;
  initial?: OffersState;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["subscriber", subscriberId],
    queryFn: () => getSubscriberById(subscriberId),
    enabled: !initial
  });
  const source = initial || data?.data.subscriber;
  const sourceStopped = source?.offersStopped;
  const sourceReason = source?.offersStoppedReason;
  const hasSource = Boolean(source);
  const [state, setState] = useState<OffersState | undefined>(source);
  // Follows the contact when it reloads, not every parent render (which
  // would undo a change made here before the reload).
  useEffect(() => {
    if (hasSource) {
      setState({
        offersStopped: sourceStopped,
        offersStoppedReason: sourceReason
      });
    }
  }, [hasSource, sourceStopped, sourceReason]);

  const { mutate, isPending } = useMutation({
    mutationFn: (offersStopped: boolean) =>
      updateSubscriber({ subscriberId, payload: { offersStopped } }),
    meta: { showToast: false },
    onSuccess: (response) => {
      const subscriber = response.data.subscriber;
      setState({
        offersStopped: subscriber.offersStopped,
        offersStoppedReason: subscriber.offersStoppedReason
      });
      queryClient.setQueryData(["subscriber", subscriberId], response);
      queryClient.invalidateQueries({ queryKey: ["subscribers"] });
      toast.success(
        subscriber.offersStopped
          ? "Offers stopped for this contact."
          : "This contact can get offers again."
      );
    },
    onError: (error) =>
      toast.error(
        (error as AxiosError<{ message?: string }>).response?.data?.message ||
          "The setting couldn't be saved. Please try again."
      )
  });

  if (!state) return null;
  const stopped = Boolean(state.offersStopped);
  const reason = state.offersStoppedReason
    ? OFFERS_STOPPED_REASON_TEXT[state.offersStoppedReason]
    : "";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-sm border p-3",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          Stop offers for this contact
          {stopped && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                badgeToneClass.amber
              )}
            >
              Stopped offers
            </span>
          )}
        </p>
        {stopped && reason && (
          <p className="text-xs text-foreground/80">{reason}</p>
        )}
        <p className="text-xs text-muted-foreground">
          They&apos;ll still get order updates and replies.
        </p>
      </div>
      <Switch
        aria-label="Stop offers for this contact"
        checked={stopped}
        disabled={isPending}
        onCheckedChange={(checked) => mutate(checked)}
      />
    </div>
  );
}
