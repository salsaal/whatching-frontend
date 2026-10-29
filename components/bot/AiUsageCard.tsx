import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Coins, Plus } from "lucide-react";

import { getAiTokenUsage } from "@/client-api/functions/organizations";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

// 3 significant digits keeps "2.99M" from rounding up to "3M", while
// round numbers stay short ("3M", "500K").
const tokenFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3
});
const exactFormat = new Intl.NumberFormat("en-IN");

function Tokens({ value, className }: { value: number; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-default", className)}>
          {tokenFormat.format(value)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{exactFormat.format(value)} tokens</TooltipContent>
    </Tooltip>
  );
}

const daysUntil = (date: string | null) => {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
};

const formatPercent = (value: number) =>
  value > 0 && value < 10 ? value.toFixed(1) : String(Math.round(value));

// Owner-only (the caller gates it): tokens left this cycle at a glance,
// with the plan allowance bar and any top-up balance alongside.
export function AiUsageCard() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );

  const hasTokenPlan =
    Boolean(activeOrganization) &&
    activeOrganization?.planTier !== "none" &&
    activeOrganization?.subscriptionStatus !== "trialing";

  const { data, isLoading } = useQuery({
    queryKey: ["ai-token-usage", activeOrganization?._id],
    queryFn: getAiTokenUsage,
    enabled: hasTokenPlan,
    refetchOnMount: "always"
  });

  const usage = data?.data.usage;
  const includedLimit = data?.data.includedLimit || 0;
  const usedPercent = includedLimit
    ? Math.min(100, ((usage?.used || 0) / includedLimit) * 100)
    : 0;
  const resetsIn = daysUntil(usage?.cycleResetsAt ?? null);

  return (
    <section
      id="usage"
      className="scroll-mt-24 rounded-lg bg-white p-5 shadow-xs"
    >
      {!hasTokenPlan ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="size-4 shrink-0" />
          Token usage is available on active Basic or Pro plans.
        </p>
      ) : isLoading || !usage ? (
        <Skeleton className="h-20" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              AI tokens left
            </p>
            <Tokens
              value={usage.remaining}
              className="font-heading text-3xl font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Resets {formatDate(usage.cycleResetsAt)}
              {resetsIn !== null &&
                ` · ${
                  resetsIn === 0
                    ? "today"
                    : `in ${resetsIn} day${resetsIn === 1 ? "" : "s"}`
                }`}
            </p>
          </div>

          <div className="min-w-0 space-y-2">
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label="Plan tokens used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedPercent)}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  usedPercent >= 95
                    ? "bg-red-500"
                    : usedPercent >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                )}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <Tokens
                  value={usage.used}
                  className="font-medium text-foreground"
                />{" "}
                of <Tokens value={includedLimit} /> plan tokens used (
                {formatPercent(usedPercent)}%)
              </p>
            </div>
            {usage.topUpRemaining > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      <Plus className="size-3" />
                      {tokenFormat.format(usage.topUpRemaining)} top-up tokens
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {exactFormat.format(usage.topUpRemaining)} tokens
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground">
                  Used after your plan tokens run out
                </span>
              </div>
            )}
            {usage.remaining <= 0 ? (
              <p className="flex gap-1.5 text-xs font-medium text-red-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                AI replies are paused until you top up or the cycle resets.
              </p>
            ) : usedPercent >= 80 ? (
              <p className="flex gap-1.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                You&apos;ve used {formatPercent(usedPercent)}% of this
                cycle&apos;s plan tokens.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
