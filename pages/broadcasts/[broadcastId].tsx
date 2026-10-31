"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Copy,
  Eye,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Users,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { getBroadcastById } from "@/client-api/functions/broadcasts";
import { getTemplateById } from "@/client-api/functions/templates";
import {
  BroadcastFailureReason,
  BroadcastRecipient
} from "@/client-api/types/broadcasts.type";
import {
  broadcastActionsFor,
  broadcastSenderLabel,
  CancelBroadcastDialog,
  EstimatedAudience,
  StartBroadcastDialog,
  useAutoConsentRetry
} from "@/components/broadcasts/BroadcastActions";
import { PermissionGate } from "@/components/common/NoAccess";
import { BroadcastStatusBadge } from "@/components/shared/StatusBadges";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { WhatsAppPreview } from "@/components/whatsapp/WhatsAppPreview";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import { describeAudience } from "@/lib/broadcastAudience";
import { computeBroadcastFunnel } from "@/lib/broadcastFunnel";
import {
  formatCount,
  formatCountdown,
  formatPercent,
  formatRelative,
  formatWhen
} from "@/lib/displayFormat";
import {
  describeRecipientOutcome,
  outcomeToneClass
} from "@/lib/recipientOutcome";
import {
  isBroadcastFinished,
  isBroadcastSending,
  templateCategoryPresentation
} from "@/lib/statusPresentation";
import {
  getTemplateVariableSlots,
  mappingsFromComponents,
  resolvePreviewValues
} from "@/lib/templateVariables";
import { cn } from "@/lib/utils";

const RECIPIENTS_PAGE_SIZE = 50;

