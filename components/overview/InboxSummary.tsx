import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  MessagesSquare
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";

import { getDashboardAnalytics } from "@/client-api/functions/analytics";
import { getConversations } from "@/client-api/functions/chat";
import type {
  Conversation,
  ConversationListParams
} from "@/client-api/types/chat.type";
import { ContactAvatar } from "@/components/inbox/ContactAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { recentDayActivity } from "@/lib/analyticsFormat";
import { formatCount } from "@/lib/displayFormat";
import {
  describeLastMessage,
  formatListTime,
  subscriberName
} from "@/lib/inbox";
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

const LIST_SIZE = 3;

// Opens the chat through the inbox's ?search= link (the same one broadcast
// recipients use): the phone number, or the Instagram username.
const chatHref = (conversation: Conversation) => {
  const subscriber = conversation.subscriberId;
  const term =
    conversation.channel === "instagram"
      ? subscriber?.instagramUsername
      : subscriber?.phoneNumber || subscriber?.waId;
  return term
    ? `/conversations?search=${encodeURIComponent(term)}`
    : "/conversations";
};

const byLatest = (a: Conversation, b: Conversation) =>
  new Date(b.lastMessageAt || b.updatedAt).getTime() -
  new Date(a.lastMessageAt || a.updatedAt).getTime();

function CountPill({ value, label }: { value: number; label: string }) {
  const attention = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        attention
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "bg-muted/40 text-muted-foreground"
      )}
    >
      {attention && <span className="size-1.5 rounded-full bg-amber-500" />}
      <span className="font-semibold tabular-nums">{formatCount(value)}</span>
      {label}
    </span>
  );
}

function ChatRow({ conversation }: { conversation: Conversation }) {
  const unread = conversation.unreadCount > 0;
  const waiting = conversation.status === "pending";
  return (
    <li>
      <Link
        href={chatHref(conversation)}
        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-slate-50"
      >
        <ContactAvatar
          conversation={conversation}
          className="size-9"
          withChannel
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p
              className={cn(
                "truncate text-sm",
                unread ? "font-semibold" : "font-medium"
              )}
            >
              {subscriberName(conversation)}
            </p>
            <span
              className={cn(
                "shrink-0 text-[11px]",
                unread ? "font-medium text-primary" : "text-muted-foreground"
              )}
            >
              {formatListTime(
                conversation.lastMessageAt || conversation.updatedAt
              )}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-xs",
                unread ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {describeLastMessage(conversation.lastMessage)}
            </p>
            {waiting && (
              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800">
                Waiting
              </span>
            )}
            {unread && (
              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {conversation.unreadCount > 99
                  ? "99+"
                  : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function ChatRowsSkeleton() {
  return (
    <div className="space-y-4 pt-1">
      {Array.from({ length: LIST_SIZE }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The chats that need a reply (unread, or waiting for a person), newest
 * first. When there are none, the latest chats instead, so the card still
 * shows what's going on.
 */
function NeedsYouCard({
  failed,
  className
}: {
  failed: number;
  className?: string;
}) {
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  // Same keys as the inbox's lists, so reading a chat there refreshes this.
  const unreadParams: ConversationListParams = {
    unreadOnly: true,
    limit: LIST_SIZE
  };
  const unreadQuery = useQuery({
    queryKey: ["conversations", organizationId, unreadParams],
    queryFn: () => getConversations(unreadParams),
    enabled: Boolean(organizationId),
    staleTime: 30_000
  });
  // Counts cover the whole inbox, whatever the list is filtered to.
  const summary = unreadQuery.data?.data.summary;
  const unreadShown = unreadQuery.data?.data.conversations.length || 0;
  const unread = summary?.unread || 0;
  const waiting = summary?.pending || 0;
  const caughtUp = Boolean(summary) && unread === 0 && waiting === 0;
  const otherParams: ConversationListParams | null = !summary
    ? null
    : waiting > 0 && unreadShown < LIST_SIZE
      ? { status: "pending", limit: LIST_SIZE }
      : caughtUp && summary.total > 0
        ? { limit: LIST_SIZE }
        : null;
  const otherQuery = useQuery({
    queryKey: ["conversations", organizationId, otherParams],
    queryFn: () => getConversations(otherParams || {}),
    enabled: Boolean(organizationId && otherParams),
    staleTime: 30_000
  });

  const chats = useMemo(() => {
    const merged = new Map<string, Conversation>();
    [
      ...(unreadQuery.data?.data.conversations || []),
      ...(otherQuery.data?.data.conversations || [])
    ].forEach((conversation) => merged.set(conversation._id, conversation));
    return Array.from(merged.values()).sort(byLatest).slice(0, LIST_SIZE);
  }, [unreadQuery.data, otherQuery.data]);

  const isLoading =
    unreadQuery.isLoading || (Boolean(otherParams) && otherQuery.isLoading);
  const isEmpty = Boolean(summary) && summary?.total === 0;

  let body: ReactNode;
  if (unreadQuery.isError) {
    body = (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Your chats couldn&apos;t be loaded right now.
      </p>
    );
  } else if (isLoading || !summary) {
    body = <ChatRowsSkeleton />;
  } else if (isEmpty) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessagesSquare className="size-5" />
        </div>
        <p className="mt-3 font-medium">No chats yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          When customers message you, their chats show up here.
        </p>
      </div>
    );
  } else {
    body = (
      <>
        {caughtUp && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Latest chats
          </p>
        )}
        <ul>
          {chats.map((conversation) => (
            <ChatRow key={conversation._id} conversation={conversation} />
          ))}
        </ul>
      </>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-white shadow-xs",
        className
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Needs you
          </h2>
          <Link
            href="/conversations"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open inbox
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {summary && !isEmpty && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {caughtUp ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <CheckCircle2 className="size-3.5" />
                You&apos;re all caught up
              </span>
            ) : (
              <>
                <CountPill
                  value={unread}
                  label={unread === 1 ? "unread chat" : "unread chats"}
                />
                <CountPill value={waiting} label="waiting for a person" />
              </>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-1 flex-col">{body}</div>
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
  );
}

/**
 * The top of Overview: the chats that need a person now (and failed
 * broadcast messages), and today's messages with the week behind them. The
 * chats come from the inbox's list; the messages from the dashboard data
 * Analytics uses.
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

  // Without the dashboard the inbox card takes the whole row.
  if (isError) {
    return (
      <section>
        <NeedsYouCard failed={0} />
      </section>
    );
  }
  if (isLoading || !dashboard) {
    return (
      <section className="grid gap-4 lg:grid-cols-5">
        <NeedsYouCard failed={0} className="lg:col-span-3" />
        <Skeleton className="h-[260px] rounded-lg lg:col-span-2" />
      </section>
    );
  }

  const today = todayKey(dashboard.range.timezone || timezone);
  const week = recentDayActivity(dashboard.messageActivity, today, 7);
  const todayActivity = week[week.length - 1];
  const received = todayActivity?.received || 0;
  const sent = todayActivity?.sent || 0;
  const busiest = Math.max(1, ...week.map((day) => day.received + day.sent));
  const failed = dashboard.broadcastPerformance.failed || 0;

  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <NeedsYouCard failed={failed} className="lg:col-span-3" />

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
