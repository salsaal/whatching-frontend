import { useQuery } from "@tanstack/react-query";

import { getStoreSummary } from "@/client-api/functions/stores";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreView } from "@/hooks/useStoreView";
import { storeSummaryTiles } from "@/lib/storePage";

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

const GRID = "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3";

/**
 * Four numbers for this month under the store card. A skeleton while they
 * load; hidden if they can't be loaded, so the page still works.
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
          <Skeleton key={index} className="h-[104px] rounded-lg" />
        ))}
      </div>
    );
  }
  const tiles = storeSummaryTiles(data.data, { pluginLinked });
  return (
    <div className={GRID}>
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className="rounded-lg border bg-white px-4 py-3.5 shadow-xs"
        >
          <p className="text-sm text-muted-foreground">{tile.label}</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">
            {tile.value}
          </p>
          {tile.opens ? (
            <button
              type="button"
              className="mt-0.5 min-h-11 cursor-pointer text-left text-sm font-medium text-primary hover:underline sm:min-h-0"
              onClick={() =>
                onOpenActivity({
                  tab: "activity",
                  view: tile.opens?.view,
                  show: tile.opens?.show || "all"
                })
              }
            >
              {tile.sub}
            </button>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">{tile.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
