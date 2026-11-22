import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, ShoppingBag } from "lucide-react";
import { useState } from "react";

import { getStoreOrders } from "@/client-api/functions/stores";
import type {
  StoreCustomStatusRule,
  StoreOrder,
  StoreOrderStatus,
  StoreOrdersShow
} from "@/client-api/types/stores.type";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  StoreContactLink,
  StoreEmptyState,
  StoreLogPagination
} from "@/components/store/StoreLogParts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWhen } from "@/lib/displayFormat";
import { type BadgeTone, badgeToneClass } from "@/lib/statusPresentation";
import {
  formatOrderNumber,
  formatOrderTotal,
  humanizeStatus,
  storeErrorMessage,
  storeMessageStatusPresentation
} from "@/lib/store";
import {
  STORE_ORDERS_EMPTY,
  codStatePresentation,
  storePageMessageTitle
} from "@/lib/storePage";
import { cn } from "@/lib/utils";

export const STORE_ORDERS_PAGE_SIZE = 25;

export const storeOrdersKey = (
  connectionId: string,
  page: number,
  show: StoreOrdersShow
) => ["store-orders", connectionId, page, show];

/** One page of a store's orders (the Activity tab and the page share it). */
export function useStoreOrdersPage(
  connectionId: string,
  page: number,
  show: StoreOrdersShow,
  { live = true }: { live?: boolean } = {}
) {
  return useQuery({
    queryKey: storeOrdersKey(connectionId, page, show),
    queryFn: () =>
      getStoreOrders({
        connectionId,
        page,
        limit: STORE_ORDERS_PAGE_SIZE,
        show
      }),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 60_000 : false
  });
}

export const toneTextClass: Partial<Record<BadgeTone, string>> = {
  green: "text-emerald-700",
  amber: "text-amber-800",
  red: "text-red-700",
  blue: "text-sky-700",
  grey: "text-muted-foreground"
};

function OrderMessages({
  order,
  customRules
}: {
  order: StoreOrder;
  customRules: StoreCustomStatusRule[];
}) {
  if (!order.messages.length) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <ul className="space-y-1.5">
      {order.messages.map((message, index) => {
        const status = storeMessageStatusPresentation(message.status);
        const note = message.reason || message.error;
        return (
          <li key={`${message.kind}-${index}`} className="text-sm">
            <span>{storePageMessageTitle(message.kind, customRules)}</span>
            {" · "}
            <span className={cn("font-medium", toneTextClass[status.tone])}>
              {status.label}
            </span>
            {note && (
              <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                {note}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A store's orders and the messages sent for each, 25 a page. `show`
 * narrows it to orders with a message not sent, or COD orders waiting
 * for an answer. Remount it (a `key`) when `show` changes.
 */
export function StoreOrdersTable({
  connectionId,
  show = "all",
  customRules = [],
  statuses = [],
  live = true
}: {
  connectionId: string;
  show?: StoreOrdersShow;
  customRules?: StoreCustomStatusRule[];
  statuses?: StoreOrderStatus[];
  /** Ask again every minute (not for a disconnected store's history). */
  live?: boolean;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useStoreOrdersPage(
    connectionId,
    page,
    show,
    { live }
  );
  const orders = data?.data.orders || [];
  const total = data?.data.total || 0;
  const statusName = (slug: string) =>
    statuses.find((status) => status.slug === slug)?.name ||
    humanizeStatus(slug);

  if (isError) {
    return (
      <QueryErrorState
        message={storeErrorMessage(
          error,
          "Your orders couldn't be loaded. Please try again."
        )}
      />
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    );
  }
  if (!orders.length) {
    return (
      <StoreEmptyState
        icon={
          show === "not_sent"
            ? CheckCircle2
            : show === "cod_waiting"
              ? Clock
              : ShoppingBag
        }
      >
        {STORE_ORDERS_EMPTY[show]}
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
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Total</th>
              <th className="px-4 py-2.5 font-medium">Cash on delivery</th>
              <th className="px-4 py-2.5 font-medium">Messages</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const cod = order.cod?.state
                ? codStatePresentation(order.cod.state)
                : null;
              return (
                <tr key={order.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {formatOrderNumber(order.orderNumber)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[statusName(order.status), formatWhen(order.placedAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StoreContactLink
                      name={order.customerName || "Customer"}
                      subscriberId={order.subscriberId}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatOrderTotal(order.total, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {cod ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                          badgeToneClass[cod.tone]
                        )}
                      >
                        {cod.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <OrderMessages order={order} customRules={customRules} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StoreLogPagination
        page={page}
        pageSize={STORE_ORDERS_PAGE_SIZE}
        total={total}
        noun="orders"
        onPageChange={setPage}
      />
    </div>
  );
}
