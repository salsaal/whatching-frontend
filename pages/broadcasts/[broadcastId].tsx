"use client";

import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  MessageCircle,
  Send,
  ShieldAlert,
  Users,
  XCircle
} from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";

import { getBroadcastById } from "@/client-api/functions/broadcasts";
import { BroadcastStats } from "@/client-api/types/broadcasts.type";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";

const formatDate = (date?: string | null) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(date))
    : "-";

const statusClasses: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-50 text-blue-700",
  processing: "bg-amber-50 text-amber-700",
  completed: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  canceled: "bg-muted text-muted-foreground"
};

const getPercent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const metricRows = (stats: BroadcastStats) => {
  const total = stats.totalRecipients || 0;

  return [
    {
      label: "Queued",
      value: stats.queuedRecipients,
      percent: getPercent(stats.queuedRecipients, total),
      icon: Clock3,
      color: "bg-slate-500"
    },
    {
      label: "Sent",
      value: stats.sentRecipients,
      percent: getPercent(stats.sentRecipients, total),
      icon: Send,
      color: "bg-blue-500"
    },
    {
      label: "Delivered",
      value: stats.deliveredRecipients,
      percent: getPercent(stats.deliveredRecipients, total),
      icon: CheckCircle2,
      color: "bg-primary"
    },
    {
      label: "Read",
      value: stats.readRecipients,
      percent: getPercent(stats.readRecipients, total),
      icon: Eye,
      color: "bg-emerald-600"
    },
    {
      label: "Failed",
      value: stats.failedRecipients,
      percent: getPercent(stats.failedRecipients, total),
      icon: ShieldAlert,
      color: "bg-destructive"
    },
    {
      label: "Skipped",
      value: stats.skippedRecipients,
      percent: getPercent(stats.skippedRecipients, total),
      icon: XCircle,
      color: "bg-orange-500"
    }
  ];
};

const getTimelineRows = (broadcast: {
  createdAt: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}) => [
  {
    label: "Created",
    value: formatDate(broadcast.createdAt),
    icon: CalendarClock
  },
  {
    label: "Scheduled",
    value: formatDate(broadcast.scheduledAt),
    icon: Clock3
  },
  { label: "Started", value: formatDate(broadcast.startedAt), icon: Send },
  {
    label: "Completed",
    value: formatDate(broadcast.completedAt),
    icon: CheckCircle2
  }
];

