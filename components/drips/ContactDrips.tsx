import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import {
  listContactDrips,
  removeDripContact
} from "@/client-api/functions/drips";
import { ContactDripRow } from "@/client-api/types/drips.type";
import { ConfirmDialog } from "@/components/drips/ConfirmDialog";
import { Separator } from "@/components/ui/separator";
import { formatWhen } from "@/lib/displayFormat";
import { dripErrorMessage } from "@/lib/drips";

const FINISHED_SHOWN = 3;

const endedTime = (row: ContactDripRow) =>
  Date.parse(row.endedAt || row.enrolledAt || "") || 0;

/**
 * The inbox contact panel's "Drips": the drips they're in now (with
 * Remove), then the last few they finished or left. Hidden when there are
 * none.
 */
export function ContactDrips({ subscriberId }: { subscriberId: string }) {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<ContactDripRow | null>(null);
  const { data } = useQuery({
    queryKey: ["contact-drips", subscriberId],
    queryFn: () => listContactDrips(subscriberId)
  });
  const rows = data || [];
  const inProgress = rows.filter((row) => row.status === "active");
  const ended = rows
    .filter((row) => row.status !== "active")
    .sort((a, b) => endedTime(b) - endedTime(a))
    .slice(0, FINISHED_SHOWN);

  const { mutate: remove, isPending } = useMutation({
    mutationFn: (row: ContactDripRow) =>
      removeDripContact({ dripId: row.drip.id, contactRowId: row.id }),
    meta: { showToast: false },
    onSuccess: (_, row) => {
      toast.success(`Removed from “${row.drip.name}”.`);
      queryClient.invalidateQueries({
        queryKey: ["contact-drips", subscriberId]
      });
      queryClient.invalidateQueries({
        queryKey: ["drip-contacts", row.drip.id]
      });
      queryClient.invalidateQueries({ queryKey: ["drip-report", row.drip.id] });
      setRemoveTarget(null);
    },
    onError: (failure) =>
      toast.error(
        dripErrorMessage(failure, "They couldn't be removed. Please try again.")
      )
  });

  if (!inProgress.length && !ended.length) return null;

  const dripLink = (row: ContactDripRow) => (
    <Link
      href={`/drips/${row.drip.id}`}
      className="font-medium text-foreground hover:underline"
    >
      {row.drip.name}
    </Link>
  );

  return (
    <>
      <Separator className="my-4" />
      <div>
        <p className="mb-2 text-sm font-semibold">Drips</p>
        <ul className="space-y-1.5 text-sm">
          {inProgress.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-muted-foreground">
                {dripLink(row)}:{" "}
                {row.nextRunAt
                  ? `next message ${formatWhen(row.nextRunAt)}`
                  : "in progress"}
              </span>
              <button
                type="button"
                className="shrink-0 cursor-pointer text-xs font-medium text-destructive hover:underline"
                onClick={() => setRemoveTarget(row)}
              >
                Remove
              </button>
            </li>
          ))}
          {ended.map((row) => (
            <li key={row.id} className="text-muted-foreground">
              {dripLink(row)}:{" "}
              {row.status === "completed"
                ? "finished"
                : `left early: ${row.stopReasonText || "left the drip"}`}
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove from “${removeTarget?.drip.name || "this drip"}”?`}
        body="They won't get the rest of the messages from this drip."
        action="Remove"
        isPending={isPending}
        onConfirm={() => removeTarget && remove(removeTarget)}
      />
    </>
  );
}
