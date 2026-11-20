import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Inbox } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { getDashboardAnalytics } from "@/client-api/functions/analytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { recentDayActivity } from "@/lib/analyticsFormat";
import { formatCount } from "@/lib/displayFormat";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

// Today's date as the analytics API keys its days ("2026-11-19"), in the
// timezone the request asked for.
const todayKey = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

const weekdayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  timeZone: "UTC"
});
const longDayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC"
});
const dayDate = (key: string) => new Date(`${key}T12:00:00Z`);

function Count({
  value,
  label,
  attention
}: {
  value: number;
  label: string;
  attention: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-heading text-4xl font-semibold tabular-nums">
        {formatCount(value)}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        {attention && (
          <span className="size-2 shrink-0 rounded-full bg-amber-500" />
        )}
        {label}
      </p>
    </div>
  );
}

/**
 * The top of Overview: what needs a person now (unread, waiting, failed
 * broadcast messages) and today's messages with the week behind them. Uses
 * the same dashboard data as Analytics.
 */
export function InboxSummary() {
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-dashboard", organizationId, "7d", timezone],
    queryFn: () => getDashboardAnalytics({ range: "7d", timezone }),
    enabled: Boolean(organizationId)
  });
  const dashboard = data?.data.dashboard;

  if (isError) return null;
  if (isLoading || !dashboard) {
    return (
      <section className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[216px] rounded-lg lg:col-span-3" />
        <Skeleton className="h-[216px] rounded-lg lg:col-span-2" />
      </section>
    );
  }

  const today = todayKey(dashboard.range.timezone || timezone);
  const week = recentDayActivity(dashboard.messageActivity, today, 7);
  const todayActivity = week[week.length - 1];
  const received = todayActivity?.received || 0;
  const sent = todayActivity?.sent || 0;
  const busiest = Math.max(1, ...week.map((day) => day.received + day.sent));
  const unread = dashboard.cards.unreadConversations || 0;
  const waiting = dashboard.conversationStatus.pending || 0;
  const failed = dashboard.broadcastPerformance.failed || 0;
  const caughtUp = unread === 0 && waiting === 0;

  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col rounded-lg border bg-white shadow-xs lg:col-span-3">
        <div className="flex flex-1 flex-col p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Needs you
          </h2>
          {/* Centred in the height the messages chart sets for the row. */}
          <div className="flex flex-1 flex-col justify-center pt-3">
            {caughtUp ? (
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="font-heading text-xl font-semibold">
                    You&apos;re all caught up
                  </p>
                  <p className="text-sm text-muted-foreground">
                    No unread chats, and nobody is waiting for a person.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 sm:max-w-md">
                <Count
                  value={unread}
                  label={unread === 1 ? "Unread chat" : "Unread chats"}
                  attention={unread > 0}
                />
                <Count
                  value={waiting}
                  label="Waiting for a person"
                  attention={waiting > 0}
                />
              </div>
            )}
            <Button
              asChild
              className="mt-5 self-start"
              variant={caughtUp ? "outline" : "default"}
            >
              <Link href="/conversations">
                <Inbox className="size-4" />
                Open inbox
              </Link>
            </Button>
          </div>
        </div>
        {failed > 0 && (
          <Link
            href="/broadcasts"
            className="flex items-center gap-2 border-t bg-amber-50/60 px-5 py-3 text-sm text-amber-900 transition hover:bg-amber-50"
          >
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">
              {formatCount(failed)} broadcast{" "}
              {failed === 1 ? "message" : "messages"} failed in the last 7 days
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-medium">
              View
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
        )}
      </div>

      <Link
        href="/analytics"
        className="group flex flex-col rounded-lg border bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md lg:col-span-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">
              Messages today
            </h2>
            <p className="mt-3 font-heading text-4xl font-semibold tabular-nums">
              {formatCount(received + sent)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCount(received)} received · {formatCount(sent)} sent
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
        <div className="mt-auto pt-5">
          <div
            className="flex h-16 items-end gap-1.5"
            role="img"
            aria-label={`Messages over the last 7 days: ${week
              .map(
                (day) =>
                  `${longDayFormat.format(dayDate(day.date))} ${day.received + day.sent}`
              )
              .join(", ")}`}
          >
            {week.map((day, index) => {
              const total = day.received + day.sent;
              const isToday = index === week.length - 1;
              return (
                <div
                  key={day.date}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${longDayFormat.format(dayDate(day.date))}: ${formatCount(day.received)} received, ${formatCount(day.sent)} sent`}
                >
                  {total === 0 ? (
                    <div className="h-0.5 rounded-full bg-muted" />
                  ) : (
                    <div
                      className="flex flex-col overflow-hidden rounded-sm"
                      style={{
                        height: `${Math.max(8, (total / busiest) * 100)}%`
                      }}
                    >
                      <div
                        className={cn(
                          "min-h-0",
                          isToday ? "bg-primary/45" : "bg-primary/20"
                        )}
                        style={{ flexGrow: day.sent }}
                      />
                      <div
                        className={cn(
                          "min-h-0",
                          isToday ? "bg-primary" : "bg-primary/55"
                        )}
                        style={{ flexGrow: day.received }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {week.map((day, index) => (
              <span
                key={day.date}
                className={cn(
                  "flex-1 text-center text-[10px] text-muted-foreground",
                  index === week.length - 1 && "font-semibold text-foreground"
                )}
              >
                {index === week.length - 1
                  ? "Today"
                  : weekdayFormat.format(dayDate(day.date))}
              </span>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-xs bg-primary" />
              Received
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-xs bg-primary/45" />
              Sent
            </span>
          </p>
        </div>
      </Link>
    </section>
  );
}
