import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import type {
  StoreCustomStatusRule,
  StoreOrder,
  StoreOrderStatus,
  StorePlatform
} from "@/client-api/types/stores.type";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { useStoreApi } from "@/components/store/StoreApiContext";
import {
  StoreContactLink,
  StoreLogPagination
} from "@/components/store/StoreLogParts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWhen } from "@/lib/displayFormat";
import { badgeToneClass } from "@/lib/statusPresentation";
import {
  COD_STATE_LABELS,
  formatOrderNumber,
  formatOrderTotal,
  humanizeStatus,
  storeErrorMessage,
  storeMessageStatusPresentation,
  storeMessageTitle
} from "@/lib/store";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function OrderMessages({
  order,
  customRules,
  platform
}: {
  order: StoreOrder;
  customRules: StoreCustomStatusRule[];
  platform?: StorePlatform;
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
          <li key={`${message.kind}-${index}`} className="text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">
                {storeMessageTitle(message.kind, customRules, platform)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-px text-[11px] font-medium",
                  badgeToneClass[status.tone]
                )}
              >
                {status.label}
              </span>
            </div>
            {note && (
              <p className="mt-0.5 max-w-xs text-muted-foreground">{note}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Section G: recent orders and what was sent for each, 25 a page. */
export function StoreOrderLog({
  connectionId,
  customRules = [],
  statuses = [],
  platform
}: {
  connectionId: string;
  customRules?: StoreCustomStatusRule[];
  statuses?: StoreOrderStatus[];
  platform?: StorePlatform;
}) {
  const api = useStoreApi();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: api.ordersKey(connectionId, page),
    queryFn: () => api.getOrders({ connectionId, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000
  });
  const orders = data?.data.orders || [];
  const total = data?.data.total || 0;
  const statusName = (slug: string) =>
    statuses.find((status) => status.slug === slug)?.name ||
    humanizeStatus(slug);

  return (
    <section className="rounded-lg border bg-white shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b p-4 sm:p-5">
        <div>
          <h2 className="font-heading text-xl font-semibold">Orders</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Orders from your store and the messages sent for each.
          </p>
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
              "Your orders couldn't be loaded. Please try again."
            )}
          />
        </div>
      ) : isLoading ? (
        <div className="space-y-3 p-4 sm:p-5">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      ) : !orders.length ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No orders yet. New orders from your store show up here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Placed</th>
                <th className="px-4 py-2 font-medium">Cash on delivery</th>
                <th className="px-4 py-2 font-medium">Messages</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {formatOrderNumber(order.orderNumber)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statusName(order.status)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {api.opensChats ? (
                      <StoreContactLink
                        name={order.customerName || "Customer"}
                        subscriberId={order.subscriberId}
                      />
                    ) : (
                      <span>{order.customerName || "Customer"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatOrderTotal(order.total, order.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                    {formatWhen(order.placedAt)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {order.cod?.state ? (
                      <span>{COD_STATE_LABELS[order.cod.state]}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <OrderMessages
                      order={order}
                      customRules={customRules}
                      platform={platform}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StoreLogPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        noun="orders"
        onPageChange={setPage}
      />
    </section>
  );
}
