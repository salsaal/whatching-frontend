import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  ConversationCostDailyPoint,
  ConversationCostResponse
} from "@/client-api/types/analytics.type";
import { ChartTooltip } from "@/components/analytics/ChartTooltip";
import { categorical, chartInk } from "@/lib/analyticsColors";
import { describeTrend, fillDailyGaps } from "@/lib/analyticsFormat";
import { formatDayKey } from "@/lib/displayFormat";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("en-IN");
const EMPTY_DAILY: ConversationCostDailyPoint[] = [];

const formatDateShort = (dateKey: string) => formatDayKey(dateKey);

function DeltaBadge({
  current,
  previous
}: {
  current: number;
  previous: number;
}) {
  const described = describeTrend({ current, previous, changePercent: 0 });
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

export function SpendHeroCard({
  costs
}: {
  costs: ConversationCostResponse["data"];
}) {
  const totals = costs.totals || {
    conversationCount: 0,
    cost: 0,
    costPerConversation: 0
  };
  const previousPeriod = costs.previousPeriod || {
    conversationCount: 0,
    cost: 0,
    costPerConversation: 0
  };
  const billable = costs.billable || { conversationCount: 0, cost: 0 };
  const freeTier = costs.freeTier || { conversationCount: 0, cost: 0 };
  const rawDaily = costs.daily || EMPTY_DAILY;
  // Meta only reports days that had messages; quiet days are zeros.
  const daily = useMemo(
    () =>
      fillDailyGaps(rawDaily, costs.range?.start, costs.range?.end, (date) => ({
        date,
        conversationCount: 0,
        cost: 0
      })),
    [rawDaily, costs.range?.start, costs.range?.end]
  );

  const billableShare =
    totals.conversationCount > 0
      ? Math.round(
          (billable.conversationCount / totals.conversationCount) * 100
        )
      : 0;

  const { runRate, projected30Day, peakDay } = useMemo(() => {
    const last7 = daily.slice(-7);
    const runRateValue =
      last7.length > 0
        ? last7.reduce((sum, row) => sum + row.conversationCount, 0) /
          last7.length
        : 0;
    const peak = daily.reduce(
      (best, row) =>
        row.conversationCount > (best?.conversationCount ?? -Infinity)
          ? row
          : best,
      daily[0]
    );
    return {
      runRate: runRateValue,
      projected30Day: runRateValue * 30,
      peakDay: peak
    };
  }, [daily]);

  const chartData = daily.map((row) => ({
    ...row,
    label: formatDateShort(row.date)
  }));

  return (
    <div className="rounded-lg bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Messages in this period
          </p>
          <div className="mt-1 flex items-center gap-3">
            <p className="font-heading text-4xl font-semibold">
              {numberFormat.format(totals.conversationCount)}
            </p>
            {previousPeriod.conversationCount > 0 && (
              <DeltaBadge
                current={totals.conversationCount}
                previous={previousPeriod.conversationCount}
              />
            )}
          </div>
          {previousPeriod.conversationCount > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Prior period{" "}
              {numberFormat.format(previousPeriod.conversationCount)} messages
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Charged share</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="font-heading text-4xl font-semibold">
              {billableShare}% charged
            </p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {numberFormat.format(billable.conversationCount)} charged ·{" "}
            {numberFormat.format(freeTier.conversationCount)} free
          </p>
        </div>
      </div>

      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
            <CartesianGrid stroke={chartInk.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: chartInk.axis }}
              axisLine={{ stroke: chartInk.grid }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: chartInk.axis }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => numberFormat.format(value)}
              width={64}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatValue={(value) => numberFormat.format(value)}
                />
              }
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
            />
            <Bar
              dataKey="conversationCount"
              name="Daily message volume"
              fill={categorical.brand}
              fillOpacity={0.55}
              radius={[2, 2, 0, 0]}
              maxBarSize={10}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{chartData[0] ? formatDateShort(chartData[0].date) : ""}</span>
        <span>Daily message volume</span>
        <span>
          {chartData.length
            ? formatDateShort(chartData[chartData.length - 1].date)
            : ""}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t pt-4 text-sm">
        <span className="text-muted-foreground">
          7-day run rate{" "}
          <span className="font-semibold text-foreground">
            {numberFormat.format(Math.round(runRate))} / day
          </span>
        </span>
        <span className="text-muted-foreground">
          Projected 30-day{" "}
          <span className="font-semibold text-foreground">
            {numberFormat.format(Math.round(projected30Day))}
          </span>
        </span>
        {peakDay && (
          <span className="text-muted-foreground">
            Peak day{" "}
            <span className="font-semibold text-foreground">
              {formatDateShort(peakDay.date)} ·{" "}
              {numberFormat.format(peakDay.conversationCount)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
