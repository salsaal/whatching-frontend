"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  archiveDrip,
  deleteDrip,
  getDrip,
  getDripReport,
  pauseDrip,
  resumeDrip
} from "@/client-api/functions/drips";
import { Drip, DripContactStatus } from "@/client-api/types/drips.type";
import { PermissionGate } from "@/components/common/NoAccess";
import { ConfirmDialog } from "@/components/drips/ConfirmDialog";
import { DripAudienceDialog } from "@/components/drips/DripAudienceDialog";
import { DripBuilder } from "@/components/drips/DripBuilder";
import { rememberDrip } from "@/components/drips/dripCache";
import { DripPeople } from "@/components/drips/DripPeople";
import { DripResults } from "@/components/drips/DripResults";
import { DripStatusBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useWhatsAppNumberContext } from "@/components/whatsapp/WhatsAppNumberSwitcher";
import AppLayout from "@/layouts/AppLayout";
import { formatDate } from "@/lib/displayFormat";
import { dripErrorMessage } from "@/lib/drips";
import { cn } from "@/lib/utils";

type Tab = "results" | "people" | "messages";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "results", label: "Results" },
  { value: "people", label: "People" },
  { value: "messages", label: "Messages & settings" }
];

function DripDetailContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dripId =
    typeof router.query.dripId === "string" ? router.query.dripId : "";
  const { numbers } = useWhatsAppNumberContext();

  const [tab, setTab] = useState<Tab>("results");
  const [peopleStatus, setPeopleStatus] = useState<DripContactStatus>("active");
  const [peopleReason, setPeopleReason] = useState("");
  const [audienceMode, setAudienceMode] = useState<"start" | "add" | null>(
    null
  );
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const {
    data: drip,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["drip", dripId],
    queryFn: () => getDrip(dripId),
    enabled: Boolean(dripId),
    refetchOnMount: "always"
  });
  const isDraft = drip?.status === "draft";

  const { data: report } = useQuery({
    queryKey: ["drip-report", dripId],
    queryFn: () => getDripReport(dripId),
    enabled: Boolean(dripId) && Boolean(drip) && !isDraft,
    refetchInterval: drip?.status === "active" ? 10_000 : false
  });
  // The report carries the freshest totals and status.
  const current: Drip | undefined = report?.drip || drip;

  // Coming from "New drip" with "Next: choose who joins".
  useEffect(() => {
    if (router.query.start === "1" && drip?.status === "draft") {
      setAudienceMode("start");
      router.replace(`/drips/${dripId}`, undefined, { shallow: true });
    }
  }, [drip?.status, dripId, router]);

  const action = useMutation({
    mutationFn: async (kind: "pause" | "resume" | "archive" | "delete") => {
      if (kind === "delete") {
        await deleteDrip(dripId);
        return { kind, saved: null };
      }
      const run = {
        pause: pauseDrip,
        resume: resumeDrip,
        archive: archiveDrip
      };
      return { kind, saved: await run[kind](dripId) };
    },
    meta: { showToast: false },
    onSuccess: ({ kind, saved }) => {
      setConfirm(null);
      if (kind === "delete") {
        toast.success("Draft deleted.");
        queryClient.invalidateQueries({ queryKey: ["drips"] });
        router.push("/drips");
        return;
      }
      if (saved) rememberDrip(queryClient, saved);
      toast.success(
        kind === "pause"
          ? "Drip paused. Nobody gets messages until you resume it."
          : kind === "resume"
            ? "Drip resumed."
            : "Drip archived."
      );
    },
    onError: (failure) =>
      toast.error(
        dripErrorMessage(failure, "That didn't work. Please try again.")
      )
  });

  const showPeople = (status: DripContactStatus, reason = "") => {
    setPeopleStatus(status);
    setPeopleReason(reason);
    setTab("people");
  };

  const senderLabel = current
    ? numbers.find((item) => item.phoneNumberId === current.phoneNumberId)
        ?.displayPhoneNumber || ""
    : "";
  const notFound =
    (error as { response?: { status?: number } } | null)?.response?.status ===
    404;

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5">
        <Link
          href="/drips"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Drip campaigns
        </Link>

        {isError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center">
            <ShieldAlert className="size-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">
              {dripErrorMessage(error, "This drip couldn't be loaded.")}
            </p>
            {!notFound && (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
            )}
          </div>
        ) : isLoading || !current ? (
          <>
            <Skeleton className="h-28 rounded-lg" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </>
        ) : (
          <>
            <section className="rounded-lg bg-white p-5 shadow-xs">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate font-heading text-2xl font-semibold">
                      {current.name}
                    </h1>
                    <DripStatusBadge status={current.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isDraft
                      ? "Not started yet. Nothing is sent until you start it."
                      : [
                          `${current.steps.length} messages`,
                          senderLabel && `from ${senderLabel}`,
                          current.activatedAt &&
                            `started ${formatDate(current.activatedAt)}`
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isDraft && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirm("delete")}
                    >
                      <Trash2 className="size-4" />
                      Delete draft
                    </Button>
                  )}
                  {current.status === "active" && (
                    <>
                      <Button
                        variant="outline"
                        isLoading={
                          action.isPending && action.variables === "pause"
                        }
                        onClick={() => action.mutate("pause")}
                      >
                        <PauseCircle className="size-4" />
                        Pause
                      </Button>
                      <Button onClick={() => setAudienceMode("add")}>
                        <UserPlus className="size-4" />
                        Add people
                      </Button>
                    </>
                  )}
                  {current.status === "paused" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setAudienceMode("add")}
                      >
                        <UserPlus className="size-4" />
                        Add people
                      </Button>
                      <Button
                        isLoading={
                          action.isPending && action.variables === "resume"
                        }
                        onClick={() => action.mutate("resume")}
                      >
                        <PlayCircle className="size-4" />
                        Resume
                      </Button>
                    </>
                  )}
                  {(current.status === "active" ||
                    current.status === "paused") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="More actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setConfirm("archive")}
                        >
                          <Archive className="size-4" />
                          Archive drip
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {current.status === "paused" && (
                <div className="mt-4 flex flex-col gap-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950 sm:flex-row sm:items-center">
                  <PauseCircle className="size-4 shrink-0 text-orange-600" />
                  <p className="flex-1">
                    {current.pausedReasonText || "This drip is paused."} Nobody
                    gets messages while it&apos;s paused.
                  </p>
                  <Button
                    size="sm"
                    isLoading={
                      action.isPending && action.variables === "resume"
                    }
                    onClick={() => action.mutate("resume")}
                  >
                    Resume
                  </Button>
                </div>
              )}
              {current.status === "archived" && (
                <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  This drip is archived. Nobody gets messages from it any more,
                  and it can&apos;t be changed.
                </p>
              )}
            </section>

            {isDraft ? (
              <DripBuilder
                key={current.id}
                drip={current}
                onSaved={(saved, intent) => {
                  if (intent === "next") setAudienceMode("start");
                }}
              />
            ) : (
              <>
                <nav
                  aria-label="Drip sections"
                  className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1.5 shadow-xs"
                >
                  {TABS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      aria-current={tab === item.value ? "page" : undefined}
                      onClick={() => setTab(item.value)}
                      className={cn(
                        "shrink-0 cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition",
                        tab === item.value
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>

                {tab === "results" &&
                  (report ? (
                    <DripResults report={report} onShowPeople={showPeople} />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-lg" />
                      ))}
                    </div>
                  ))}
                {tab === "people" && (
                  <DripPeople
                    drip={current}
                    status={peopleStatus}
                    stopReason={peopleReason}
                    stopReasons={report?.stopReasons || []}
                    onFilterChange={(status, reason) => {
                      setPeopleStatus(status);
                      setPeopleReason(reason);
                    }}
                  />
                )}
                {tab === "messages" && (
                  <DripBuilder
                    key={`${current.id}-${current.status}`}
                    drip={current}
                    onSaved={() => undefined}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {current && audienceMode && (
        <DripAudienceDialog
          drip={current}
          mode={audienceMode}
          open={Boolean(audienceMode)}
          onOpenChange={(open) => !open && setAudienceMode(null)}
          onDone={() => {
            setTab("results");
            refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Archive this drip?"
        body="Everyone still in progress stops getting messages. You can still see the results, but the drip can't be started again. This can't be undone."
        action="Archive drip"
        isPending={action.isPending}
        onConfirm={() => action.mutate("archive")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this draft?"
        body="Nothing has been sent from it. This can't be undone."
        action="Delete draft"
        isPending={action.isPending}
        onConfirm={() => action.mutate("delete")}
      />
    </AppLayout>
  );
}

export default function DripDetailPage() {
  return (
    <PermissionGate permission="broadcasts:manage" feature="Drip campaigns">
      <DripDetailContent />
    </PermissionGate>
  );
}
