"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  AlertCircle,
  ChevronDown,
  Contact,
  Inbox,
  MessageCircle,
  Minus,
  Send,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  enableTemplateInsights,
  getConversationCostAnalytics,
  getDashboardAnalytics,
  getTemplateInsightsStatus
} from "@/client-api/functions/analytics";
import { getWhatsAppPhoneNumbers } from "@/client-api/functions/organizations";
import {
  AnalyticsRange,
  AnalyticsTrend
} from "@/client-api/types/analytics.type";
import { CategorySpendCard } from "@/components/analytics/CategorySpendCard";
import { FreeRepliesCard } from "@/components/analytics/FreeRepliesCard";
import { ChartTooltip } from "@/components/analytics/ChartTooltip";
import { HealthStrip } from "@/components/analytics/HealthStrip";
import { PartToWholeCard } from "@/components/analytics/PartToWholeCard";
import { SpendHeroCard } from "@/components/analytics/SpendHeroCard";
import { VolumeSummaryCard } from "@/components/analytics/VolumeSummaryCard";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import {
  categorical,
  chartInk,
  sequentialGreen,
  status
} from "@/lib/analyticsColors";
import { describeHealthAlert, describeTrend } from "@/lib/analyticsFormat";
import { formatDayKey } from "@/lib/displayFormat";
import { broadcastStatusPresentation } from "@/lib/statusPresentation";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";
import { PermissionGate } from "@/components/common/NoAccess";

const ranges: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" }
];

const numberFormat = new Intl.NumberFormat("en-IN");