const recipientFilters = [
  { value: "", label: "All" },
  { value: "read", label: "Read" },
  { value: "delivered", label: "Delivered" },
  { value: "sent", label: "Sent" },
  { value: "deferred", label: "Waiting to retry" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" }
] as const;

const recipientName = (recipient: BroadcastRecipient) =>
  [recipient.subscriberId?.firstName, recipient.subscriberId?.lastName]
    .filter(Boolean)
    .join(" ") || recipient.phoneNumber;

const recipientError = (recipient: BroadcastRecipient) => ({
  errorCode: recipient.errorCode || recipient.messageId?.errorCode,
  errorMessage: recipient.errorMessage || recipient.messageId?.errorMessage
});

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default"
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: "default" | "red" | "amber";
}) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon
          className={cn(
            "size-4",
            tone === "red"
              ? "text-red-500"
              : tone === "amber"
                ? "text-amber-500"
                : "text-primary"
          )}
        />
      </div>
      <p className="mt-2 font-heading text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function FunnelBar({
  label,
  value,
  total,
  className
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {formatCount(value)} · {formatPercent(value, total)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", className)}
          style={{ width: total ? `${(value / total) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function ReasonRow({
  reason,
  onSelect
}: {
  reason: BroadcastFailureReason;
  onSelect: () => void;
}) {
  const outcome = describeRecipientOutcome({
    status: reason.status,
    errorCode: reason.errorCode,
    errorMessage: reason.sampleMessage
  });
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 text-left transition hover:bg-muted/60"
    >
      <span className="w-12 shrink-0 text-right font-heading text-lg font-semibold">
        {formatCount(reason.count)}
      </span>
      <span className="min-w-0 text-sm">
        <span className="font-medium">{outcome.label}</span>
        {outcome.explanation && (
          <span className="text-muted-foreground">
            {" "}
            — {outcome.explanation}
          </span>
        )}
        {reason.status === "deferred" && reason.errorCode === "131049" && (
          <span className="text-amber-700"> (retry scheduled)</span>
        )}
      </span>
    </button>
  );
}

function BroadcastDetailsPageContent() {
  const router = useRouter();
  const { can } = useCurrentMembership();
  const broadcastId =
    typeof router.query.broadcastId === "string"
      ? router.query.broadcastId
      : "";
  const [recipientStatus, setRecipientStatus] = useState("");
  const [search, setSearch] = useState("");
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const recipientsRef = useRef<HTMLDivElement | null>(null);
  const [, setTick] = useState(0);

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
    queryKey: ["broadcast-detail", broadcastId, recipientStatus],
    queryFn: ({ pageParam }) =>
      getBroadcastById(broadcastId, {
        page: pageParam,
        limit: RECIPIENTS_PAGE_SIZE,
        ...(recipientStatus ? { recipientStatus } : {})
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.recipientsPagination;
      return pagination && pagination.page < pagination.totalPages
        ? pagination.page + 1
        : undefined;
    },
    enabled: Boolean(broadcastId),
    refetchOnMount: "always",
    // Live while sending; quiet once it settles.
    refetchInterval: (query) => {
      const status = query.state.data?.pages[0]?.data.broadcast.status;
      return isBroadcastSending(status) ? 5000 : false;
    }
  });

  const firstPage = data?.pages[0]?.data;
  const broadcast = firstPage?.broadcast;
  const funnel = computeBroadcastFunnel(broadcast?.stats);
  const actions = broadcast ? broadcastActionsFor(broadcast) : null;
  const failureReasons = firstPage?.failureReasons || [];
  const warnings = firstPage?.warnings || [];
  const { consent, isConsenting } = useAutoConsentRetry(
    useMemo(() => (broadcast ? [broadcast] : []), [broadcast])
  );

  const { data: templateData } = useQuery({
    queryKey: ["template-detail", "meta", broadcast?.template?.templateId],
    queryFn: () => getTemplateById(broadcast!.template.templateId),
    enabled: Boolean(broadcast?.template?.templateId) && can("templates:view"),
    staleTime: 5 * 60_000
  });
  const templateComponents = templateData?.data.template.components;
  const previewValues = useMemo(() => {
    if (!templateComponents || !broadcast) return {};
    const slots = getTemplateVariableSlots(templateComponents);
    return resolvePreviewValues(
      slots,
      mappingsFromComponents(slots, broadcast.payload?.components)
    );
  }, [broadcast, templateComponents]);

  const recipients = useMemo(() => {
    const unique = new Map<string, BroadcastRecipient>();
    data?.pages
      .flatMap((page) => page.data.recipients || [])
      .forEach((recipient) => unique.set(recipient._id, recipient));
    const query = search.trim().toLowerCase();
    return Array.from(unique.values()).filter(
      (recipient) =>
        !query ||
        recipientName(recipient).toLowerCase().includes(query) ||
        recipient.phoneNumber.includes(query)
    );
  }, [data?.pages, search]);
  const recipientsTotal =
    data?.pages[data.pages.length - 1]?.data.recipientsPagination?.total || 0;

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

  // Keep the schedule countdown fresh.
  useEffect(() => {
    if (broadcast?.status !== "scheduled") return;
    const timer = window.setInterval(
      () => setTick((value) => value + 1),
      30_000
    );
    return () => window.clearInterval(timer);
  }, [broadcast?.status]);

  const showReasonRecipients = (status: string) => {
    setRecipientStatus(status);
    recipientsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  const timeline = broadcast
    ? [
        { label: "Created", at: broadcast.createdAt, icon: CheckCircle2 },
        { label: "Scheduled", at: broadcast.scheduledAt, icon: CalendarClock },
        { label: "Started", at: broadcast.startedAt, icon: PlayCircle },
        {
          label: "Paused at the messaging limit",
          at: broadcast.messagingLimitRetry?.detectedAt,
          icon: PauseCircle
        },
        {
          label: "Retry scheduled",
          at: broadcast.messagingLimitRetry?.scheduledAt,
          icon: RotateCcw
        },
        {
          label:
            broadcast.status === "canceled"
              ? "Canceled"
              : broadcast.status === "failed"
                ? "Failed"
                : "Completed",
          at: isBroadcastFinished(broadcast.status)
            ? broadcast.completedAt
            : null,
          icon: broadcast.status === "completed" ? CheckCircle2 : XCircle
        }
      ].filter((item) => item.at)
    : [];

  const errorText =
    (error as AxiosError<{ message?: string }> | null)?.response?.data
      ?.message || "This broadcast couldn't be loaded.";
  const category = broadcast
    ? templateCategoryPresentation(broadcast.template?.category).label
    : "";
  const topReason = failureReasons[0];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5">
        <Link
          href="/broadcasts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Broadcasts
        </Link>

        {isError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center">
            <ShieldAlert className="size-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{errorText}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        ) : isLoading || !broadcast ? (
          <>
            <Skeleton className="h-28 rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate font-heading text-2xl font-semibold">
                      {broadcast.name}
                    </h1>
                    <BroadcastStatusBadge
                      status={broadcast.status}
                      scheduledAt={broadcast.scheduledAt}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {broadcast.template?.name}
                    </span>{" "}
                    ({category})
                    {broadcastSenderLabel(broadcast) &&
                      ` · from ${broadcastSenderLabel(broadcast)}`}{" "}
                    · to{" "}
                    {funnel.total ? (
                      `${formatCount(funnel.total)} contacts`
                    ) : (
                      <EstimatedAudience broadcast={broadcast} />
                    )}{" "}
                    ({describeAudience(broadcast.audience)})
                    {broadcast.createdBy?.name &&
                      ` · by ${broadcast.createdBy.name}`}
                  </p>
                  {templateComponents && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          <Eye className="size-4" />
                          Preview message
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[360px] p-2">
                        <WhatsAppPreview
                          components={templateComponents}
                          variableValues={previewValues}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {actions?.canStart && (
                    <Button onClick={() => setIsStartOpen(true)}>
                      <PlayCircle className="size-4" />
                      Start or schedule
                    </Button>
                  )}
                  {actions?.canDiscard && (
                    <Button
                      variant="outline"
                      onClick={() => setIsCancelOpen(true)}
                    >
                      Discard
                    </Button>
                  )}
                  {actions?.canCancelSchedule && (
                    <>
                      <span className="text-sm text-muted-foreground">
                        Sends in {formatCountdown(broadcast.scheduledAt)}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setIsCancelOpen(true)}
                      >
                        Cancel schedule
                      </Button>
                    </>
                  )}
                  {actions?.needsRetryConsent && (
                    <Button
                      variant="outline"
                      isLoading={isConsenting}
                      onClick={() => consent(broadcast._id)}
                    >
                      <RotateCcw className="size-4" />
                      Retry unfinished
                    </Button>
                  )}
                  {actions?.canCancel && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setIsCancelOpen(true)}
                    >
                      Cancel
                    </Button>
                  )}
                  {actions?.canDuplicate && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/broadcasts?duplicate=${broadcast._id}`)
                      }
                    >
                      <Copy className="size-4" />
                      Duplicate
                    </Button>
                  )}
                </div>
              </div>

              {(broadcast.lastError ||
                broadcast.messagingLimitRetry?.lastFailureMessage) && (
                <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {broadcast.lastError ||
                      broadcast.messagingLimitRetry?.lastFailureMessage}
                  </p>
                </div>
              )}
              {warnings.map((warning, index) => {
                const text =
                  typeof warning === "string"
                    ? warning
                    : warning?.message || "";
                return text ? (
                  <div
                    key={index}
                    className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p>{text}</p>
                  </div>
                ) : null;
              })}
            </section>

            <section
              className={cn(
                "grid gap-3 sm:grid-cols-2",
                funnel.waiting > 0 ? "xl:grid-cols-5" : "xl:grid-cols-4"
              )}
            >
              <KpiCard
                label="Recipients"
                value={formatCount(funnel.total)}
                icon={Users}
              />
              <KpiCard
                label="Delivered"
                value={formatPercent(funnel.delivered, funnel.total)}
                sub={`${formatCount(funnel.delivered)} ${funnel.delivered === 1 ? "person" : "people"}`}
                icon={CheckCircle2}
              />
              <KpiCard
                label="Read"
                value={formatPercent(funnel.read, funnel.total)}
                sub={`${formatPercent(funnel.read, funnel.delivered)} of delivered`}
                icon={Eye}
              />
              <KpiCard
                label="Not delivered"
                value={formatCount(funnel.notDelivered)}
                sub={`${formatCount(funnel.failed)} failed · ${formatCount(funnel.skipped)} skipped`}
                icon={XCircle}
                tone={funnel.notDelivered ? "red" : "default"}
              />
              {funnel.waiting > 0 && (
                <KpiCard
                  label="Waiting to retry"
                  value={formatCount(funnel.waiting)}
                  sub="Retried automatically"
                  icon={RotateCcw}
                  tone="amber"
                />
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
                <h2 className="font-heading text-lg font-semibold">Delivery</h2>
                <FunnelBar
                  label="Sent"
                  value={funnel.sent}
                  total={funnel.total}
                  className="bg-slate-400"
                />
                <FunnelBar
                  label="Delivered"
                  value={funnel.delivered}
                  total={funnel.total}
                  className="bg-emerald-500"
                />
                <FunnelBar
                  label="Read"
                  value={funnel.read}
                  total={funnel.total}
                  className="bg-emerald-700"
                />
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  {[
                    ["Failed", funnel.failed, "bg-red-50 text-red-700"],
                    ["Skipped", funnel.skipped, "bg-slate-100 text-slate-600"],
                    ["Waiting", funnel.waiting, "bg-amber-50 text-amber-800"],
                    [
                      "Canceled",
                      funnel.canceled,
                      "bg-slate-100 text-slate-600"
                    ],
                    ...(isBroadcastSending(broadcast.status)
                      ? [["Queued", funnel.queued, "bg-sky-50 text-sky-700"]]
                      : [])
                  ].map(([label, value, className]) => (
                    <span
                      key={label as string}
                      className={cn(
                        "rounded-full px-2.5 py-1 font-medium",
                        className as string
                      )}
                    >
                      {label} {formatCount(value as number)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
                <h2 className="font-heading text-lg font-semibold">Timeline</h2>
                <ol className="space-y-3 border-l pl-4">
                  {timeline.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.label} className="relative">
                        <span className="absolute -left-[25px] flex size-4 items-center justify-center rounded-full bg-white">
                          <Icon className="size-4 text-primary" />
                        </span>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatWhen(item.at)} · {formatRelative(item.at)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>

            {failureReasons.length > 0 && (
              <section className="rounded-lg bg-white p-5 shadow-xs">
                <h2 className="font-heading text-lg font-semibold">
                  Why some didn&apos;t receive it
                </h2>
                <div className="mt-2 divide-y">
                  {failureReasons.map((reason) => (
                    <ReasonRow
                      key={`${reason.status}:${reason.errorCode}`}
                      reason={reason}
                      onSelect={() => showReasonRecipients(reason.status)}
                    />
                  ))}
                </div>
                {topReason?.errorCode === "131049" && (
                  <p className="mt-3 flex gap-2 rounded-md bg-sky-50 p-3 text-sm text-sky-900">
                    <Lightbulb className="mt-0.5 size-4 shrink-0" />
                    Marketing messages to people who rarely reply are capped by
                    Meta. Utility templates aren&apos;t affected; replies within
                    24h are free of this limit.
                  </p>
                )}
              </section>
            )}

            <section
              ref={recipientsRef}
              className="scroll-mt-24 rounded-lg bg-white shadow-xs"
            >
              <div className="space-y-3 border-b p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-heading text-lg font-semibold">
                    Recipients{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {formatCount(recipientsTotal)}
                    </span>
                  </h2>
                  <div className="relative sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name or phone"
                      className="h-10 pl-9"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {recipientFilters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setRecipientStatus(filter.value)}
                      className={cn(
                        "shrink-0 cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition",
                        recipientStatus === filter.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {recipients.length ? (
                <>
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2 font-medium">Contact</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">Reason</th>
                          <th className="px-4 py-2 font-medium">Sent</th>
                          <th className="px-4 py-2 font-medium">Delivered</th>
                          <th className="px-4 py-2 font-medium">Read</th>
                          <th className="w-10 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map((recipient) => {
                          const outcome = describeRecipientOutcome({
                            status: recipient.status,
                            deferredAt: recipient.deferredAt,
                            ...recipientError(recipient)
                          });
                          const metaText =
                            recipientError(recipient).errorMessage;
                          return (
                            <tr
                              key={recipient._id}
                              className="border-b last:border-0"
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium">
                                  {recipientName(recipient)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {recipient.phoneNumber}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                    outcomeToneClass[outcome.tone]
                                  )}
                                >
                                  {outcome.label}
                                </span>
                              </td>
                              <td className="max-w-80 px-4 py-3 text-xs text-muted-foreground">
                                {outcome.explanation ? (
                                  metaText &&
                                  metaText !== outcome.explanation ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help underline decoration-dotted">
                                          {outcome.explanation}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {metaText}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    outcome.explanation
                                  )
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {formatRelative(
                                  recipient.sentAt ||
                                    recipient.messageId?.sentAt
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {formatRelative(
                                  recipient.deliveredAt ||
                                    recipient.messageId?.deliveredAt
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {formatRelative(
                                  recipient.readAt ||
                                    recipient.messageId?.readAt
                                )}
                              </td>
                              <td className="px-2 py-3">
                                <RecipientMenu phone={recipient.phoneNumber} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ul className="divide-y md:hidden">
                    {recipients.map((recipient) => {
                      const outcome = describeRecipientOutcome({
                        status: recipient.status,
                        deferredAt: recipient.deferredAt,
                        ...recipientError(recipient)
                      });
                      return (
                        <li
                          key={recipient._id}
                          className="flex items-start gap-3 p-4"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium">
                              {recipientName(recipient)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {recipient.phoneNumber}
                            </p>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                outcomeToneClass[outcome.tone]
                              )}
                            >
                              {outcome.label}
                            </span>
                            {outcome.explanation && (
                              <p className="text-xs text-muted-foreground">
                                {outcome.explanation}
                              </p>
                            )}
                          </div>
                          <RecipientMenu phone={recipient.phoneNumber} />
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  <MessageCircle className="mx-auto mb-2 size-8 text-muted-foreground/60" />
                  {broadcast.status === "draft" ||
                  broadcast.status === "scheduled"
                    ? "Recipients appear here once the broadcast starts."
                    : search || recipientStatus
                      ? "No recipients match these filters."
                      : "No recipients yet."}
                </div>
              )}
              <div ref={loadMoreRef} className="h-px" />
              {isFetchingNextPage && (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-12" />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <StartBroadcastDialog
        broadcast={broadcast || null}
        open={isStartOpen}
        onOpenChange={setIsStartOpen}
      />
      <CancelBroadcastDialog
        broadcast={broadcast || null}
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        onDone={() => {
          if (broadcast?.status === "draft") router.push("/broadcasts");
        }}
      />
    </AppLayout>
  );
}

function RecipientMenu({ phone }: { phone: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Recipient actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/conversations?search=${encodeURIComponent(phone)}`}>
            <MessageCircle className="size-4" />
            Open conversation
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function BroadcastDetailsPage() {
  return (
    <PermissionGate permission="broadcasts:manage" feature="Broadcasts">
      <BroadcastDetailsPageContent />
    </PermissionGate>
  );
}
