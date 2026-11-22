import type { StoreConnection } from "@/client-api/types/stores.type";
import {
  StoreCartsTable,
  useStoreCartsPage
} from "@/components/store/StoreCartLog";
import { StoreOrdersTable } from "@/components/store/StoreOrdersTable";
import { formatDayMonth, storeHistoryKeptUntil } from "@/lib/storePage";

function PastCarts({ connectionId }: { connectionId: string }) {
  const { data } = useStoreCartsPage(connectionId, 1, { live: false });
  if (!data?.data.carts.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-heading text-base font-semibold">Carts</h3>
      <StoreCartsTable connectionId={connectionId} live={false} hideWhenEmpty />
    </div>
  );
}

/**
 * A disconnected store's orders (and carts), read-only, for the 30 days
 * the backend keeps them.
 */
export function StorePastOrders({
  connection
}: {
  connection: StoreConnection | null;
}) {
  const until = storeHistoryKeptUntil(connection);
  if (!connection || !until || connection.platform !== "woocommerce") {
    return null;
  }
  return (
    <section className="space-y-4 rounded-lg border bg-white p-4 shadow-xs sm:p-5">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          Past orders from {connection.storeName}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Kept until {formatDayMonth(until)}, then deleted.
        </p>
      </div>
      <StoreOrdersTable
        connectionId={connection.id}
        customRules={connection.settings?.customStatusRules || []}
        live={false}
      />
      <PastCarts connectionId={connection.id} />
    </section>
  );
}
