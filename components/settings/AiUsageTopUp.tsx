import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  getAiTokenPackages,
  getAiTokenUsage,
  topupAiTokens
} from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/billing";
import { formatCompactNumber } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

function AiUsageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-5" />
      ))}
    </div>
  );
}

export function AiUsageTopUp() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );

  const canUseAiTokenTopup =
    Boolean(activeOrganization) &&
    activeOrganization?.planTier !== "none" &&
    activeOrganization?.subscriptionStatus !== "trialing";

  const { data: aiTokenPackagesData } = useQuery({
    queryKey: ["ai-token-packages"],
    queryFn: getAiTokenPackages,
    enabled: canUseAiTokenTopup
  });

  const { data: aiTokenUsageData, isLoading: isLoadingAiTokenUsage } = useQuery(
    {
      queryKey: ["ai-token-usage", activeOrganization?._id],
      queryFn: getAiTokenUsage,
      enabled: canUseAiTokenTopup,
      refetchOnMount: "always"
    }
  );

  const { mutate: topupAiTokensMutate, isPending: isToppingUpAiTokens } =
    useMutation({
      mutationFn: topupAiTokens,
      meta: { showToast: false },
      onSuccess: (res) => {
        window.open(res.data.paymentUrl, "_blank", "noopener,noreferrer");
      }
    });

  const aiTokenPackages = aiTokenPackagesData?.data.packages || [];
  const aiTokenUsage = aiTokenUsageData?.data.usage;
  const aiTokenIncludedLimit = aiTokenUsageData?.data.includedLimit || 0;

  if (!canUseAiTokenTopup) {
    return (
      <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        AI token usage and top-ups are available on active Basic or Pro plans.
      </div>
    );
  }

  if (isLoadingAiTokenUsage) {
    return <AiUsageSkeleton />;
  }

  return (
    <>
      {aiTokenUsage && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Included plan tokens
            </p>
            <p className="mt-1 font-heading text-lg font-semibold">
              {formatCompactNumber(Math.max(0, aiTokenUsage.includedRemaining))}{" "}
              / {formatCompactNumber(aiTokenIncludedLimit)} remaining
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Top-up tokens remaining
            </p>
            <p className="mt-1 font-heading text-lg font-semibold">
              {formatCompactNumber(Math.max(0, aiTokenUsage.topUpRemaining))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Used this cycle</p>
            <p className="mt-1 font-heading text-lg font-semibold">
              {formatCompactNumber(aiTokenUsage.used)}
            </p>
          </div>
        </div>
      )}

      {!activeOrganization?.billingProfile ? (
        <p className="mb-4 rounded-sm bg-amber-50 p-3 text-sm text-amber-800">
          Complete your billing profile in{" "}
          <Link href="/settings/billing" className="underline">
            Billing
          </Link>{" "}
          before purchasing AI tokens so we can issue a GST invoice.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {aiTokenPackages.map((pkg) => (
          <div
            key={pkg.packageId}
            className="flex flex-col justify-between rounded-sm border p-4"
          >
            <div>
              <p className="font-heading text-lg font-semibold">{pkg.label}</p>
              <p className="text-sm text-muted-foreground">
                {formatCompactNumber(pkg.tokens)} tokens
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatCurrency(pkg.baseAmountPaise / 100)}
              </p>
              <p className="text-xs text-muted-foreground">
                + 18% GST ({formatCurrency(pkg.amountPaise / 100)} total)
              </p>
            </div>
            <Button
              className="mt-4"
              size="sm"
              disabled={
                !activeOrganization?.billingProfile || isToppingUpAiTokens
              }
              onClick={() => topupAiTokensMutate(pkg.packageId)}
            >
              Top up
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
