import type {
  StoreConnection,
  StoreOrderStatus
} from "@/client-api/types/stores.type";
import { StoreCartsTable } from "@/components/store/StoreCartLog";
import { StoreOrdersTable } from "@/components/store/StoreOrdersTable";
import { useStoreSummary } from "@/components/store/StoreSummaryRow";
import type { StoreView } from "@/hooks/useStoreView";
import { formatCount } from "@/lib/displayFormat";
import { STORE_ORDER_FILTERS, recoveredThisMonth } from "@/lib/storePage";
import { cn } from "@/lib/utils";

/** Activity: Orders (with filters) or Carts. */
export function StoreActivityTab({
  connection,
  statuses,
  view,
  onChange,
  showCarts
}: {
  connection: StoreConnection;
  statuses: StoreOrderStatus[];
  view: StoreView;
  onChange: (next: Partial<StoreView>) => void;
  /** WooCommerce stores with the cart plugin field. */
  showCarts: boolean;
}) {
  const summary = useStoreSummary(connection.id).data?.data;
  const notSentOrders = summary?.notSent.orders || 0;
  const linked = connection.plugin?.connected === true;
  const isCarts = showCarts && view.view === "carts";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {showCarts ? (
          <div
            className="inline-flex w-fit rounded-lg bg-muted p-1"
            role="group"
            aria-label="Show"
          >
            {(["orders", "carts"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={view.view === entry}
                onClick={() => onChange({ view: entry })}
                className={cn(
                  "min-h-11 cursor-pointer rounded-md px-4 text-sm font-medium text-muted-foreground transition sm:min-h-9",
                  view.view === entry && "bg-white text-foreground shadow-xs"
                )}
              >
                {entry === "orders" ? "Orders" : "Carts"}
              </button>
            ))}
          </div>
        ) : (
          <h3 className="font-heading text-base font-semibold">Orders</h3>
        )}
        {!isCarts && (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter orders"
          >
            {STORE_ORDER_FILTERS.map((filter) => {
              const selected = view.show === filter.id;
              const count =
                filter.id === "not_sent" && notSentOrders > 0
                  ? notSentOrders
                  : null;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ show: filter.id })}
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition sm:min-h-8",
                    selected
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "bg-white text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter.label}
                  {count !== null && (
                    <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">
                      {formatCount(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isCarts ? (
        linked ? (
          <div className="space-y-3">
            {summary && (
              <p className="text-sm">
                <span className="font-semibold">
                  {recoveredThisMonth(summary)}
                </span>{" "}
                <span className="text-muted-foreground">
                  · Carts that became orders after a reminder.
                </span>
              </p>
            )}
            <StoreCartsTable connectionId={connection.id} />
          </div>
        ) : (
          <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            Link the cart plugin to see carts here.
          </p>
        )
      ) : (
        <StoreOrdersTable
          key={view.show}
          connectionId={connection.id}
          show={view.show}
          customRules={connection.settings?.customStatusRules || []}
          statuses={statuses}
        />
      )}
    </div>
  );
}
