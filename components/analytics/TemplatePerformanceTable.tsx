import { TemplateAnalyticsRow } from "@/client-api/types/analytics.type";
import { Badge } from "@/components/ui/badge";
import { status } from "@/lib/analyticsColors";

const numberFormat = new Intl.NumberFormat("en-IN");

const qualityLabel: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  GREEN: { label: "High", variant: "default" },
  YELLOW: { label: "Medium", variant: "secondary" },
  RED: { label: "Low", variant: "outline" }
};

export function TemplatePerformanceTable({
  templates,
  formatCost
}: {
  templates: TemplateAnalyticsRow[];
  formatCost: (value: number) => string;
}) {
  const sorted = [...templates].sort((a, b) => b.sent - a.sent);
  const totalSent = sorted.reduce((sum, t) => sum + t.sent, 0);
  const topSixShare =
    totalSent > 0
      ? Math.round(
          (sorted.slice(0, 6).reduce((sum, t) => sum + t.sent, 0) / totalSent) * 100
        )
      : 0;

  return (
    <div className="rounded-lg bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">Template performance</h2>
        {sorted.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {sorted.length >= 6
              ? `Top six templates carry ${topSixShare}% of outgoing volume. `
              : ""}
            Read rate is the column that moves revenue.
          </p>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
          No template analytics for this range.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-3 pr-3">Template</th>
                <th className="pb-3 pr-3">Category</th>
                <th className="pb-3 pr-3 text-right">Sent</th>
                <th className="pb-3 pr-3 text-right">Delivered</th>
                <th className="pb-3 pr-3">Read rate</th>
                <th className="pb-3 pr-3 text-right">CTR</th>
                <th className="pb-3 pr-3 text-right">Cost</th>
                <th className="pb-3 text-right">Quality</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((template) => {
                const totalClicks = template.clicks.reduce(
                  (sum, click) => sum + click.count,
                  0
                );
                const deliveredRate =
                  template.sent > 0 ? (template.delivered / template.sent) * 100 : 0;
                const readRate =
                  template.delivered > 0 ? (template.read / template.delivered) * 100 : 0;
                const ctr =
                  template.clicks.length > 0 && template.delivered > 0
                    ? (totalClicks / template.delivered) * 100
                    : null;
                const quality = template.qualityScore
                  ? qualityLabel[template.qualityScore.toUpperCase()]
                  : null;

                return (
                  <tr key={template.templateId} className="border-t">
                    <td className="py-3 pr-3 font-medium">
                      {template.name || template.templateId}
                    </td>
                    <td className="py-3 pr-3 capitalize text-muted-foreground">
                      {template.category?.toLowerCase() || "—"}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {numberFormat.format(template.sent)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {deliveredRate.toFixed(1)}%
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(readRate, 100)}%`,
                              backgroundColor:
                                readRate >= 60 ? status.good : status.warning
                            }}
                          />
                        </div>
                        <span className="tabular-nums">{readRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {ctr === null ? "—" : `${ctr.toFixed(1)}%`}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {formatCost(template.amountSpent)}
                    </td>
                    <td className="py-3 text-right">
                      {quality ? (
                        <Badge variant={quality.variant}>{quality.label}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
