import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { useState } from "react";

import { getAiTokenUsage } from "@/client-api/functions/organizations";
import { AiUsageTopUp } from "@/components/settings/AiUsageTopUp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/billing";
import { formatCompactNumber } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

// Owner-only (the caller gates it): a one-line usage readout with a top-up
// dialog, instead of a full card.
export function AiUsageStrip() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

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
    ? Math.min(100, Math.round(((usage?.used || 0) / includedLimit) * 100))
    : 0;

  return (
    <section
      id="usage"
      className="flex scroll-mt-24 flex-col gap-3 rounded-lg bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center"
    >
      <Coins className="hidden size-4 shrink-0 text-primary sm:block" />
      {!hasTokenPlan ? (
        <p className="flex-1 text-sm text-muted-foreground">
          Token usage is available on active Basic or Pro plans.
        </p>
      ) : isLoading || !usage ? (
        <Skeleton className="h-5 flex-1" />
      ) : (
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-medium">
              {formatCompactNumber(usage.used)} of{" "}
              {formatCompactNumber(includedLimit)} tokens
              {usage.topUpRemaining > 0 &&
                ` · ${formatCompactNumber(usage.topUpRemaining)} top-up left`}
            </span>
            <span className="text-xs text-muted-foreground">
              Resets {formatDate(usage.cycleResetsAt)}
            </span>
          </div>
          <Progress value={usedPercent} className="h-1.5" />
        </div>
      )}
      {hasTokenPlan && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => setIsTopUpOpen(true)}
        >
          Top up
        </Button>
      )}

      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Top up AI tokens</DialogTitle>
            <DialogDescription>
              Buy extra tokens for AI replies.
            </DialogDescription>
          </DialogHeader>
          <AiUsageTopUp />
        </DialogContent>
      </Dialog>
    </section>
  );
}
