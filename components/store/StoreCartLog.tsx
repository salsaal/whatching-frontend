import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { getStoreCarts } from "@/client-api/functions/stores";
import type { StoreCart } from "@/client-api/types/stores.type";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  StoreContactLink,
  StoreEmptyState,
  StoreLogPagination
} from "@/components/store/StoreLogParts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/displayFormat";
import { badgeToneClass } from "@/lib/statusPresentation";
import {
  formatOrderTotal,
  storeErrorMessage,
  storeMessageStatusPresentation
} from "@/lib/store";
import { storeCartStatusPresentation } from "@/lib/storeCarts";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export const storeCartsKey = (connectionId: string, page: number) => [
  "store-carts",
  connectionId,
  page
];

/** One page of a store's carts. */
export function useStoreCartsPage(
  connectionId: string,
  page: number,
  { live = true }: { live?: boolean } = {}
) {
  return useQuery({
    queryKey: storeCartsKey(connectionId, page),
    queryFn: () => getStoreCarts({ connectionId, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 60_000 : false
  });
}

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

/**
 * Shoppers who left checkout, and the reminders each got. 25 a page.
 * `hideWhenEmpty`: render nothing without carts (a disconnected store).
 */
export function StoreCartsTable({
  connectionId,
  live = true,
  hideWhenEmpty = false
}: {
  connectionId: string;
  live?: boolean;
  hideWhenEmpty?: boolean;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useStoreCartsPage(
    connectionId,
    page,
    { live }
  );
  const carts = data?.data.carts || [];
  const total = data?.data.total || 0;

  if (isError) {
    return hideWhenEmpty ? null : (
      <QueryErrorState
        message={storeErrorMessage(
          error,
          "Your carts couldn't be loaded. Please try again."
        )}
      />
    );
  }
  if (isLoading) {
    return hideWhenEmpty ? null : (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    );
  }
  if (!carts.length) {
    return hideWhenEmpty ? null : (
      <StoreEmptyState icon={ShoppingCart}>
        No carts yet. When a shopper types their phone number at checkout and
        leaves, it shows up here.
      </StoreEmptyState>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="relative overflow-x-auto">
        {isFetching && (
          <Loader2 className="absolute top-2.5 right-3 size-4 animate-spin text-muted-foreground" />
        )}
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Shopper</th>
              <th className="px-4 py-2.5 font-medium">Cart</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Reminders</th>
            </tr>
          </thead>
          <tbody>
            {carts.map((cart) => {
              const status = storeCartStatusPresentation(cart);
              return (
                <tr key={cart.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <StoreContactLink
                      name={cart.customerName || "Shopper"}
                      subscriberId={cart.subscriberId}
                      noun="shopper"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(cart.lastActivityAt)}
                    </p>
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
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
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
      <StoreLogPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        noun="carts"
        onPageChange={setPage}
      />
    </div>
  );
}
