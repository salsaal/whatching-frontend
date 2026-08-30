"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  ReceiptText,
  ShieldCheck
} from "lucide-react";
import { useRouter } from "next/router";
import { toast } from "sonner";

import {
  changeSubscriptionPlan,
  getBillingProfile,
  purchaseSubscription,
  startFreeTrial,
  updateBillingProfile
} from "@/client-api/functions/organizations";
import type { BillingProfile } from "@/client-api/types/organizations.type";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OwnerOnlyNotice } from "@/components/billing/OwnerOnlyNotice";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { useHasUsedFreeTrial } from "@/hooks/useHasUsedFreeTrial";
import AppLayout from "@/layouts/AppLayout";
import { loadRazorpayCheckout } from "@/lib/razorpayCheckout";
import {
  buildPlanAction,
  calculatePlanTotals,
  emptyBillingProfile,
  formatCurrency,
  formatDate,
  getPlanByTier,
  indiaStates,
  isSubscriptionCanceledWithAccess,
  PaidPlanTier,
  validateBillingProfile
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Organization, useOrganizationStore } from "@/stores/organizationStore";

type ApiErrorPayload = {
  message?: string;
};

type PaidCheckoutResponseData = {
  subscriptionId?: string;
  replacementSubscriptionId?: string;
  key?: string;
  paymentUrl?: string;
  organization?: Organization;
};

const checkoutStorageKey = "whatching:checkout:last";

const getErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return (
    axiosError.response?.data?.message ||
    axiosError.message ||
    "Checkout request failed."
  );
};