export default function BroadcastMetricsPage() {
  const router = useRouter();
  const broadcastId = Array.isArray(router.query.broadcastId)
    ? router.query.broadcastId[0]
    : router.query.broadcastId;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["broadcast", broadcastId],
    queryFn: () => getBroadcastById(broadcastId as string),
    enabled: Boolean(broadcastId),
    refetchOnMount: "always"
  });

  const broadcast = data?.data.broadcast;
  const recipients = useMemo(
    () => data?.data.recipients || [],
    [data?.data.recipients]
  );
  const stats = broadcast?.stats;
  const rows = stats ? metricRows(stats) : [];
  const deliveryRate = stats
    ? getPercent(stats.deliveredRecipients, stats.totalRecipients)
    : 0;
  const readRate = stats
    ? getPercent(stats.readRecipients, stats.totalRecipients)
    : 0;
  const failureRate = stats
    ? getPercent(stats.failedRecipients, stats.totalRecipients)
    : 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Button
                type="button"
                variant="ghost"
                className="mb-3 px-0 text-muted-foreground hover:bg-transparent"
                onClick={() => router.push("/broadcasts")}
              >
                <ArrowLeft className="size-4" />
                Back to broadcasts
              </Button>
              <p className="text-sm font-medium text-primary">
                Broadcast metrics
              </p>
              {isLoading ? (
                <Skeleton className="mt-2 h-9 w-72" />
              ) : (
                <h1 className="mt-1 truncate font-heading text-3xl font-semibold">
                  {broadcast?.name || "Broadcast"}
                </h1>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Delivery performance, recipient status, and campaign timing for
                this broadcast.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-sm bg-primary/10">
                <BarChart3 className="size-6 text-primary" />
              </div>
              {broadcast?.status && (
                <span
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-sm font-medium capitalize",
                    statusClasses[broadcast.status] ||
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {broadcast.status}
                </span>
              )}
            </div>
          </div>
        </section>

        {isError ? (
          <section className="rounded-lg bg-white p-8 text-center shadow-xs">
            <ShieldAlert className="mx-auto size-10 text-destructive" />
            <h2 className="mt-4 font-heading text-xl font-semibold">
              Unable to load broadcast
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The broadcast may not exist or may not belong to this
              organisation.
            </p>
          </section>
        ) : isLoading || !broadcast || !stats ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-lg" />
            ))}
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total recipients",
                  value: stats.totalRecipients,
                  icon: Users
                },
                {
                  label: "Delivered",
                  value: `${deliveryRate}%`,
                  icon: CheckCircle2
                },
                {
                  label: "Read",
                  value: `${readRate}%`,
                  icon: Eye
                },
                {
                  label: "Failed",
                  value: `${failureRate}%`,
                  icon: ShieldAlert
                }
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <Card key={item.label} className="rounded-lg py-5 shadow-xs">
                    <CardContent className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-2 font-heading text-3xl font-semibold">
                          {item.value}
                        </p>
                      </div>
                      <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10">
                        <Icon className="size-5 text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="rounded-lg shadow-xs">
                <CardHeader>
                  <CardTitle className="font-heading text-xl">
                    Delivery funnel
                  </CardTitle>
                  <CardDescription>
                    Recipient movement across send, delivery, read, and error
                    states.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {rows.map((row) => {
                    const Icon = row.icon;

                    return (
                      <div key={row.label} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 items-center justify-center rounded-sm bg-muted">
                              <Icon className="size-4 text-muted-foreground" />
                            </span>
                            <span className="text-sm font-medium">
                              {row.label}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {row.value} / {stats.totalRecipients} ({row.percent}
                            %)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", row.color)}
                            style={{ width: `${row.percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="rounded-lg shadow-xs">
                <CardHeader>
                  <CardTitle className="font-heading text-xl">
                    Campaign timeline
                  </CardTitle>
                  <CardDescription>
                    Key timestamps returned by the broadcast lifecycle.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getTimelineRows(broadcast).map((row) => {
                    const Icon = row.icon;

                    return (
                      <div
                        key={row.label}
                        className="flex items-start gap-3 rounded-sm border p-3"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10">
                          <Icon className="size-4 text-primary" />
                        </span>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {row.label}
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {row.value}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {broadcast.lastError && (
                    <div className="rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
                      {broadcast.lastError}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <Card className="rounded-lg shadow-xs">
              <CardHeader>
                <CardTitle className="font-heading text-xl">
                  Recipients
                </CardTitle>
                <CardDescription>
                  {data?.data.recipientsPagination?.total ?? recipients.length}{" "}
                  recipients returned for this broadcast.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recipients.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Delivered</TableHead>
                        <TableHead>Read</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipients.map((recipient) => (
                        <TableRow key={recipient._id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10">
                                <MessageCircle className="size-4 text-primary" />
                              </span>
                              <div>
                                <p className="font-medium">
                                  {[
                                    recipient.subscriberId?.firstName,
                                    recipient.subscriberId?.lastName
                                  ]
                                    .filter(Boolean)
                                    .join(" ") || recipient.phoneNumber}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {recipient.phoneNumber}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {recipient.status}
                          </TableCell>
                          <TableCell>
                            {formatDate(
                              recipient.sentAt || recipient.messageId?.sentAt
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDate(
                              recipient.deliveredAt ||
                                recipient.messageId?.deliveredAt
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDate(
                              recipient.readAt || recipient.messageId?.readAt
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-sm bg-muted/50 p-8 text-center text-sm text-muted-foreground">
                    No recipients returned for this broadcast yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
