import { ConversationCostBreakdownRow } from "@/client-api/types/analytics.type";
import { categorical } from "@/lib/analyticsColors";

const numberFormat = new Intl.NumberFormat("en-IN");

const categoryColor: Record<string, string> = {
  MARKETING: categorical.brand,
  UTILITY: categorical.blue,
  AUTHENTICATION: categorical.orange,
  SERVICE: "#c3c2b7"
};

const categoryLabel: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility",
  AUTHENTICATION: "Authentication",
  SERVICE: "Service"
};

export function CategorySpendCard({
  breakdown,
  formatCost
}: {
  breakdown: ConversationCostBreakdownRow[];
  formatCost: (value: number) => string;
}) {
  const maxCost = Math.max(...breakdown.map((row) => row.cost), 1);

  return (
    <div className="rounded-lg bg-white p-5 shadow-xs">
      <h2 className="font-heading text-lg font-semibold">Where the spend goes</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Meta charges per conversation category.
      </p>

      {breakdown.length === 0 ? (
        <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
          No conversation cost data for this range.
        </div>
      ) : (
        <div className="space-y-5">
          {breakdown.map((row) => {
            const key = row.key.toUpperCase();
            const costPerConvo =
              row.conversationCount > 0 ? row.cost / row.conversationCount : 0;
            return (
              <div key={row.key}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-medium capitalize">
                    {categoryLabel[key] || row.key}
                  </span>
                  <span className="font-semibold">
                    {row.cost > 0 ? formatCost(row.cost) : "Free"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((row.cost / maxCost) * 100, row.cost > 0 ? 2 : 0)}%`,
                      backgroundColor: categoryColor[key] || categorical.blue
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{numberFormat.format(row.conversationCount)} convos</span>
                  <span>{formatCost(costPerConvo)} each</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
