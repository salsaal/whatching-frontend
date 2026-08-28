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
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("en-IN");
const EMPTY_DAILY: ConversationCostDailyPoint[] = [];

const formatDateShort = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });

function DeltaBadge({
  percent,
  invertColor = false
}: {
  percent: number;
  invertColor?: boolean;
}) {
  const isIncrease = percent > 0;
  const isDecrease = percent < 0;
  const Icon = isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;
  const isGood = invertColor ? isDecrease : isIncrease;
  const isBad = invertColor ? isIncrease : isDecrease;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isGood
          ? "bg-emerald-50 text-emerald-700"
          : isBad
            ? "bg-red-50 text-red-700"
            : "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-3" />
      {isIncrease ? "+" : ""}
      {percent}%
    </span>
  );
}

export function SpendHeroCard({
  costs,
  formatCost
}: {
  costs: ConversationCostResponse["data"];
  formatCost: (value: number) => string;
}) {
  const totals = costs.totals || { conversationCount: 0, cost: 0, costPerConversation: 0 };
  const previousPeriod = costs.previousPeriod || {
    conversationCount: 0,
    cost: 0,
    costPerConversation: 0
  };
  const billable = costs.billable || { conversationCount: 0, cost: 0 };
  const freeTier = costs.freeTier || { conversationCount: 0, cost: 0 };
  const daily = costs.daily || EMPTY_DAILY;

  const spendChangePercent =
    previousPeriod.cost > 0
      ? Math.round(((totals.cost - previousPeriod.cost) / previousPeriod.cost) * 1000) / 10
      : 0;
  const costPerConvoChangePercent =
    previousPeriod.costPerConversation > 0
      ? Math.round(
          ((totals.costPerConversation - previousPeriod.costPerConversation) /
            previousPeriod.costPerConversation) *
            1000
        ) / 10
      : 0;
  const volumeChangePercent =
    previousPeriod.conversationCount > 0
      ? ((totals.conversationCount - previousPeriod.conversationCount) /
          previousPeriod.conversationCount) *
        100
      : 0;

  const insight =
    previousPeriod.cost > 0 && previousPeriod.conversationCount > 0
      ? volumeChangePercent > spendChangePercent
        ? "volume grew faster than cost"
        : volumeChangePercent < spendChangePercent
          ? "cost grew faster than volume"
          : "cost tracked volume evenly"
      : null;

  const { runRate, projected30Day, peakDay } = useMemo(() => {
    const last7 = daily.slice(-7);
    const runRateValue =
      last7.length > 0
        ? last7.reduce((sum, row) => sum + row.cost, 0) / last7.length
        : 0;
    const peak = daily.reduce(
      (best, row) => (row.cost > (best?.cost ?? -Infinity) ? row : best),
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
            Conversation spend · period total
          </p>
          <div className="mt-1 flex items-center gap-3">
            <p className="font-heading text-4xl font-semibold">
              {formatCost(totals.cost)}
            </p>
            {previousPeriod.cost > 0 && <DeltaBadge percent={spendChangePercent} />}
          </div>
          {insight && (
            <p className="mt-2 text-sm text-muted-foreground">
              Prior period {formatCost(previousPeriod.cost)} · {insight}
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Cost per conversation</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="font-heading text-4xl font-semibold">
              {formatCost(totals.costPerConversation)}
            </p>
            {previousPeriod.costPerConversation > 0 && (
              <DeltaBadge percent={costPerConvoChangePercent} invertColor />
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {numberFormat.format(billable.conversationCount)} billable ·{" "}
            {numberFormat.format(freeTier.conversationCount)} free-tier
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
              tickFormatter={(value) => formatCost(value)}
              width={64}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatValue={(value) => formatCost(value)}
                />
              }
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
            />
            <Bar
              dataKey="cost"
              name="Daily conversation spend"
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
        <span>Daily conversation spend</span>
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
            {formatCost(runRate)} / day
          </span>
        </span>
        <span className="text-muted-foreground">
          Projected 30-day{" "}
          <span className="font-semibold text-foreground">
            {formatCost(projected30Day)}
          </span>
        </span>
        {peakDay && (
          <span className="text-muted-foreground">
            Peak day{" "}
            <span className="font-semibold text-foreground">
              {formatDateShort(peakDay.date)} · {formatCost(peakDay.cost)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
