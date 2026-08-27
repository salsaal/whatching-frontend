"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Bot,
  Contact,
  Inbox,
  MessageCircle,
  Minus,
  Send,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getDashboardAnalytics } from "@/client-api/functions/analytics";
import {
  AnalyticsRange,
  AnalyticsTrend
} from "@/client-api/types/analytics.type";
import CostsTab from "@/components/analytics/CostsTab";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

const ranges: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" }
];

const colors = ["#10b981", "#2563eb", "#f59e0b", "#ef4444"];

const numberFormat = new Intl.NumberFormat("en-IN");

export default function AnalyticsPage() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [range, setRange] = useState<AnalyticsRange>("30d");
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

  const dashboard = data?.data.dashboard;
  const cardItems = dashboard
    ? [
        {
          label: "Total contacts",
          value: dashboard.cards.totalContacts,
          icon: Contact,
          trend: dashboard.trends?.totalContacts
        },
        {
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
      ]
    : [];
  const conversationStatus = dashboard
    ? [
        { name: "Open", value: dashboard.conversationStatus.open },
        { name: "Pending", value: dashboard.conversationStatus.pending },
        { name: "Resolved", value: dashboard.conversationStatus.resolved }
      ]
    : [];
  const messageSources = dashboard
    ? [
        { name: "Bot", value: dashboard.messageSources.bot },
        { name: "Agents", value: dashboard.messageSources.agent },
        { name: "Broadcasts", value: dashboard.messageSources.broadcast }
      ]
    : [];
  const channels = dashboard
    ? [
        { name: "WhatsApp", value: dashboard.channelDistribution.whatsapp },
        { name: "Instagram", value: dashboard.channelDistribution.instagram }
      ]
    : [];
  const broadcastFunnel = dashboard
    ? [
        {
          stage: "Recipients",
          value: dashboard.broadcastPerformance.totalRecipients,
          fill: "#64748b"
        },
        {
          stage: "Sent",
          value: dashboard.broadcastPerformance.sent,
          fill: "#2563eb"
        },
        {
          stage: "Delivered",
          value: dashboard.broadcastPerformance.delivered,
          fill: "#10b981"
        },
        {
          stage: "Read",
          value: dashboard.broadcastPerformance.read,
          fill: "#14b8a6"
        },
        {
          stage: "Failed",
          value: dashboard.broadcastPerformance.failed,
          fill: "#ef4444"
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
              Performance dashboard
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Messages, contacts, broadcasts, and integration health in one
              view.
            </p>
          </div>
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
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              {cardItems.map((item) => {
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
                      <Icon className="size-4 text-primary" />
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-2">
                      <p className="font-heading text-3xl font-semibold">
                        {numberFormat.format(item.value)}
                      </p>
                      {item.trend && <TrendBadge trend={item.trend} />}
                    </div>
                  </div>
                );
              })}
            </section>

            {isOwnerOrAdmin && (
              <>
                <div className="flex items-center gap-3 pt-1">
                  <h2 className="font-heading text-lg font-semibold text-muted-foreground">
                    Meta spend &amp; template performance
                  </h2>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <CostsTab range={range} />
              </>
            )}

            <section className="rounded-lg bg-white p-5 shadow-xs">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold">
                  Message activity
                </h2>
                <Badge variant="outline">{dashboard.range.timezone}</Badge>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.messageActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="inbound"
                      name="Incoming"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.16}
                    />
                    <Area
                      type="monotone"
                      dataKey="outbound"
                      name="Outgoing"
                      stroke="#2563eb"
                      fill="#2563eb"
                      fillOpacity={0.12}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <DonutCard
                title="Conversation status"
                data={conversationStatus}
              />
              <DonutCard title="Bot vs agent" data={messageSources} />
              <DonutCard title="Channel distribution" data={channels} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="rounded-lg bg-white p-5 shadow-xs">
                <h2 className="mb-5 font-heading text-lg font-semibold">
                  Contact growth
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.contactGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="totalContacts"
                        name="Total contacts"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.14}
                      />
                      <Area
                        type="monotone"
                        dataKey="newContacts"
                        name="New contacts"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.12}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg bg-white p-5 shadow-xs">
                <h2 className="mb-5 font-heading text-lg font-semibold">
                  Broadcast performance
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={broadcastFunnel}
                      layout="vertical"
                      margin={{ left: 12, right: 18 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                        horizontal={false}
                      />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="stage"
                        width={72}
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name="Messages"
                        radius={[0, 5, 5, 0]}
                        barSize={24}
                      >
                        {broadcastFunnel.map((item) => (
                          <Cell key={item.stage} fill={item.fill} />
                        ))}
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
                          <td className="py-3 capitalize">
                            {broadcast.status}
                          </td>
                          <td className="py-3">{broadcast.stats.delivered}</td>
                          <td className="py-3">{broadcast.stats.read}</td>
                          <td className="py-3 text-right text-destructive">
                            {broadcast.stats.failed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg bg-white p-5 shadow-xs">
                <div className="mb-4 flex items-center gap-2">
                  <Bot className="size-5 text-primary" />
                  <h2 className="font-heading text-lg font-semibold">
                    Integration health
                  </h2>
                </div>
                <div className="space-y-3 text-sm">
                  <HealthRow
                    label="WhatsApp"
                    value={dashboard.integrationHealth.whatsapp.status}
                  />
                  <HealthRow
                    label="Active numbers"
                    value={
                      dashboard.integrationHealth.whatsapp.activePhoneNumbers
                    }
                  />
                  <HealthRow
                    label="Instagram"
                    value={dashboard.integrationHealth.instagram.status}
                  />
                  <HealthRow
                    label="Alerts"
                    value={dashboard.integrationHealth.alerts.length}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function DonutCard({
  title,
  data
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-lg bg-white p-5 shadow-xs">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid grid-cols-[150px_minmax(0,1fr)] items-center gap-4">
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={42}
                outerRadius={62}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                {item.name}
              </span>
              <span
                className={cn(
                  "font-medium",
                  total === 0 && "text-muted-foreground"
                )}
              >
                {numberFormat.format(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-sm bg-muted/60 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}

function TrendBadge({ trend }: { trend: AnalyticsTrend }) {
  const isNew = trend.previous === 0 && trend.current > 0;
  const isFlat = trend.previous === 0 && trend.current === 0;
  const isUp = trend.changePercent > 0;
  const isDown = trend.changePercent < 0;

  if (isFlat) return null;

  const Icon = isNew || isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const label = isNew ? "New" : `${isUp ? "+" : ""}${trend.changePercent}%`;

  return (
    <span
      className={cn(
        "mb-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isUp || isNew
          ? "bg-emerald-50 text-emerald-700"
          : isDown
            ? "bg-red-50 text-red-700"
            : "bg-muted text-muted-foreground"
      )}
      title="vs. the previous equivalent period"
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