const normalizeBillingProfile = (profile: BillingProfile): BillingProfile => ({
  legalName: profile.legalName.trim(),
  billingEmail: profile.billingEmail.trim(),
  address: profile.address.trim(),
  state: profile.state.trim(),
  pinCode: profile.pinCode.trim(),
  gstin: profile.gstin?.trim().toUpperCase() || ""
});

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const trialUnavailable = useAuthStore((state) => state.trialUnavailable);
  const markTrialUnavailable = useAuthStore(
    (state) => state.markTrialUnavailable
  );
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const upsertOrganization = useOrganizationStore(
    (state) => state.upsertOrganization
  );
  const { isOwner, isLoading: isMembershipLoading } = useCurrentMembership();
  const { hasUsedTrial } = useHasUsedFreeTrial();
  const plan = useMemo(() => getPlanByTier(router.query.tier), [router.query]);
  const paidPlan =
    plan?.id === "basic" || plan?.id === "pro"
      ? ({
          ...plan,
          id: plan.id,
          monthlyPrice: plan.monthlyPrice || 0
        } as typeof plan & { id: PaidPlanTier; monthlyPrice: number })
      : null;
  const preferDirectSubscribe =
    router.query.intent === "subscribe" || trialUnavailable || hasUsedTrial;
  const action = plan
    ? buildPlanAction(plan, activeOrganization, { preferDirectSubscribe })
    : null;
  const isPaidAction =
    action?.kind === "subscribe" || action?.kind === "change";
  const isTrialAction = action?.kind === "trial";
  const canceledWithAccess =
    isSubscriptionCanceledWithAccess(activeOrganization);
  const isCurrentActivePlan =
    Boolean(plan) &&
    activeOrganization?.planTier === plan?.id &&
    activeOrganization?.subscriptionStatus === "active" &&
    !activeOrganization?.subscriptionCancelAtPeriodEnd;
  const totals = paidPlan?.monthlyPrice
    ? calculatePlanTotals(paidPlan.monthlyPrice)
    : null;
  const [billingProfile, setBillingProfile] =
    useState<BillingProfile>(emptyBillingProfile);

  const {
    data: billingProfileData,
    isLoading: isBillingProfileLoading,
    isError: isBillingProfileError
  } = useQuery({
    queryKey: ["billing-profile", activeOrganization?._id],
    queryFn: getBillingProfile,
    enabled: Boolean(activeOrganization?._id && isPaidAction),
    refetchOnMount: "always"
  });

  useEffect(() => {
    if (!isPaidAction) return;

    const backendProfile = billingProfileData?.data.billingProfile;
    setBillingProfile({
      legalName:
        backendProfile?.legalName ||
        activeOrganization?.billingProfile?.legalName ||
        activeOrganization?.name ||
        "",
      billingEmail:
        backendProfile?.billingEmail ||
        activeOrganization?.billingProfile?.billingEmail ||
        user?.email ||
        "",
      address:
        backendProfile?.address ||
        activeOrganization?.billingProfile?.address ||
        "",
      state:
        backendProfile?.state ||
        activeOrganization?.billingProfile?.state ||
        "",
      pinCode:
        backendProfile?.pinCode ||
        activeOrganization?.billingProfile?.pinCode ||
        "",
      gstin:
        backendProfile?.gstin || activeOrganization?.billingProfile?.gstin || ""
    });
  }, [
    activeOrganization?.billingProfile,
    activeOrganization?.name,
    billingProfileData,
    isPaidAction,
    user?.email
  ]);

  const validation = useMemo(
    () => validateBillingProfile(billingProfile),
    [billingProfile]
  );
  const hasBillingErrors = Object.values(validation).some(Boolean);

  const saveBillingProfileMutation = useMutation({
    mutationFn: (payload: BillingProfile) => updateBillingProfile(payload),
    meta: { showToast: false }
  });

  const startTrialMutation = useMutation({
    mutationFn: (tier: PaidPlanTier) => startFreeTrial({ tier }),
    meta: { showToast: false },
    onSuccess: (res) => {
      upsertOrganization(res.data.organization);
      toast.success(res.message || "Free trial started.");
      router.push({
        pathname: "/congratulations",
        query: { tier: res.data.trial?.tier || paidPlan?.id, trial: "1" }
      });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      if (message.toLowerCase().includes("already been used")) {
        markTrialUnavailable();
      }
      toast.error(message);
    }
  });

  const paidCheckoutMutation = useMutation({
    mutationFn: async (tier: PaidPlanTier) => {
      const normalizedProfile = normalizeBillingProfile(billingProfile);
      await saveBillingProfileMutation.mutateAsync(normalizedProfile);

      if (action?.kind === "change") {
        return changeSubscriptionPlan({ tier });
      }

      return purchaseSubscription({ tier });
    },
    meta: { showToast: false },
    onSuccess: async (res, tier) => {
      const responseData = res.data as PaidCheckoutResponseData | undefined;
      const subscriptionId =
        responseData?.replacementSubscriptionId || responseData?.subscriptionId;
      const razorpayKey = responseData?.key;
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/congratulations?tier=${tier}`
          : `/congratulations?tier=${tier}`;

      if (responseData?.organization) {
        upsertOrganization(responseData.organization);
      }

      if (!subscriptionId || !razorpayKey) {
        const outcomeMessage =
          res.message ||
          "Plan request completed. We are syncing your billing status.";
        toast.success(outcomeMessage);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            checkoutStorageKey,
            JSON.stringify({
              tier,
              action: action?.kind,
              planName: paidPlan?.name,
              outcomeMessage,
              wentThroughRazorpay: false,
              startedAt: new Date().toISOString()
            })
          );
        }

        router.push({
          pathname: "/congratulations",
          query: { tier, status: "completed" }
        });
        return;
      }

      if (typeof window !== "undefined") {
        const checkoutSnapshot = {
          tier,
          action: action?.kind,
          planName: paidPlan?.name,
          callbackUrl,
          subscriptionId,
          baseAmount: totals?.baseAmount,
          gstAmount: totals?.gstAmount,
          totalAmount: totals?.totalAmount,
          wentThroughRazorpay: true,
          startedAt: new Date().toISOString()
        };

        window.localStorage.setItem(
          checkoutStorageKey,
          JSON.stringify(checkoutSnapshot)
        );

        try {
          await loadRazorpayCheckout();

          if (!window.Razorpay) {
            throw new Error("Razorpay checkout is unavailable.");
          }

          const checkout = new window.Razorpay({
            key: razorpayKey,
            subscription_id: subscriptionId,
            name: "Whatching",
            description: `${paidPlan?.name || "Whatching"} subscription`,
            prefill: {
              name: user?.name || billingProfile.legalName,
              email: billingProfile.billingEmail || user?.email || "",
              contact: user?.phoneNumber || ""
            },
            notes: {
              organizationId: activeOrganization?._id || "",
              planTier: tier
            },
            theme: { color: "#0f8f4f" },
            handler: (checkoutResponse) => {
              window.localStorage.setItem(
                checkoutStorageKey,
                JSON.stringify({
                  ...checkoutSnapshot,
                  razorpayPaymentId: checkoutResponse.razorpay_payment_id,
                  razorpaySubscriptionId:
                    checkoutResponse.razorpay_subscription_id,
                  returnedAt: new Date().toISOString()
                })
              );
              router.push({
                pathname: "/congratulations",
                query: { tier, status: "submitted" }
              });
            },
            modal: {
              confirm_close: true,
              ondismiss: () => {
                toast.info(
                  "Payment window closed. Your plan was not changed -- you can try again anytime."
                );
              }
            }
          });

          checkout.open();
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      }
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const isProceeding =
    startTrialMutation.isPending ||
    paidCheckoutMutation.isPending ||
    saveBillingProfileMutation.isPending;
  const proceedDisabled =
    !paidPlan ||
    isCurrentActivePlan ||
    canceledWithAccess ||
    isProceeding ||
    (isPaidAction && (isBillingProfileLoading || hasBillingErrors));
  const isDowngrade =
    action?.kind === "change" &&
    activeOrganization?.planTier === "pro" &&
    paidPlan?.id === "basic";
  const [isDowngradeConfirmOpen, setIsDowngradeConfirmOpen] = useState(false);

  const updateBillingField = (key: keyof BillingProfile, value: string) => {
    setBillingProfile((current) => ({
      ...current,
      [key]: key === "gstin" ? value.toUpperCase() : value
    }));
  };

  const confirmDowngrade = () => {
    setIsDowngradeConfirmOpen(false);
    if (paidPlan) paidCheckoutMutation.mutate(paidPlan.id);
  };

  const handleProceed = () => {
    if (!paidPlan) return;

    if (isTrialAction) {
      startTrialMutation.mutate(paidPlan.id);
      return;
    }

    if (isPaidAction && isDowngrade && !hasBillingErrors) {
      setIsDowngradeConfirmOpen(true);
      return;
    }

    if (!isPaidAction || hasBillingErrors) return;
    paidCheckoutMutation.mutate(paidPlan.id);
  };

  if (!isMembershipLoading && !isOwner) {
    return (
      <AppLayout>
        <OwnerOnlyNotice />
      </AppLayout>
    );
  }

  if (!plan || !paidPlan) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 size-5 shrink-0 text-amber-600" />
            <div>
              <h1 className="font-heading text-2xl font-semibold">
                Select a paid plan
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Checkout is available for Basic and Pro plans. Enterprise
                requests are handled through support.
              </p>
              <Button className="mt-5" onClick={() => router.push("/plans")}>
                Back to plans
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-xs md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 -ml-3"
              onClick={() => router.push("/plans")}
            >
              <ArrowLeft className="size-4" />
              Back to plans
            </Button>
            <p className="text-sm font-medium text-primary">Checkout</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              {action?.label || `Subscribe to ${paidPlan.name}`}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {action?.description}
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground">Selected plan</p>
            <p className="mt-1 font-heading text-xl font-semibold">
              {paidPlan.name}
            </p>
          </div>
        </section>

        {canceledWithAccess && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <p>
                This subscription is already cancelled and remains usable until{" "}
                <span className="font-semibold">
                  {formatDate(activeOrganization?.subscriptionCurrentPeriodEnd)}
                </span>
                . Start a new paid checkout after the current period ends.
              </p>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4 rounded-lg bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-5 text-primary" />
              <h2 className="font-heading text-xl font-semibold">
                Billing information
              </h2>
            </div>

            {isTrialAction ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    Free trial does not require billing details. Proceeding will
                    start the 7-day trial for this organisation.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {isBillingProfileError && (
                  <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    Couldn&apos;t load your saved billing profile. If
                    you&apos;ve entered these details before, re-enter them
                    below to be safe.
                  </div>
                )}
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Fields marked required are required by the backend before
                  Razorpay checkout can be created. GSTIN is optional, but must
                  be valid if entered.
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal name *</Label>
                    <Input
                      id="legalName"
                      placeholder="Acme Private Limited"
                      value={billingProfile.legalName}
                      onChange={(event) =>
                        updateBillingField("legalName", event.target.value)
                      }
                      aria-invalid={Boolean(validation.legalName)}
                    />
                    {validation.legalName ? (
                      <p className="text-xs text-destructive">
                        {validation.legalName}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billingEmail">Billing email *</Label>
                    <Input
                      id="billingEmail"
                      type="email"
                      placeholder="billing@example.com"
                      value={billingProfile.billingEmail}
                      onChange={(event) =>
                        updateBillingField("billingEmail", event.target.value)
                      }
                      aria-invalid={Boolean(validation.billingEmail)}
                    />
                    {validation.billingEmail ? (
                      <p className="text-xs text-destructive">
                        {validation.billingEmail}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={billingProfile.state}
                      onValueChange={(value) =>
                        updateBillingField("state", value)
                      }
                    >
                      <SelectTrigger id="state" className="h-11 w-full">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {indiaStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validation.state ? (
                      <p className="text-xs text-destructive">
                        {validation.state}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pinCode">PIN code *</Label>
                    <Input
                      id="pinCode"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="560001"
                      value={billingProfile.pinCode}
                      onChange={(event) =>
                        updateBillingField("pinCode", event.target.value)
                      }
                      aria-invalid={Boolean(validation.pinCode)}
                    />
                    {validation.pinCode ? (
                      <p className="text-xs text-destructive">
                        {validation.pinCode}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Billing address *</Label>
                    <Textarea
                      id="address"
                      placeholder="12 MG Road, Bengaluru"
                      className="max-h-[180px] min-h-24 resize-y overflow-y-auto"
                      value={billingProfile.address}
                      onChange={(event) =>
                        updateBillingField("address", event.target.value)
                      }
                      aria-invalid={Boolean(validation.address)}
                    />
                    {validation.address ? (
                      <p className="text-xs text-destructive">
                        {validation.address}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="gstin">GSTIN optional</Label>
                    <Input
                      id="gstin"
                      placeholder="29ABCDE1234F1Z5"
                      value={billingProfile.gstin || ""}
                      onChange={(event) =>
                        updateBillingField("gstin", event.target.value)
                      }
                      aria-invalid={Boolean(validation.gstin)}
                    />
                    {validation.gstin ? (
                      <p className="text-xs text-destructive">
                        {validation.gstin}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Leave blank if the customer is not claiming GST credit.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <CreditCard className="size-5 text-primary" />
                <h2 className="font-heading text-xl font-semibold">
                  Plan summary
                </h2>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{paidPlan.name}</span>
                  <span className="font-medium">
                    {totals ? formatCurrency(totals.baseAmount) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">GST 18%</span>
                  <span className="font-medium">
                    {totals ? formatCurrency(totals.gstAmount) : "-"}
                  </span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold">Total payable</span>
                    <span className="font-heading text-xl font-semibold">
                      {totals ? formatCurrency(totals.totalAmount) : "-"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prices shown are inclusive of GST on the plan page; this
                    checkout shows the GST split clearly.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-primary/20 bg-primary/5 p-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Razorpay checkout opens after confirmation. Backend webhooks
                  and the sync route confirm the subscription status.
                </p>
              </div>
            </section>

            <Button
              size="lg"
              className="w-full"
              disabled={proceedDisabled}
              onClick={handleProceed}
            >
              {isProceeding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isTrialAction ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              {isProceeding
                ? "Processing"
                : isTrialAction
                  ? "Start free trial"
                  : action?.kind === "change"
                    ? isDowngrade
                      ? "Confirm downgrade"
                      : "Confirm plan change"
                    : "Proceed to Razorpay"}
            </Button>

            <AlertDialog
              open={isDowngradeConfirmOpen}
              onOpenChange={setIsDowngradeConfirmOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Downgrade to {paidPlan?.name}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This takes effect at the end of your current billing cycle.
                    You&apos;ll keep Pro features until then, but move to
                    Basic&apos;s lower subscriber and team-member limits
                    afterward.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-3 rounded-sm bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  Features that exceed Basic&apos;s limits (extra team members,
                  additional phone numbers) may stop working once the downgrade
                  takes effect.
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep current plan</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDowngrade}>
                    Confirm downgrade
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isPaidAction && !isBillingProfileLoading && hasBillingErrors ? (
              <p className="text-center text-xs text-muted-foreground">
                Complete the required billing fields to enable checkout.
              </p>
            ) : null}

            {isCurrentActivePlan ? (
              <p className="text-center text-xs text-muted-foreground">
                This is already your active plan.
              </p>
            ) : null}
          </aside>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          {paidPlan.features.slice(0, 6).map((feature) => (
            <div
              key={feature}
              className={cn(
                "rounded-md border bg-white px-4 py-3 text-sm shadow-xs",
                paidPlan.highlighted && "border-primary/20"
              )}
            >
              {feature}
            </div>
          ))}
        </section>
      </div>
    </AppLayout>
  );
}
