import { useQuery } from "@tanstack/react-query";
import { Coins, TrendingUp, Wallet } from "lucide-react";

import { getAiTokenUsage } from "@/client-api/functions/organizations";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

export function AiUsageSummary() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );

  const canUseAiTokenTopup =
    Boolean(activeOrganization) &&
    activeOrganization?.planTier !== "none" &&
    activeOrganization?.subscriptionStatus !== "trialing";

  const { data, isLoading } = useQuery({
    queryKey: ["ai-token-usage", activeOrganization?._id],
    queryFn: getAiTokenUsage,
    enabled: canUseAiTokenTopup,
    refetchOnMount: "always"
  });

  if (!canUseAiTokenTopup) {
    return (
      <p className="text-sm text-muted-foreground">
        Token usage is available on active Basic or Pro plans.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-1.5 w-full" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  const usage = data?.data.usage;
  const includedLimit = data?.data.includedLimit || 0;
  if (!usage) return null;

  const includedUsed = Math.max(
    0,
    includedLimit - Math.max(0, usage.includedRemaining)
  );
  const includedUsedPercent = includedLimit
    ? Math.min(100, Math.round((includedUsed / includedLimit) * 100))
    : 0;

  const stats = [
    {
      icon: Coins,
      label: "Plan tokens left",
      value: `${formatCompactNumber(Math.max(0, usage.includedRemaining))} / ${formatCompactNumber(includedLimit)}`
    },
    {
      icon: Wallet,
      label: "Top-up tokens left",
      value: formatCompactNumber(Math.max(0, usage.topUpRemaining))
    },
    {
      icon: TrendingUp,
      label: "Used this cycle",
      value: formatCompactNumber(usage.used)
    }
  ];

  return (
    <div className="space-y-3">
      <div>
        <Progress value={includedUsedPercent} className="h-1.5" />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {includedUsedPercent}% of plan tokens used this cycle
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border p-3">
              <div className="flex size-8 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{stat.label}</p>
              <p className="font-heading text-sm font-semibold">{stat.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
