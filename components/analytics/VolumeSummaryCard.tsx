import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { AnalyticsTrend } from "@/client-api/types/analytics.type";
import { categorical } from "@/lib/analyticsColors";
import { describeTrend } from "@/lib/analyticsFormat";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("en-IN");

interface VolumeRow {
  label: string;
  value: string;
  trend?: AnalyticsTrend;
  /** A rate moves in points, not as a percentage of itself. */
  trendKind?: "count" | "rate";
  sparkline?: number[];
}

function TrendChip({
  trend,
  kind
}: {
  trend: AnalyticsTrend;
  kind?: "count" | "rate";
}) {
  const described = describeTrend(trend, kind);
  if (!described) return null;
  const Icon =
    described.direction === "up"
      ? TrendingUp
      : described.direction === "down"
        ? TrendingDown
        : Minus;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        described.direction === "up"
          ? "bg-emerald-50 text-emerald-700"
          : described.direction === "down"
            ? "bg-red-50 text-red-700"
            : "bg-muted text-muted-foreground"
      )}
      title={described.title}
    >
      <Icon className="size-3" />
      {described.label}
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const points = data.map((value, index) => ({ index, value }));
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <Area
            type="monotone"
            dataKey="value"
            stroke={categorical.brand}
            strokeWidth={1.5}
            fill={categorical.brand}
            fillOpacity={0.15}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VolumeSummaryCard({ rows }: { rows: VolumeRow[] }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Volume summary</h2>
        <span className="text-xs text-muted-foreground">vs. prior period</span>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{row.label}</p>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {row.value}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {row.trend && (
                <TrendChip trend={row.trend} kind={row.trendKind} />
              )}
              {row.sparkline && row.sparkline.length > 1 && (
                <Sparkline data={row.sparkline} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { numberFormat };
