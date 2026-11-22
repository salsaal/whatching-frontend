import { useQuery } from "@tanstack/react-query";

import { getFreeReplies } from "@/client-api/functions/analytics";
import type { FreeReplyState } from "@/client-api/types/analytics.type";
import {
  FREE_REPLIES_WAITING,
  freeRepliesFooter,
  freeRepliesSubtitle,
  freeReplyRow
} from "@/lib/freeReplies";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

const barClass: Record<FreeReplyState, string> = {
  ok: "bg-slate-400",
  nearly_used: "bg-amber-500",
  used_up: "bg-red-600"
};

const noteClass: Record<FreeReplyState, string> = {
  ok: "text-muted-foreground",
  nearly_used: "text-amber-700",
  used_up: "text-red-700"
};

/**
 * WhatsApp's free customer replies per number this month. Owners and
 * admins only (agents get 403), so render it only on their Analytics view.
 * Hidden while loading, on an error, or when the workspace has no numbers.
 */
export function FreeRepliesCard() {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const { data } = useQuery({
    queryKey: ["analytics-free-replies", orgId],
    queryFn: getFreeReplies,
    enabled: Boolean(orgId)
  });
  const usage = data?.data;
  if (!usage?.numbers?.length) return null;
  const perMonth = usage.freeRepliesPerMonth || 1000;

  return (
    <section className="rounded-lg bg-white p-5 shadow-xs">
      <h2 className="font-heading text-lg font-semibold">
        Free customer replies this month
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {freeRepliesSubtitle(perMonth, usage.resetsOn)}
      </p>

      {usage.lastUpdatedAt ? (
        <ul className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {usage.numbers.map((number) => {
            const row = freeReplyRow(number, perMonth);
            const name =
              number.verifiedName ||
              number.displayPhoneNumber ||
              "WhatsApp number";
            return (
              <li key={number.phoneNumberId} className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                {number.verifiedName && number.displayPhoneNumber && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {number.displayPhoneNumber}
                  </p>
                )}
                <div
                  role="progressbar"
                  aria-label={`Free replies used on ${name}`}
                  aria-valuemin={0}
                  aria-valuemax={perMonth}
                  aria-valuenow={number.freeRepliesUsed}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn("h-full rounded-full", barClass[row.tone])}
                    style={{
                      width: `${row.percent > 0 ? Math.max(row.percent, 2) : 0}%`
                    }}
                  />
                </div>
                <p className="mt-1.5 text-sm tabular-nums">{row.used}</p>
                {row.note && (
                  <p className={cn("text-sm font-medium", noteClass[row.tone])}>
                    {row.note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-sm bg-muted/50 p-4 text-sm text-muted-foreground">
          {FREE_REPLIES_WAITING}
        </p>
      )}

      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        {freeRepliesFooter(perMonth, usage.lastUpdatedAt)}
      </p>
    </section>
  );
}
