import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ShieldAlert, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  listDripContacts,
  removeDripContact
} from "@/client-api/functions/drips";
import {
  Drip,
  DripContactRow,
  DripContactStatus,
  DripStopReasonCount
} from "@/client-api/types/drips.type";
import { ConfirmDialog } from "@/components/drips/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatWhen } from "@/lib/displayFormat";
import { DRIP_WAITING_TEXT, dripErrorMessage } from "@/lib/drips";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const ALL_REASONS = "__all__";

const STATUS_TABS: Array<{ value: DripContactStatus; label: string }> = [
  { value: "active", label: "In progress" },
  { value: "completed", label: "Finished" },
  { value: "stopped", label: "Left early" }
];

const contactLabel = (row: DripContactRow) =>
  row.contact?.name || row.contact?.phone || "Deleted contact";

/** The people in a drip: who's in progress, finished or left early. */
export function DripPeople({
  drip,
  status,
  stopReason,
  stopReasons,
  onFilterChange
}: {
  drip: Drip;
  status: DripContactStatus;
  stopReason: string;
  stopReasons: DripStopReasonCount[];
  onFilterChange: (status: DripContactStatus, stopReason: string) => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [removeTarget, setRemoveTarget] = useState<DripContactRow | null>(null);
  const stepCount = drip.steps.length;
  const canRemove = drip.status !== "archived";

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["drip-contacts", drip.id, status, stopReason, page],
    queryFn: () =>
      listDripContacts(drip.id, {
        status,
        ...(status === "stopped" && stopReason ? { stopReason } : {}),
        page,
        limit: PAGE_SIZE
      }),
    placeholderData: keepPreviousData,
    refetchInterval: drip.status === "active" ? 15_000 : false
  });
  const rows = data?.contacts || [];
  const pagination = data?.pagination;

  const { mutate: remove, isPending: isRemoving } = useMutation({
    mutationFn: removeDripContact,
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Removed from this drip.");
      queryClient.invalidateQueries({ queryKey: ["drip-contacts", drip.id] });
      queryClient.invalidateQueries({ queryKey: ["drip-report", drip.id] });
      setRemoveTarget(null);
    },
    onError: (failure) =>
      toast.error(
        dripErrorMessage(failure, "They couldn't be removed. Please try again.")
      )
  });

  const changeFilter = (nextStatus: DripContactStatus, nextReason = "") => {
    setPage(1);
    onFilterChange(nextStatus, nextReason);
  };

  const detail = (row: DripContactRow) => {
    if (row.status === "active") {
      return (
        <>
          <span>
            {row.nextStep && row.nextStep <= stepCount
              ? `Next: message ${row.nextStep}`
              : "Next message"}
            {row.nextRunAt && ` · ${formatWhen(row.nextRunAt)}`}
          </span>
          {row.waitingReason && DRIP_WAITING_TEXT[row.waitingReason] && (
            <span className="mt-1 block w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {DRIP_WAITING_TEXT[row.waitingReason]}
            </span>
          )}
        </>
      );
    }
    if (row.status === "completed") {
      return `Finished ${formatWhen(row.completedAt)}`;
    }
    return (
      <>
        <span className="block">{row.stopReasonText || "Left the drip"}</span>
        {row.stoppedAt && (
          <span className="text-[11px]">{formatWhen(row.stoppedAt)}</span>
        )}
      </>
    );
  };

  return (
    <section className="rounded-lg bg-white shadow-xs">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeFilter(tab.value)}
              className={cn(
                "shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition",
                status === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {status === "stopped" && stopReasons.length > 0 && (
          <Select
            value={stopReason || ALL_REASONS}
            onValueChange={(value) =>
              changeFilter("stopped", value === ALL_REASONS ? "" : value)
            }
          >
            <SelectTrigger className="h-9 w-full bg-white sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_REASONS}>Every reason</SelectItem>
              {stopReasons.map((reason) => (
                <SelectItem key={reason.reason} value={reason.reason}>
                  {reason.text || "Other reason"} ({formatCount(reason.count)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <ShieldAlert className="size-5 shrink-0 text-destructive" />
          <p className="flex-1 text-sm text-destructive">
            The list couldn&apos;t be loaded.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            {status === "active"
              ? "Nobody is in progress right now."
              : status === "completed"
                ? "Nobody has finished yet."
                : "Nobody has left early."}
          </p>
        </div>
      ) : (
        <ul className={cn("divide-y", isFetching && "opacity-70")}>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 sm:w-56">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span className="truncate">{contactLabel(row)}</span>
                  {row.round > 1 && (
                    <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                      Joined again
                    </span>
                  )}
                </p>
                {row.contact?.name && row.contact.phone && (
                  <p className="truncate text-xs text-muted-foreground">
                    {row.contact.phone}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground sm:w-36">
                {row.stepsSent} of {stepCount} sent
              </p>
              <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                {detail(row)}
              </div>
              {row.status === "active" && canRemove && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setRemoveTarget(row)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.pages} ·{" "}
            {formatCount(pagination.total)} people
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget ? contactLabel(removeTarget) : "them"} from this drip?`}
        body="They won't get the rest of the messages, and they can't join this drip again."
        action="Remove"
        isPending={isRemoving}
        onConfirm={() =>
          removeTarget &&
          remove({ dripId: drip.id, contactRowId: removeTarget.id })
        }
      />
    </section>
  );
}
