import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  type LucideIcon,
  Send,
  ShoppingCart
} from "lucide-react";

import { getStoreSummary } from "@/client-api/functions/stores";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreView } from "@/hooks/useStoreView";
import { type SummaryTile, storeSummaryTiles } from "@/lib/storePage";
import { cn } from "@/lib/utils";

export const storeSummaryKey = (connectionId: string) => [
  "store-summary",
  connectionId
];

/** This month's summary for a store; the Activity tab reads it too. */
export function useStoreSummary(connectionId: string) {
  return useQuery({
    queryKey: storeSummaryKey(connectionId),
    queryFn: () => getStoreSummary(connectionId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1
  });
}

const ICONS: Record<SummaryTile["id"], LucideIcon> = {
  orders: Send,
  cod: Banknote,
  carts: ShoppingCart,
  notSent: AlertTriangle
};

// 1px gaps over a border-coloured background draw the dividers in any
// layout (as on Overview): two columns on a phone, four on a wide screen.
const GRID = "grid grid-cols-2 gap-px border-t bg-border lg:grid-cols-4";

/**
 * This month's four numbers, as a strip at the bottom of the store card.
 * A skeleton while they load; nothing if they can't be loaded, so the page
 * still works.
 */
export function StoreSummaryRow({
  connectionId,
  pluginLinked,
  onOpenActivity
}: {
  connectionId: string;
  pluginLinked: boolean;
  onOpenActivity: (view: Partial<StoreView>) => void;
}) {
  const { data, isLoading, isError } = useStoreSummary(connectionId);
  if (isError) return null;
  if (isLoading || !data) {
    return (
      <div className={GRID} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2 bg-white p-4 sm:p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }
  const tiles = storeSummaryTiles(data.data, { pluginLinked });
  return (
    <div className={GRID} aria-label="This month">
      {tiles.map((tile) => {
        const problem = tile.id === "notSent" && Boolean(tile.opens);
        const Icon =
          tile.id === "notSent" && !problem ? CheckCircle2 : ICONS[tile.id];
        const content = (
          <>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  problem && "text-amber-600",
                  tile.id === "notSent" && !problem && "text-primary"
                )}
              />
              <span className="truncate">{tile.label}</span>
            </p>
            <p
              className={cn(
                "mt-2 truncate font-heading text-2xl font-semibold tabular-nums",
                problem && "text-amber-700"
              )}
            >
              {tile.value}
            </p>
            <p
              className={cn(
                "mt-1.5 flex flex-wrap items-center gap-x-1 text-xs",
                tile.opens
                  ? "font-medium text-primary"
                  : "text-muted-foreground"
              )}
            >
              {tile.sub}
              {tile.opens && <ArrowRight className="size-3 shrink-0" />}
            </p>
          </>
        );
        return tile.opens ? (
          <button
            key={tile.id}
            type="button"
            className="min-w-0 cursor-pointer bg-white p-4 text-left transition hover:bg-slate-50 sm:p-5"
            onClick={() =>
              onOpenActivity({
                tab: "activity",
                view: tile.opens?.view,
                show: tile.opens?.show || "all"
              })
            }
          >
            {content}
          </button>
        ) : (
          <div key={tile.id} className="min-w-0 bg-white p-4 sm:p-5">
            {content}
          </div>
        );
      })}
    </div>
  );
}