function AnalyticsPageContent() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const queryClient = useQueryClient();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [acknowledged, setAcknowledged] = useState(false);
  const { isOwnerOrAdmin } = useCurrentMembership();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-dashboard", activeOrganization?._id, range, timezone],
    queryFn: () => getDashboardAnalytics({ range, timezone }),
    enabled: Boolean(activeOrganization?._id)
  });

  const { data: costsData, isLoading: isLoadingCosts } = useQuery({
    queryKey: ["analytics-conversation-costs", activeOrganization?._id, range],
    queryFn: () => getConversationCostAnalytics({ range, groupBy: "category" }),
    enabled: Boolean(activeOrganization?._id) && isOwnerOrAdmin
  });

  const { data: insightsStatusData } = useQuery({
    queryKey: ["template-insights-status"],
    queryFn: () => getTemplateInsightsStatus(),
    enabled: isOwnerOrAdmin
  });

  const { data: phoneNumbersData } = useQuery({
    queryKey: ["whatsapp-phone-numbers", activeOrganization?._id],
    queryFn: getWhatsAppPhoneNumbers,
    enabled: Boolean(activeOrganization?._id) && isOwnerOrAdmin
  });

  const { mutate: enableInsights, isPending: isEnabling } = useMutation({
    mutationFn: () => enableTemplateInsights(),
    meta: { showToast: false },
    onSuccess: () => {
      setAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ["template-insights-status"] });
    }
  });

  const dashboard = data?.data.dashboard;
  const costs = costsData?.data;
  const templateInsightsEnabled =
    insightsStatusData?.data.templateInsightsEnabled;
  // Meta only offers template insights to fully Business-verified accounts.
  // A coexistence-enabled number was connected via the WhatsApp Business
  // consumer app, which puts the WABA on the SMB tier -- Meta permanently
  // rejects the opt-in for those, so there's no point prompting for it.
  const hasCoexistenceNumber = (phoneNumbersData?.data.phoneNumbers || []).some(
    (number) => number.coexistenceEnabled
  );

  const conversationStatus = dashboard
    ? [
        {
          name: "Open",
          value: dashboard.conversationStatus.open,
          color: status.warning
        },
        {
          name: "Pending",
          value: dashboard.conversationStatus.pending,
          color: status.serious
        },
        {
          name: "Resolved",
          value: dashboard.conversationStatus.resolved,
          color: status.good
        }
      ]
    : [];
  const messageSources = dashboard
    ? [
        {
          name: "Bot",
          value: dashboard.messageSources.bot,
          color: categorical.brand
        },
        {
          name: "Agents",
          value: dashboard.messageSources.agent,
          color: categorical.blue
        },
        {
          name: "Broadcasts",
          value: dashboard.messageSources.broadcast,
          color: categorical.orange
        }
      ]
    : [];
  const channels = dashboard
    ? [
        {
          name: "WhatsApp",
          value: dashboard.channelDistribution.whatsapp,
          color: categorical.brand
        },
        {
          name: "Instagram",
          value: dashboard.channelDistribution.instagram,
          color: categorical.magenta
        }
      ]
    : [];
  const broadcastFunnel = dashboard
    ? [
        {
          stage: "Recipients",
          value: dashboard.broadcastPerformance.totalRecipients,
          fill: sequentialGreen.step1
        },
        {
          stage: "Sent",
          value: dashboard.broadcastPerformance.sent,
          fill: sequentialGreen.step2
        },
        {
          stage: "Delivered",
          value: dashboard.broadcastPerformance.delivered,
          fill: sequentialGreen.step3
        },
        {
          stage: "Read",
          value: dashboard.broadcastPerformance.read,
          fill: sequentialGreen.step4
        },
        {
          stage: "Failed",
          value: dashboard.broadcastPerformance.failed,
          fill: status.critical
        }
      ]
    : [];

  const volumeRows = dashboard
    ? [
        {
          label: "Total contacts",
          value: numberFormat.format(dashboard.cards.totalContacts),
          trend: dashboard.trends?.totalContacts,
          sparkline: dashboard.contactGrowth.map(
            (row) => row.totalContacts as number
          )
        },
        {
          label: "Charged messages",
          value: numberFormat.format(costs?.billable?.conversationCount || 0),
          sparkline: costs?.daily?.map((row) => row.conversationCount)
        },
        {
          label: "Messages sent",
          value: numberFormat.format(dashboard.cards.messagesSent),
          trend: dashboard.trends?.messagesSent,
          sparkline: dashboard.messageActivity.map(
            (row) => row.outbound as number
          )
        },
        {
          label: "Delivery rate",
          value: `${dashboard.cards.deliveryRate ?? 0}%`,
          trend: dashboard.trends?.deliveryRate,
          trendKind: "rate" as const,
          sparkline: (dashboard.deliveryRateSeries || []).map(
            (row) => row.rate ?? 0
          )
        },
        {
          label: "Unread in inbox",
          value: numberFormat.format(dashboard.cards.unreadMessages)
        }
      ]
    : [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Analytics</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              {isOwnerOrAdmin && costs?.costDataAvailable
                ? "Spend & performance"
                : "Performance"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {isOwnerOrAdmin
                ? "Messages Meta counted, how many were charged, and how your messages did. More breakdowns are further down."
                : "Messages, contacts, broadcasts, and connection health in one view."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-sm bg-white p-1 shadow-xs">
              {ranges.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={range === item.value ? "default" : "ghost"}
                  onClick={() => setRange(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {isError && (
          <QueryErrorState message="Analytics could not be loaded for this organisation." />
        )}

        {isLoading || !dashboard ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : isOwnerOrAdmin ? (
          <>
            <HealthStrip dashboard={dashboard} />

            {templateInsightsEnabled === false && !hasCoexistenceNumber && (
              <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Enable template insights to see per-template click and spend
                  data from Meta.
                </p>
                <AlertDialog
                  onOpenChange={(open) => !open && setAcknowledged(false)}
                >
                  <AlertDialogTrigger asChild>
                    <Button size="sm">Enable template insights</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Enable template insights?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This is a{" "}
                        <strong>
                          permanent, one-time opt-in on Meta&apos;s side
                        </strong>{" "}
                        — there is no API to disable it once enabled. Meta will
                        collect and anonymize chat data for link tracking on
                        this WhatsApp Business Account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <label className="flex items-start gap-2 rounded-sm bg-muted/60 p-3 text-sm">
                      <Checkbox
                        checked={acknowledged}
                        onCheckedChange={(checked) =>
                          setAcknowledged(Boolean(checked))
                        }
                      />
                      I understand this cannot be undone.
                    </label>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={!acknowledged || isEnabling}
                        onClick={() => enableInsights()}
                      >
                        Enable permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </section>
            )}

            <FreeRepliesCard />

            {isLoadingCosts || !costs ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <Skeleton className="h-96 rounded-lg" />
                <Skeleton className="h-96 rounded-lg" />
              </div>
            ) : (
              <>
                {!costs.lastSyncedDate && (
                  <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <p>
                      Meta&apos;s message figures haven&apos;t arrived yet, so
                      the numbers below show no data rather than a real zero.
                      They come in every few hours; check back later.
                    </p>
                  </div>
                )}
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <SpendHeroCard costs={costs} />
                  <VolumeSummaryCard rows={volumeRows} />
                </div>
              </>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-lg bg-white p-5 shadow-xs">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-heading text-lg font-semibold">
                    Message activity
                  </h2>
                </div>
                <MessageActivityChart dashboard={dashboard} />
              </section>
              {costs && <CategorySpendCard breakdown={costs.breakdown} />}
            </div>

            <SecondaryBreakdowns
              dashboard={dashboard}
              conversationStatus={conversationStatus}
              messageSources={messageSources}
              channels={channels}
              broadcastFunnel={broadcastFunnel}
              collapsible
            />
          </>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              {[
                {
                  label: "Total contacts",
                  value: dashboard.cards.totalContacts,
                  icon: Contact,
                  trend: dashboard.trends?.totalContacts
                },
                // Chats with a message in the period, against the period
                // before. Older servers only send the all-time total.
                typeof dashboard.cards.activeConversations === "number"
                  ? {
                      label: "Conversations",
                      value: dashboard.cards.activeConversations,
                      icon: Inbox,
                      trend: dashboard.trends?.activeConversations,
                      detail: `With messages in this period · ${numberFormat.format(
                        dashboard.cards.conversations
                      )} in total`
                    }
                  : {
                      label: "Conversations",
                      value: dashboard.cards.conversations,
                      icon: Inbox,
                      trend: dashboard.trends?.conversations
                    },
                {
                  label: "Messages sent",
                  value: dashboard.cards.messagesSent,
                  icon: Send,
                  trend: dashboard.trends?.messagesSent
                },
                {
                  label: "Unread",
                  value: dashboard.cards.unreadMessages,
                  icon: MessageCircle
                }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-lg bg-white p-5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {item.label}
                      </p>
                      <div className="flex size-9 items-center justify-center rounded-sm bg-primary/10">
                        <Icon className="size-4 text-primary" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-2">
                      <p className="font-heading text-3xl font-semibold">
                        {numberFormat.format(item.value)}
                      </p>
                      {item.trend && <TrendBadge trend={item.trend} />}
                    </div>
                    {"detail" in item && item.detail && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="rounded-lg bg-white p-5 shadow-xs">
              <h2 className="mb-5 font-heading text-lg font-semibold">
                Message activity
              </h2>
              <MessageActivityChart dashboard={dashboard} />
            </section>

            <SecondaryBreakdowns
              dashboard={dashboard}
              conversationStatus={conversationStatus}
              messageSources={messageSources}
              channels={channels}
              broadcastFunnel={broadcastFunnel}
              collapsible={false}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}

function MessageActivityChart({
  dashboard
}: {
  dashboard: NonNullable<
    ReturnType<typeof getDashboardAnalytics> extends Promise<infer R>
      ? R extends { data: { dashboard: infer D } }
        ? D
        : never
      : never
  >;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dashboard.messageActivity}>
          <CartesianGrid stroke={chartInk.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDayKey(value)}
            tick={{ fontSize: 12, fill: chartInk.axis }}
            axisLine={{ stroke: chartInk.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: chartInk.axis }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            iconType="plainline"
            wrapperStyle={{ fontSize: 13 }}
          />
          <Line
            type="linear"
            dataKey="outbound"
            name="Outgoing"
            stroke={categorical.brand}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
          />
          <Line
            type="linear"
            dataKey="inbound"
            name="Incoming"
            stroke={categorical.blue}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SecondaryBreakdowns({
  dashboard,
  conversationStatus,
  messageSources,
  channels,
  broadcastFunnel,
  collapsible
}: {
  dashboard: NonNullable<
    ReturnType<typeof getDashboardAnalytics> extends Promise<infer R>
      ? R extends { data: { dashboard: infer D } }
        ? D
        : never
      : never
  >;
  conversationStatus: Array<{ name: string; value: number; color: string }>;
  messageSources: Array<{ name: string; value: number; color: string }>;
  channels: Array<{ name: string; value: number; color: string }>;
  broadcastFunnel: Array<{ stage: string; value: number; fill: string }>;
  collapsible: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const panelNames =
    "Conversation status · Who sent messages · Channels · New contacts · Broadcasts · Connection health";

  const content = (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-3">
        <PartToWholeCard
          title="Conversation status"
          description="All your conversations, by where they stand now."
          data={conversationStatus}
          emptyMessage="No conversations yet."
        />
        <PartToWholeCard
          title="Who sent messages"
          description="Messages sent in this period."
          data={messageSources}
          emptyMessage="No messages sent in this period."
        />
        <PartToWholeCard
          title="Channels"
          description="All your conversations, by channel."
          data={channels}
          emptyMessage="No conversations yet."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-lg bg-white p-5 shadow-xs">
          <h2 className="font-heading text-lg font-semibold">New contacts</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Daily growth — the running total is above.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.contactGrowth}>
                <CartesianGrid stroke={chartInk.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatDayKey(value)}
                  tick={{ fontSize: 12, fill: chartInk.axis }}
                  axisLine={{ stroke: chartInk.grid }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chartInk.axis }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: chartInk.grid }}
                />
                <Area
                  type="linear"
                  dataKey="newContacts"
                  name="New contacts"
                  stroke={categorical.brand}
                  strokeWidth={2}
                  fill={categorical.brand}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-xs">
          <h2 className="mb-5 font-heading text-lg font-semibold">
            Broadcast funnel
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={broadcastFunnel}
                layout="vertical"
                margin={{ left: 12, right: 36 }}
              >
                <CartesianGrid stroke={chartInk.grid} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={80}
                  tick={{ fontSize: 12, fill: chartInk.axis }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                />
                <Bar
                  dataKey="value"
                  name="Messages"
                  radius={[0, 4, 4, 0]}
                  barSize={22}
                >
                  {broadcastFunnel.map((item) => (
                    <Cell key={item.stage} fill={item.fill} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value: number) => numberFormat.format(value)}
                    style={{ fill: "#0b0b0b", fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg bg-white p-5 shadow-xs">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Recent broadcasts
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-3">Broadcast</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Delivered</th>
                  <th className="py-3">Read</th>
                  <th className="py-3 text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentBroadcasts.map((broadcast) => (
                  <tr key={broadcast.id} className="border-t">
                    <td className="py-3 font-medium">{broadcast.name}</td>
                    <td className="py-3">
                      {broadcastStatusPresentation(broadcast.status).label}
                    </td>
                    <td className="py-3 tabular-nums">
                      {numberFormat.format(broadcast.stats.delivered)}
                    </td>
                    <td className="py-3 tabular-nums">
                      {numberFormat.format(broadcast.stats.read)}
                    </td>
                    <td
                      className={cn(
                        "py-3 text-right tabular-nums",
                        broadcast.stats.failed > 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {numberFormat.format(broadcast.stats.failed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-heading text-lg font-semibold">
              Connection health
            </h2>
          </div>
          <div className="space-y-3 text-sm">
            <HealthRow
              label="WhatsApp"
              value={dashboard.integrationHealth.whatsapp.status}
              isStatus
            />
            <HealthRow
              label="Active numbers"
              value={dashboard.integrationHealth.whatsapp.activePhoneNumbers}
            />
            <HealthRow
              label="Instagram"
              value={dashboard.integrationHealth.instagram.status}
              isStatus
            />
          </div>
          <HealthAlerts alerts={dashboard.integrationHealth.alerts} />
        </div>
      </section>
    </div>
  );

  if (!collapsible) return content;

  return (
    <section className="rounded-lg bg-white shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-heading text-base font-semibold">
            More breakdowns
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {panelNames}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>
      {isOpen && <div className="border-t p-4">{content}</div>}
    </section>
  );
}

function HealthRow({
  label,
  value,
  isStatus = false
}: {
  label: string;
  value: string | number;
  isStatus?: boolean;
}) {
  const isGood = isStatus && typeof value === "string" && value === "ready";
  const shown = typeof value === "string" ? healthStatusLabel(value) : value;
  return (
    <div className="flex items-center justify-between rounded-sm bg-muted/60 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-medium">
        {isStatus && (
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: isGood ? status.good : status.warning }}
          />
        )}
        {shown}
      </span>
    </div>
  );
}

const HEALTH_STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  connected: "Connected",
  not_connected: "Not connected",
  disconnected: "Disconnected",
  needs_attention: "Needs attention",
  degraded: "Needs attention",
  error: "Needs attention"
};

const healthStatusLabel = (value: string) => {
  const key = value.trim().toLowerCase();
  if (HEALTH_STATUS_LABELS[key]) return HEALTH_STATUS_LABELS[key];
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

type HealthAlert = {
  code?: string;
  severity?: string;
  message?: string;
  displayPhoneNumber?: string | null;
};

function HealthAlerts({ alerts }: { alerts: HealthAlert[] }) {
  const shown = alerts.filter((alert) => alert.message);
  if (!shown.length) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Nothing needs your attention.
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Needs your attention
      </p>
      {shown.slice(0, 4).map((alert, index) => {
        const described = describeHealthAlert(alert);
        return (
          <div
            key={`${alert.code || "alert"}-${index}`}
            className="flex gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <div className="min-w-0 space-y-1 overflow-wrap-anywhere">
              {alert.displayPhoneNumber ? (
                <p className="font-medium">{alert.displayPhoneNumber}</p>
              ) : null}
              <p>{described.text}</p>
              {described.actionUrl && (
                <a
                  href={described.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-medium text-amber-900 underline underline-offset-2"
                >
                  {described.actionLabel}
                </a>
              )}
            </div>
          </div>
        );
      })}
      <Link
        href="/overview"
        className="inline-block text-xs font-medium text-primary hover:underline"
      >
        Check your numbers on Overview
      </Link>
    </div>
  );
}

function TrendBadge({ trend }: { trend: AnalyticsTrend }) {
  const described = describeTrend(trend);
  if (!described) return null;
  const Icon =
    described.direction === "up"
      ? TrendingUp
      : described.direction === "down"
        ? TrendingDown
        : Minus;

  return (
    <span
      className={cn(
        "mb-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        described.direction === "up"
          ? "bg-emerald-50 text-emerald-700"
          : described.direction === "down"
            ? "bg-red-50 text-red-700"
            : "bg-muted text-muted-foreground"
      )}
      title={described.title}
    >
      <Icon className="size-3" />
      {described.label}
    </span>
  );
}

export default function AnalyticsPage() {
  return (
    <PermissionGate permission="conversations:view" feature="Analytics">
      <AnalyticsPageContent />
    </PermissionGate>
  );
}
