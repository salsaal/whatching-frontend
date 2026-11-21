import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { getStoreCarts } from "@/client-api/functions/stores";
import type { StoreCart } from "@/client-api/types/stores.type";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  StoreContactLink,
  StoreLogPagination
} from "@/components/store/StoreLogParts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatRelative } from "@/lib/displayFormat";
import { badgeToneClass } from "@/lib/statusPresentation";
import {
  formatOrderTotal,
  storeErrorMessage,
  storeMessageStatusPresentation
} from "@/lib/store";
import {
  formatRecoveredTotals,
  storeCartStatusPresentation
} from "@/lib/storeCarts";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function CartReminders({ cart }: { cart: StoreCart }) {
  if (!cart.reminders.length) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <ul className="space-y-1.5">
      {cart.reminders.map((reminder) => {
        const status = storeMessageStatusPresentation(reminder.status);
        return (
          <li key={reminder.step} className="text-xs">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-px text-[11px] font-medium",
                badgeToneClass[status.tone]
              )}
            >
              Reminder {reminder.step}: {status.label}
            </span>
            {reminder.reason && (
              <p className="mt-0.5 max-w-xs text-muted-foreground">
                {reminder.reason}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Shoppers who left checkout, and the reminders each got. 25 a page. */
export function StoreCartLog({ connectionId }: { connectionId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["store-carts", connectionId, page],
    queryFn: () => getStoreCarts({ connectionId, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000
  });
  const carts = data?.data.carts || [];
  const total = data?.data.total || 0;
  const summary = data?.data.summary;
  const recoveredAmounts = formatRecoveredTotals(summary?.recoveredTotals);

  return (
    <section className="rounded-lg border bg-white shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
        <div>
          <h2 className="font-heading text-xl font-semibold">Carts</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Shoppers who left checkout and the reminders sent to each.
          </p>
          {summary && (
            <div className="mt-3">
              <p className="text-sm">
                <span className="font-semibold">Recovered:</span>{" "}
                {formatCount(summary.recoveredCount)}{" "}
                {summary.recoveredCount === 1 ? "cart" : "carts"}
                {recoveredAmounts && ` · ${recoveredAmounts}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Carts that became orders after a reminder.
              </p>
            </div>
          )}
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isError ? (
        <div className="p-4 sm:p-5">
          <QueryErrorState
            message={storeErrorMessage(
              error,
              "Your carts couldn't be loaded. Please try again."
            )}
          />
        </div>
      ) : isLoading ? (
        <div className="space-y-3 p-4 sm:p-5">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      ) : !carts.length ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No carts yet. When a shopper types their phone number at checkout and
          leaves, it shows up here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Shopper</th>
                <th className="px-4 py-2 font-medium">Cart</th>
                <th className="px-4 py-2 font-medium">Last activity</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Reminders</th>
              </tr>
            </thead>
            <tbody>
              {carts.map((cart) => {
                const status = storeCartStatusPresentation(cart);
                return (
                  <tr
                    key={cart.id}
                    className="border-b align-top last:border-0"
                  >
                    <td className="px-4 py-3">
                      <StoreContactLink
                        name={cart.customerName || "Shopper"}
                        subscriberId={cart.subscriberId}
                        noun="shopper"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-xs">{cart.items || "-"}</p>
                      {cart.total && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatOrderTotal(
                            cart.total,
                            cart.currency || undefined
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      {formatRelative(cart.lastActivityAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-px text-[11px] font-medium",
                          badgeToneClass[status.tone]
                        )}
                      >
                        {status.label}
                      </span>
                      {status.help && (
                        <p className="mt-0.5 max-w-[14rem] text-xs text-muted-foreground">
                          {status.help}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CartReminders cart={cart} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <StoreLogPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        noun="carts"
        onPageChange={setPage}
      />
    </section>
  );
}
