"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  PartyPopper,
  ReceiptText,
  Sparkles
} from "lucide-react";
import { useRouter } from "next/router";

import { syncBillingSubscription } from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import AppLayout from "@/layouts/AppLayout";
import {
  formatCurrency,
  getPlanByTier,
  isSubscriptionCanceledWithAccess
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

type LastCheckout = {
  tier?: string;
  planName?: string;
  action?: string;
  baseAmount?: number;
  gstAmount?: number;
  totalAmount?: number;
  startedAt?: string;
};

const checkoutStorageKey = "whatching:checkout:last";

export default function CongratulationsPage() {
  const router = useRouter();
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const upsertOrganization = useOrganizationStore(
    (state) => state.upsertOrganization
  );
  const [lastCheckout, setLastCheckout] = useState<LastCheckout | null>(null);
  const isTrial = router.query.trial === "1";
  const queryPlan = useMemo(
    () => getPlanByTier(router.query.tier),
    [router.query.tier]
  );

  const syncMutation = useMutation({
    mutationFn: syncBillingSubscription,
    meta: { showToast: false },
    onSuccess: (res) => {
      upsertOrganization(res.data.organization);
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(checkoutStorageKey);
    if (!stored) return;

    try {
      setLastCheckout(JSON.parse(stored) as LastCheckout);
    } catch {
      window.localStorage.removeItem(checkoutStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!activeOrganization?._id || isTrial) return;
    syncMutation.mutate();
    // Run once when landing here; repeated syncs are not useful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?._id, isTrial]);

  const planName =
    queryPlan?.name || lastCheckout?.planName || activeOrganization?.planTier;
  const canceledWithAccess =
    isSubscriptionCanceledWithAccess(activeOrganization);
  const isActive =
    activeOrganization?.subscriptionStatus === "active" && !canceledWithAccess;

  return (
    <AppLayout>
      <div className="relative mx-auto flex min-h-[calc(100vh-180px)] max-w-5xl items-center justify-center overflow-hidden rounded-lg bg-white p-6 shadow-xs">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "absolute top-8 block size-2 rounded-full opacity-80",
                index % 3 === 0
                  ? "bg-primary"
                  : index % 3 === 1
                    ? "bg-amber-400"
                    : "bg-sky-400"
              )}
              style={{
                left: `${8 + ((index * 37) % 84)}%`,
                animation: `checkout-confetti 1600ms ease-out ${index * 38}ms both`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-2xl text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-md bg-primary/10 text-primary">
            {isTrial ? (
              <Sparkles className="size-8" />
            ) : (
              <PartyPopper className="size-8" />
            )}
          </div>

          <h1 className="mt-6 font-heading text-4xl font-semibold">
            {isTrial ? "Free trial started" : "Plan purchased"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {isTrial
              ? `Your ${planName || "Whatching"} trial is active for this organisation.`
              : "Razorpay payment has been submitted. Whatching will keep syncing the subscription status through backend webhooks and the billing sync route."}
          </p>

          <div className="mt-6 grid gap-3 rounded-lg border bg-muted/30 p-4 text-left sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="mt-1 font-heading font-semibold capitalize">
                {planName || "Whatching"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subscription</p>
              <div className="mt-1 flex items-center gap-2 font-heading font-semibold capitalize">
                {syncMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : isActive || isTrial ? (
                  <CheckCircle2 className="size-4 text-primary" />
                ) : (
                  <ReceiptText className="size-4 text-amber-600" />
                )}
                {isTrial
                  ? "trialing"
                  : activeOrganization?.subscriptionStatus || "syncing"}
              </div>
            </div>

            {lastCheckout?.baseAmount ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Plan price</p>
                  <p className="mt-1 font-medium">
                    {formatCurrency(lastCheckout.baseAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GST 18%</p>
                  <p className="mt-1 font-medium">
                    {formatCurrency(lastCheckout.gstAmount || 0)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="mt-1 font-heading text-xl font-semibold">
                    {formatCurrency(lastCheckout.totalAmount || 0)}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {syncMutation.isError ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Payment was submitted, but live subscription sync did not respond.
              The backend webhook can still activate the plan. Check Billing if
              the status is not updated yet.
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => router.push("/overview")}>
              Go to dashboard
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/settings/billing")}
            >
              View billing
            </Button>
          </div>
        </div>

        <style jsx>{`
          @keyframes checkout-confetti {
            0% {
              transform: translate3d(0, -24px, 0) rotate(0deg);
              opacity: 0;
            }
            15% {
              opacity: 1;
            }
            100% {
              transform: translate3d(0, 440px, 0) rotate(540deg);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    </AppLayout>
  );
}
