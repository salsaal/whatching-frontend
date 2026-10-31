"use client";

import {
  Copy,
  CreditCard,
  ExternalLink,
  Megaphone,
  MoreHorizontal,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import {
  getAllBroadcasts,
  getBroadcastById
} from "@/client-api/functions/broadcasts";
import {
  getWhatsAppOutboundReadiness,
  testWhatsAppOutboundReadiness
} from "@/client-api/functions/organizations";
import { getAllTemplates } from "@/client-api/functions/templates";
import { Broadcast } from "@/client-api/types/broadcasts.type";
import {
  broadcastActionsFor,
  BroadcastProgress,
  broadcastSenderLabel,
  CancelBroadcastDialog,
  retryingPillClass,
  StartBroadcastDialog,
  useAutoConsentRetry
} from "@/components/broadcasts/BroadcastActions";
import { CreateBroadcastWizard } from "@/components/broadcasts/CreateBroadcastWizard";
import { PermissionGate } from "@/components/common/NoAccess";
import {
  BroadcastStatusBadge,
  TemplateCategoryBadge
} from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALL_WHATSAPP_NUMBERS,
  useWhatsAppNumberContext
} from "@/components/whatsapp/WhatsAppNumberSwitcher";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import { formatRelative, formatWhen } from "@/lib/displayFormat";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

const PAGE_SIZE = 30;

// Every tab filters on the server; the backend takes a comma-separated
// list for tabs that span several statuses.
const statusTabs: Array<{ value: string; label: string; server?: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts", server: "draft" },
  { value: "scheduled", label: "Scheduled", server: "scheduled" },
  // A broadcast paused at the messaging limit is still mid-send.
  {
    value: "sending",
    label: "Sending",
    server: "in_progress,processing,paused_limit"
  },
  { value: "completed", label: "Completed", server: "completed" },
  { value: "ended", label: "Failed/Canceled", server: "failed,canceled" }
];

const whenText = (broadcast: Broadcast) => {
  switch (broadcast.status) {
    case "draft":
      return `Created ${formatRelative(broadcast.createdAt)}`;
    case "scheduled":
      return broadcast.scheduledAt
        ? `Sends ${formatRelative(broadcast.scheduledAt)}`
        : "Scheduled";
    case "completed":
    case "failed":
    case "canceled":
      return broadcast.completedAt
        ? `Finished ${formatRelative(broadcast.completedAt)}`
        : `Created ${formatRelative(broadcast.createdAt)}`;
    default:
      return broadcast.startedAt
        ? `Started ${formatRelative(broadcast.startedAt)}`
        : `Created ${formatRelative(broadcast.createdAt)}`;
  }
};

