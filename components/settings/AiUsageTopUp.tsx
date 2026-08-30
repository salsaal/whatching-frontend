import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { toast } from "sonner";

import {
  getAiTokenPackages,
  topupAiTokens,
  verifyAiTokenTopup
} from "@/client-api/functions/organizations";
import { AiTokenUsageResponse } from "@/client-api/types/organizations.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/billing";
import { loadRazorpayCheckout } from "@/lib/razorpayCheckout";
import { formatCompactNumber } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";

function AiPackageListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
    </div>
  );
}

export function AiUsageTopUp() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [payingPackageId, setPayingPackageId] = useState<string | null>(null);
  const [isVerifyingTopup, setIsVerifyingTopup] = useState(false);

  const canUseAiTokenTopup =
    Boolean(activeOrganization) &&
    activeOrganization?.planTier !== "none" &&
    activeOrganization?.subscriptionStatus !== "trialing";

  const { data: aiTokenPackagesData, isLoading: isLoadingPackages } = useQuery({
    queryKey: ["ai-token-packages"],
    queryFn: getAiTokenPackages,
    enabled: canUseAiTokenTopup
  });

  const verifyMutation = useMutation({
    mutationFn: verifyAiTokenTopup,
    meta: { showToast: false },
    onSuccess: (res) => {
      // Shares a cache key with AiUsageSummary (rendered elsewhere on the
      // page) so its stats update immediately without a refetch.
      queryClient.setQueryData(
        ["ai-token-usage", activeOrganization?._id],
        (previous: AiTokenUsageResponse | undefined) =>
          previous
            ? {
                ...previous,
                data: { ...previous.data, usage: res.data.usage }
              }
            : previous
      );
      toast.success(res.message || "Tokens added to your account.");
    },
    onError: () => {
      toast.error(
        "Payment received, but we couldn't confirm it instantly -- your balance will update shortly once it's processed."
      );
    },
    onSettled: () => setIsVerifyingTopup(false)
  });

  const { mutate: topupAiTokensMutate } = useMutation({
    mutationFn: topupAiTokens,
    meta: { showToast: false },
    onMutate: (packageId) => setPayingPackageId(packageId),
    onSuccess: async (res) => {
      try {
        if (!res.data.orderId || !res.data.key) {
          throw new Error(
            "Top-up couldn't be started -- please refresh the page and try again."
          );
        }

        await loadRazorpayCheckout();
        if (!window.Razorpay) {
          throw new Error("Razorpay checkout is unavailable.");
        }

        const checkout = new window.Razorpay({
          key: res.data.key,
          order_id: res.data.orderId,
          name: "Whatching",
          description: `${res.data.label} AI token top-up`,
          prefill: {
            name: res.data.prefill?.name || user?.name,
            email: res.data.prefill?.email || user?.email,
            contact: res.data.prefill?.contact || user?.phoneNumber
          },
          notes: {
            organizationId: activeOrganization?._id || "",
            packageId: res.data.packageId
          },
          theme: { color: "#0f8f4f" },
          handler: (checkoutResponse) => {
            if (
              !checkoutResponse.razorpay_order_id ||
              !checkoutResponse.razorpay_payment_id ||
              !checkoutResponse.razorpay_signature
            ) {
              toast.error(
                "Payment completed but confirmation details were missing. Refresh to check your balance."
              );
              return;
            }
            setIsVerifyingTopup(true);
            verifyMutation.mutate({
              razorpay_order_id: checkoutResponse.razorpay_order_id,
              razorpay_payment_id: checkoutResponse.razorpay_payment_id,
              razorpay_signature: checkoutResponse.razorpay_signature
            });
          },
          modal: {
            confirm_close: true,
            ondismiss: () => {
              toast.info(
                "Payment window closed. No tokens were purchased -- you can try again anytime."
              );
            }
          }
        });

        checkout.open();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not open Razorpay checkout."
        );
      }
    },
    onSettled: () => setPayingPackageId(null)
  });

  const aiTokenPackages = aiTokenPackagesData?.data.packages || [];

  if (!canUseAiTokenTopup) {
    return (
      <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        AI token usage and top-ups are available on active Basic or Pro plans.
      </div>
    );
  }

  if (isLoadingPackages) {
    return <AiPackageListSkeleton />;
  }

  return (
    <>
      {!activeOrganization?.billingProfile ? (
        <p className="mb-3 rounded-sm bg-amber-50 p-2.5 text-xs text-amber-800">
          Complete your billing profile in{" "}
          <Link href="/settings/billing" className="underline">
            Billing
          </Link>{" "}
          before purchasing AI tokens so we can issue a GST invoice.
        </p>
      ) : null}

      {isVerifyingTopup ? (
        <p className="mb-3 rounded-sm bg-primary/5 p-2.5 text-xs text-primary">
          Confirming your payment with Razorpay...
        </p>
      ) : null}

      <div className="space-y-2">
        {aiTokenPackages.map((pkg) => (
          <div
            key={pkg.packageId}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Zap className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {pkg.label}{" "}
                <span className="font-normal text-muted-foreground">
                  ({formatCompactNumber(pkg.tokens)} tokens)
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(pkg.amountPaise / 100)} incl. GST
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 shrink-0 px-3"
              disabled={
                !activeOrganization?.billingProfile ||
                payingPackageId !== null ||
                isVerifyingTopup
              }
              onClick={() => topupAiTokensMutate(pkg.packageId)}
            >
              {payingPackageId === pkg.packageId ? "Opening..." : "Top up"}
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
