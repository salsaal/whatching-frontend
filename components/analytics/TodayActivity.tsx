import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Hand, Inbox, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { getDashboardAnalytics } from "@/client-api/functions/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/displayFormat";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

// Today's date as the analytics API keys its days ("2026-11-19"), in the
// viewer's timezone, which is the one the request asks for.
const todayKey = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

/**
 * What needs a person today, for the top of Overview: unread chats, chats
 * waiting for a person, today's messages and failed broadcast messages this
 * week. Uses the same dashboard data as Analytics.
 */
export function TodayActivity() {
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[88px] rounded-lg" />
        ))}
      </div>
    );
  }

  const key = todayKey(dashboard.range.timezone || timezone);
  const today = dashboard.messageActivity.find((row) => row.date === key);
  const received = Number(today?.inbound || 0);
  const sent = Number(today?.outbound || 0);
  const unread = dashboard.cards.unreadConversations || 0;
  const waiting = dashboard.conversationStatus.pending || 0;
  const failed = dashboard.broadcastPerformance.failed || 0;

  const items = [
    {
      label: "Unread chats",
      value: formatCount(unread),
      detail: unread ? "Open the inbox to reply" : "You're all caught up",
      icon: Inbox,
      href: "/conversations",
      attention: unread > 0
    },
    {
      label: "Waiting for a person",
      value: formatCount(waiting),
      detail: waiting
        ? "Chats handed over to your team"
        : "No chats are waiting",
      icon: Hand,
      href: "/conversations",
      attention: waiting > 0
    },
    {
      label: "Messages today",
      value: formatCount(received + sent),
      detail: `${formatCount(received)} received · ${formatCount(sent)} sent`,
      icon: MessagesSquare,
      href: "/analytics",
      attention: false
    },
    {
      label: "Failed broadcast messages",
      value: formatCount(failed),
      detail: failed ? "In the last 7 days" : "None in the last 7 days",
      icon: AlertTriangle,
      href: "/broadcasts",
      attention: failed > 0
    }
  ];

  return (
    <section aria-label="Today" className="space-y-2">
      <h2 className="font-heading text-lg font-semibold">Today</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-start justify-between gap-3 rounded-lg border bg-white p-4 shadow-xs transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-heading text-2xl font-semibold">
                  {item.value}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-sm",
                  item.attention
                    ? "bg-amber-50 text-amber-600"
                    : "bg-primary/10 text-primary"
                )}
              >
                <Icon className="size-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