function BroadcastsPageContent() {
  const router = useRouter();
  const { can } = useCurrentMembership();
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const orgId = activeOrganization?._id;
  const {
    selectedPhoneNumberId,
    selectedNumber,
    effectiveNumber,
    setSelectedPhoneNumberId
  } = useWhatsAppNumberContext();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [tab, setTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [startTarget, setStartTarget] = useState<Broadcast | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Broadcast | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---------- outbound readiness (unchanged rules) ----------
  const paymentMethodUrl =
    activeOrganization?.messagingBilling?.paymentSetupUrl || null;
  const senderRecordId = effectiveNumber?._id || effectiveNumber?.id || "";
  const {
    data: readinessData,
    isLoading: isReadinessLoading,
    refetch: refetchReadiness
  } = useQuery({
    queryKey: ["whatsapp-outbound-readiness", senderRecordId],
    queryFn: () => getWhatsAppOutboundReadiness(senderRecordId),
    enabled: Boolean(senderRecordId) && can("whatsapp_numbers:view"),
    // Only poll while a test is actually in flight waiting on Meta's
    // delivery webhook -- see pages/overview.tsx for the same fix and why.
    refetchInterval: (state) => {
      const status = state.state.data?.data.readiness?.status;
      return status === "testing" || status === "template_pending"
        ? 4000
        : false;
    },
    refetchOnWindowFocus: true
  });
  const readiness = readinessData?.data.readiness;
  const canCreateBroadcast =
    readinessData?.data.canStartBroadcast === true ||
    readiness?.status === "ready";
  const { mutate: runReadinessTest, isPending: isTestingReadiness } =
    useMutation({
      mutationFn: () => testWhatsAppOutboundReadiness(senderRecordId),
      meta: { showToast: false },
      onSuccess: async (response) => {
        toast.success(
          response.message ||
            "Broadcast verification started. Waiting for Meta's delivery status."
        );
        await refetchReadiness();
      },
      onError: (error: AxiosError<{ message?: string }>) =>
        toast.error(
          error.response?.data?.message ||
            "Broadcast verification could not be started."
        )
    });

  // ---------- templates (for the "no approved template yet" nudge) ----------
  const { data: templatesData } = useQuery({
    queryKey: ["templates", orgId],
    queryFn: getAllTemplates,
    enabled: Boolean(orgId) && can("templates:view")
  });
  const hasApprovedTemplate = (templatesData?.data.templates || []).some(
    (template) => template.status.toUpperCase() === "APPROVED"
  );

  // ---------- list ----------
  const activeTab =
    statusTabs.find((item) => item.value === tab) || statusTabs[0];
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage
  } = useInfiniteQuery({
    queryKey: [
      "broadcasts",
      selectedPhoneNumberId,
      query,
      activeTab.server || ""
    ],
    queryFn: ({ pageParam }) =>
      getAllBroadcasts({
        page: pageParam,
        limit: PAGE_SIZE,
        ...(query ? { q: query } : {}),
        ...(activeTab.server ? { status: activeTab.server } : {}),
        ...(selectedPhoneNumberId !== ALL_WHATSAPP_NUMBERS
          ? { phoneNumberId: selectedPhoneNumberId }
          : {})
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    refetchOnMount: "always",
    refetchInterval: 5000
  });
  const broadcasts = useMemo(() => {
    const unique = new Map<string, Broadcast>();
    data?.pages
      .flatMap((page) => page.data.broadcasts || [])
      .forEach((broadcast) => unique.set(broadcast._id, broadcast));
    return Array.from(unique.values());
  }, [data?.pages]);
  const { consent, isConsenting } = useAutoConsentRetry(broadcasts);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // ---------- wizard (deep links: ?new=1&templateId=…, ?duplicate=…) ----------
  const duplicateId =
    typeof router.query.duplicate === "string" ? router.query.duplicate : "";
  const linkedTemplateId =
    typeof router.query.templateId === "string" ? router.query.templateId : "";
  const wantsNew = router.query.new === "1";
  const { data: duplicateData, isLoading: isDuplicateLoading } = useQuery({
    queryKey: ["broadcast-duplicate-source", duplicateId],
    queryFn: () => getBroadcastById(duplicateId, { limit: 1 }),
    enabled: Boolean(duplicateId)
  });
  useEffect(() => {
    if (
      (wantsNew || (duplicateId && !isDuplicateLoading)) &&
      canCreateBroadcast
    ) {
      setWizardKey((key) => key + 1);
      setIsWizardOpen(true);
    }
  }, [canCreateBroadcast, duplicateId, isDuplicateLoading, wantsNew]);

  const closeWizard = (open: boolean) => {
    setIsWizardOpen(open);
    if (!open && (wantsNew || duplicateId)) {
      router.replace("/broadcasts", undefined, { shallow: true });
    }
  };
  const openWizard = () => {
    setWizardKey((key) => key + 1);
    setIsWizardOpen(true);
  };

  const errorText =
    (error as AxiosError<{ message?: string }> | null)?.response?.data
      ?.message || "Broadcasts couldn't be loaded.";

  const renderActions = (broadcast: Broadcast) => {
    const actions = broadcastActionsFor(broadcast);
    const stop = (event: React.MouseEvent) => event.stopPropagation();
    return (
      <div className="flex items-center justify-end gap-1" onClick={stop}>
        {actions.canStart && (
          <Button size="sm" onClick={() => setStartTarget(broadcast)}>
            <PlayCircle className="size-4" />
            Start or schedule
          </Button>
        )}
        {actions.needsRetryConsent && (
          <Button
            size="sm"
            variant="outline"
            disabled={isConsenting}
            onClick={() => consent(broadcast._id)}
          >
            <RotateCcw className="size-4" />
            Retry
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Broadcast actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/broadcasts/${broadcast._id}`}>View</Link>
            </DropdownMenuItem>
            {actions.canDuplicate && (
              <DropdownMenuItem
                onSelect={() =>
                  router.push(
                    `/broadcasts?duplicate=${broadcast._id}`,
                    undefined,
                    {
                      shallow: true
                    }
                  )
                }
              >
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
            )}
            {actions.canDiscard && (
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setCancelTarget(broadcast)}
              >
                <XCircle className="size-4" />
                Discard
              </DropdownMenuItem>
            )}
            {actions.canCancelSchedule && (
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setCancelTarget(broadcast)}
              >
                <XCircle className="size-4" />
                Cancel schedule
              </DropdownMenuItem>
            )}
            {actions.canCancel && (
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setCancelTarget(broadcast)}
              >
                <XCircle className="size-4" />
                Cancel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const newBroadcastButton = !canCreateBroadcast ? null : hasApprovedTemplate ||
    !can("templates:view") ? (
    <Button onClick={openWizard}>
      <Plus className="size-4" />
      New broadcast
    </Button>
  ) : (
    <Popover>
      <PopoverTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New broadcast
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 text-sm">
        <p>You need an approved template first.</p>
        <Button asChild size="sm" className="w-full">
          <Link href="/templates/create">Create template</Link>
        </Button>
      </PopoverContent>
    </Popover>
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5 pb-20 sm:pb-0">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold">Broadcasts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send an approved template to many contacts at once.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {paymentMethodUrl ? (
              <Button variant="outline" className="whitespace-nowrap" asChild>
                <a
                  href={paymentMethodUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {readiness?.status === "ready" ? (
                    <>
                      <ExternalLink className="size-4" />
                      View Meta billing
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-4" />
                      Add payment method
                    </>
                  )}
                </a>
              </Button>
            ) : null}
            <div className="hidden sm:block">{newBroadcastButton}</div>
          </div>
        </section>

        {!canCreateBroadcast && senderRecordId && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-amber-950">
                  {isReadinessLoading
                    ? "Checking broadcast setup"
                    : readiness?.status === "testing"
                      ? "Broadcast verification pending"
                      : readiness?.status === "template_pending"
                        ? "Verification template awaiting approval"
                        : "Complete broadcast setup"}
                </p>
                <p className="mt-1 max-w-3xl text-sm text-amber-900/80">
                  {readinessData?.data.blocker?.message ||
                    readiness?.failureMessage ||
                    "We send a one-time test template to verify that this sender can start paid business messages. The test costs approximately Rs. 0.115."}
                </p>
              </div>
              {readiness?.status !== "testing" && (
                <Button
                  disabled={isTestingReadiness}
                  onClick={() => runReadinessTest()}
                >
                  <RotateCcw
                    className={cn(
                      "size-4",
                      isTestingReadiness && "animate-spin"
                    )}
                  />
                  {readiness?.status === "template_pending"
                    ? "Check approval and continue"
                    : "Run verification"}
                </Button>
              )}
            </div>
          </section>
        )}

        <section className="space-y-3 rounded-lg bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name"
                aria-label="Search broadcasts by name"
                className="h-10 pl-9"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
              {statusTabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition",
                    tab === item.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {selectedPhoneNumberId !== ALL_WHATSAPP_NUMBERS && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium lg:ml-auto">
                From{" "}
                {selectedNumber?.displayPhoneNumber || selectedPhoneNumberId}
                <button
                  type="button"
                  aria-label="Show broadcasts from every number"
                  className="cursor-pointer rounded-full p-0.5 hover:bg-white"
                  onClick={() => setSelectedPhoneNumberId(ALL_WHATSAPP_NUMBERS)}
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
          </div>
        </section>

        {isError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center">
            <ShieldAlert className="size-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{errorText}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <section className="rounded-lg bg-white shadow-xs">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14" />
                ))}
              </div>
            ) : broadcasts.length ? (
              <>
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Broadcast</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium">Sender</th>
                        <th className="px-4 py-3 font-medium">When</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {broadcasts.map((broadcast) => (
                        <tr
                          key={broadcast._id}
                          onClick={() =>
                            router.push(`/broadcasts/${broadcast._id}`)
                          }
                          className="cursor-pointer border-b transition last:border-0 hover:bg-muted/40"
                        >
                          <td className="max-w-72 px-4 py-3">
                            <p className="truncate font-medium">
                              {broadcast.name}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="truncate">
                                {broadcast.template?.name}
                              </span>
                              <TemplateCategoryBadge
                                category={broadcast.template?.category}
                              />
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <BroadcastStatusBadge
                                status={broadcast.status}
                                scheduledAt={broadcast.scheduledAt}
                              />
                              {(broadcast.stats?.deferredRecipients || 0) >
                                0 && (
                                <span className={retryingPillClass}>
                                  Retrying
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <BroadcastProgress broadcast={broadcast} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {broadcastSenderLabel(broadcast) || "-"}
                          </td>
                          <td
                            className="px-4 py-3 text-xs text-muted-foreground"
                            title={formatWhen(
                              broadcast.scheduledAt ||
                                broadcast.startedAt ||
                                broadcast.createdAt
                            )}
                          >
                            {whenText(broadcast)}
                          </td>
                          <td className="px-4 py-3">
                            {renderActions(broadcast)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y md:hidden">
                  {broadcasts.map((broadcast) => (
                    <li
                      key={broadcast._id}
                      onClick={() =>
                        router.push(`/broadcasts/${broadcast._id}`)
                      }
                      className="cursor-pointer space-y-2 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {broadcast.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {broadcast.template?.name} · {whenText(broadcast)}
                          </p>
                        </div>
                        <BroadcastStatusBadge
                          status={broadcast.status}
                          scheduledAt={broadcast.scheduledAt}
                        />
                      </div>
                      <BroadcastProgress broadcast={broadcast} />
                      {renderActions(broadcast)}
                    </li>
                  ))}
                </ul>
                <div ref={loadMoreRef} className="h-px" />
                {isFetchingNextPage && (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-12" />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Megaphone className="size-6" />
                </span>
                <p className="text-sm text-muted-foreground">
                  {query || tab !== "all"
                    ? "No broadcasts match these filters."
                    : "No broadcasts yet. Reach many contacts with one approved template."}
                </p>
                {!query && tab === "all" && newBroadcastButton}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Mobile: the primary action sits in a sticky bottom bar. */}
      {newBroadcastButton && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-3 sm:hidden [&_button]:w-full">
          {newBroadcastButton}
        </div>
      )}

      {isWizardOpen && (
        <CreateBroadcastWizard
          key={wizardKey}
          open={isWizardOpen}
          onOpenChange={closeWizard}
          initialTemplateId={linkedTemplateId || undefined}
          duplicateFrom={duplicateId ? duplicateData?.data.broadcast : null}
          onCreated={(broadcastId) => {
            setIsWizardOpen(false);
            router.push(`/broadcasts/${broadcastId}`);
          }}
        />
      )}
      <StartBroadcastDialog
        broadcast={startTarget}
        open={Boolean(startTarget)}
        onOpenChange={(open) => !open && setStartTarget(null)}
        onStarted={() => {
          if (startTarget) router.push(`/broadcasts/${startTarget._id}`);
        }}
      />
      <CancelBroadcastDialog
        broadcast={cancelTarget}
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      />
    </AppLayout>
  );
}

export default function BroadcastsPage() {
  return (
    <PermissionGate permission="broadcasts:manage" feature="Broadcasts">
      <BroadcastsPageContent />
    </PermissionGate>
  );
}
