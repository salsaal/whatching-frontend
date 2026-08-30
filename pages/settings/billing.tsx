"use client";

import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Download,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  TimerReset,
  XCircle
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import {
  cancelSubscription,
  downloadInvoicePdf,
  getBillingHistory,
  listInvoices,
  resumeSubscription,
  retryInvoice,
  syncBillingSubscription
} from "@/client-api/functions/organizations";
import { Invoice } from "@/client-api/types/organizations.type";
import BillingProfileForm from "@/components/billing/BillingProfileForm";
import { OwnerOnlyNotice } from "@/components/billing/OwnerOnlyNotice";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsBackLink } from "@/components/settings/SettingsBackLink";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import {
  calculatePlanTotals,
  formatCurrency,
  formatDate,
  getDaysUntil,
  getPlanByTier,
  isSubscriptionCanceledWithAccess
} from "@/lib/billing";
import { useOrganizationStore } from "@/stores/organizationStore";

function BillingSkeleton() {
  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-xs">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-4">
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
        </div>
      ))}
    </div>
  );
}

export default function BillingSettingsPage() {
  const queryClient = useQueryClient();
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const upsertOrganization = useOrganizationStore(
    (state) => state.upsertOrganization
  );
  const { isOwner, isLoading: isMembershipLoading } = useCurrentMembership();

  const {
    data,
    isLoading,
    isError: isBillingHistoryError,
    refetch
  } = useQuery({
    queryKey: ["billing-history", activeOrganization?._id],
    queryFn: getBillingHistory,
    enabled: Boolean(activeOrganization?._id) && isOwner,
    refetchOnMount: "always"
  });

  const {
    data: invoicesData,
    isLoading: isLoadingInvoices,
    isError: isInvoicesError
  } = useQuery({
    queryKey: ["invoices", activeOrganization?._id],
    queryFn: listInvoices,
    enabled: Boolean(activeOrganization?._id) && isOwner,
    refetchOnMount: "always"
  });

  const { mutate: cancelSubscriptionMutate, isPending: isCancelling } =
    useMutation({
      mutationFn: cancelSubscription,
      onSuccess: (res) => {
        if (res.data?.organization) {
          upsertOrganization(res.data.organization);
        }
        toast.success(res.message);
        refetch();
        queryClient.invalidateQueries({
          queryKey: ["organization", activeOrganization?._id]
        });
      }
    });

  const { mutate: resumeSubscriptionMutate, isPending: isResuming } =
    useMutation({
      mutationFn: resumeSubscription,
      meta: { showToast: false },
      onSuccess: (res) => {
        upsertOrganization(res.data.organization);
        toast.success(res.message);
        queryClient.invalidateQueries({
          queryKey: ["organization", activeOrganization?._id]
        });
        if (res.data.paymentUrl) {
          window.open(res.data.paymentUrl, "_blank", "noopener,noreferrer");
        }
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        toast.error(
          error.response?.data?.message ||
            "Could not resume the subscription. Please try again."
        );
      }
    });

  const { mutate: syncSubscriptionMutate, isPending: isSyncing } = useMutation({
    mutationFn: syncBillingSubscription,
    meta: { showToast: false },
    onSuccess: (res) => {
      upsertOrganization(res.data.organization);
      toast.success("Billing status synced.");
      refetch();
    }
  });

  const { mutate: retryInvoiceMutate, isPending: isRetryingInvoice } =
    useMutation({
      mutationFn: retryInvoice,
      meta: { invalidateQueries: ["invoices", activeOrganization?._id] }
    });

  const { mutate: downloadInvoice, isPending: isDownloadingInvoice } =
    useMutation({
      mutationFn: (invoice: Invoice) => downloadInvoicePdf(invoice._id),
      meta: { showToast: false },
      onSuccess: (blob, invoice) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      },
      onError: () => {
        toast.error("Unable to download invoice.");
      }
    });

  const transactions = data?.data.transactions || [];
  const invoices = invoicesData?.data.invoices || [];
  const plan = getPlanByTier(activeOrganization?.planTier);
  const monthlyPrice =
    typeof plan?.monthlyPrice === "number" ? plan.monthlyPrice : null;
  const totals =
    monthlyPrice !== null ? calculatePlanTotals(monthlyPrice) : null;
  const canceledWithAccess =
    isSubscriptionCanceledWithAccess(activeOrganization);
  const daysUntilPeriodEnd = getDaysUntil(
    activeOrganization?.subscriptionCurrentPeriodEnd
  );
  const isActiveSubscription =
    activeOrganization?.subscriptionStatus === "active" &&
    !activeOrganization?.subscriptionCancelAtPeriodEnd;
  const isTrialing = activeOrganization?.subscriptionStatus === "trialing";
  // A trial never creates a Razorpay subscription, so a pure-trial org has
  // no razorpaySubscriptionId yet -- it can still end its trial early, so
  // that case must not require one. Mirrors the backend's own guard in
  // cancelMySubscription.
  const canCancel =
    Boolean(activeOrganization) &&
    activeOrganization?.planTier !== "none" &&
    !activeOrganization?.subscriptionCancelAtPeriodEnd &&
    (Boolean(activeOrganization?.razorpaySubscriptionId) ||
      Boolean(activeOrganization?.pendingRazorpaySubscriptionCheckoutUrl) ||
      isTrialing);
  const isTrialWithoutSubscription =
    isTrialing &&
    !activeOrganization?.razorpaySubscriptionId &&
    !activeOrganization?.pendingRazorpaySubscriptionCheckoutUrl;
  // When a plan change is already queued (a replacement subscription
  // awaiting/at authorization), the backend's cancel endpoint cancels THAT
  // pending change first, not the currently active plan -- the button and
  // dialog need to say so, or a user trying to cancel their whole
  // subscription is surprised to find only the queued change was affected.
  const hasPendingReplacement = Boolean(
    activeOrganization?.pendingRazorpaySubscriptionId
  );
  // pendingRazorpaySubscriptionCheckoutUrl stays populated even after the
  // customer has paid the mandate charge (it's only cleared once the plan
  // actually switches over) -- so it alone can't tell us whether action is
  // still needed. `pendingRazorpaySubscriptionStatus` can: 'authenticated'
  // means the payment already cleared and we're just waiting on the date.
  const pendingReplacementNeedsAuthorization =
    Boolean(activeOrganization?.pendingRazorpaySubscriptionCheckoutUrl) &&
    activeOrganization?.pendingRazorpaySubscriptionStatus !== "authenticated";

  if (!isMembershipLoading && !isOwner) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-6xl space-y-6">
          <SettingsBackLink />
          <OwnerOnlyNotice />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <SettingsBackLink />
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Settings</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              Billing settings
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review billing activity and manage your active subscription.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!activeOrganization || isSyncing}
              onClick={() => syncSubscriptionMutate()}
            >
              {isSyncing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync billing
            </Button>

            {canceledWithAccess && (
              <Button
                variant="outline"
                disabled={isResuming}
                title="Undo the scheduled cancellation and keep this plan"
                onClick={() => resumeSubscriptionMutate()}
              >
                {isResuming ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Resume subscription
              </Button>
            )}

            {!canceledWithAccess && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    title={
                      isTrialWithoutSubscription
                        ? "End your free trial immediately"
                        : hasPendingReplacement
                          ? "Cancel the pending plan change"
                          : "Stop renewal at the end of the current billing period"
                    }
                    disabled={!canCancel || isCancelling}
                  >
                    <XCircle className="size-4" />
                    {isTrialWithoutSubscription
                      ? "End trial"
                      : hasPendingReplacement
                        ? "Cancel pending plan change"
                        : "Cancel subscription"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isTrialWithoutSubscription
                        ? "End your free trial?"
                        : hasPendingReplacement
                          ? "Cancel the pending plan change?"
                          : "Cancel subscription?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {isTrialWithoutSubscription
                        ? "This ends your free trial immediately. Paid features stop working right away, not at the end of the trial period."
                        : hasPendingReplacement
                          ? `This cancels the queued change to ${activeOrganization?.pendingRazorpaySubscriptionTier === "basic" ? "Basic" : "Pro"} only. Your current ${activeOrganization?.planTier === "basic" ? "Basic" : "Pro"} plan keeps running as-is -- this does not cancel it.`
                          : "Your subscription will remain active until the end of the current billing period. This action will stop renewal."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex gap-3 rounded-sm bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {isTrialWithoutSubscription
                      ? "This cannot be undone. You can still subscribe to a paid plan at any time."
                      : hasPendingReplacement
                        ? "To cancel your active plan instead, wait for this pending change to resolve first."
                        : "You can continue using paid features until the current cycle ends."}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {hasPendingReplacement
                        ? "Keep the pending change"
                        : "Keep subscription"}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelSubscriptionMutate()}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {isTrialWithoutSubscription
                        ? "End trial"
                        : hasPendingReplacement
                          ? "Cancel pending plan change"
                          : "Cancel subscription"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </section>

        {activeOrganization?.lastPlanChangeFailureReason ? (
          <section className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Your last plan change failed</p>
              <p className="mt-1">
                {activeOrganization.lastPlanChangeFailureReason}
              </p>
              {activeOrganization.lastPlanChangeFailureAt && (
                <p className="mt-1 text-xs text-destructive/70">
                  {formatDate(activeOrganization.lastPlanChangeFailureAt)}
                </p>
              )}
            </div>
          </section>
        ) : null}

        {activeOrganization?.scheduledPlanTier &&
        pendingReplacementNeedsAuthorization ? (
          <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div>
              <p>
                You started switching to{" "}
                <span className="font-semibold capitalize">
                  {activeOrganization.pendingRazorpaySubscriptionTier}
                </span>
                , but Razorpay needs a new payment authorization before it can
                take effect.
              </p>
              <p className="mt-1">
                Your current{" "}
                <span className="font-semibold capitalize">
                  {activeOrganization.planTier}
                </span>{" "}
                plan keeps running as-is until you finish authorizing -- nothing
                changes automatically. If you complete it in time,{" "}
                <span className="font-semibold capitalize">
                  {activeOrganization.scheduledPlanTier}
                </span>{" "}
                takes over on{" "}
                <span className="font-semibold">
                  {formatDate(activeOrganization.scheduledPlanChangeAt)}
                </span>
                .
              </p>
            </div>
            <div>
              <Button
                size="sm"
                onClick={() =>
                  window.open(
                    activeOrganization.pendingRazorpaySubscriptionCheckoutUrl ||
                      undefined,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                Complete authorization
              </Button>
            </div>
          </section>
        ) : activeOrganization?.scheduledPlanTier ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            A plan change to{" "}
            <span className="font-semibold capitalize">
              {activeOrganization.scheduledPlanTier}
            </span>{" "}
            is scheduled for{" "}
            <span className="font-semibold">
              {formatDate(activeOrganization.scheduledPlanChangeAt)}
            </span>
            .
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-5 shadow-xs">
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="mt-2 font-heading text-2xl font-semibold capitalize">
              {activeOrganization?.planTier === "none"
                ? "No plan"
                : activeOrganization?.planTier || "-"}
            </p>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {activeOrganization?.subscriptionStatus || "not started"}
            </p>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-primary" />
              <p className="font-heading font-semibold">
                {canceledWithAccess
                  ? "Access ends"
                  : isTrialing
                    ? "Trial ends"
                    : "Next deduction"}
              </p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {canceledWithAccess ? (
                <>
                  Paid features stop working on{" "}
                  <span className="font-semibold text-foreground">
                    {formatDate(
                      activeOrganization?.subscriptionCurrentPeriodEnd
                    )}
                  </span>
                  {typeof daysUntilPeriodEnd === "number"
                    ? ` (${daysUntilPeriodEnd} day${daysUntilPeriodEnd === 1 ? "" : "s"} left).`
                    : "."}
                </>
              ) : isTrialing ? (
                <>
                  Trial access ends on{" "}
                  <span className="font-semibold text-foreground">
                    {formatDate(activeOrganization?.trialEndsAt)}
                  </span>
                  .
                </>
              ) : isActiveSubscription && totals ? (
                <>
                  {formatCurrency(totals.totalAmount)} will be deducted on{" "}
                  <span className="font-semibold text-foreground">
                    {formatDate(
                      activeOrganization?.subscriptionCurrentPeriodEnd
                    )}
                  </span>
                  .
                </>
              ) : (
                "No upcoming subscription deduction."
              )}
            </p>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <TimerReset className="size-5 text-primary" />
              <p className="font-heading font-semibold">Amount breakdown</p>
            </div>
            {totals ? (
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan price</span>
                  <span>{formatCurrency(totals.baseAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST 18%</span>
                  <span>{formatCurrency(totals.gstAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Select a paid plan to see subscription pricing.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">
              Billing profile
            </h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Required for GST invoicing and AI token top-ups.
          </p>
          <BillingProfileForm />
        </section>

        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">
              Billing history
            </h2>
          </div>

          {isLoading ? (
            <BillingSkeleton />
          ) : isBillingHistoryError ? (
            <QueryErrorState message="Billing history could not be loaded." />
          ) : transactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-primary">
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction._id} className="border-t">
                      <td className="p-3">
                        {formatDate(transaction.createdAt)}
                      </td>
                      <td className="p-3 capitalize">
                        {transaction.type.replaceAll("_", " ")}
                      </td>
                      <td className="max-w-md p-3">
                        {transaction.description}
                      </td>
                      <td className="p-3 capitalize">{transaction.status}</td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
              No billing transactions yet.
            </div>
          )}
        </section>

        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Invoices</h2>
          </div>

          {isLoadingInvoices ? (
            <BillingSkeleton />
          ) : isInvoicesError ? (
            <QueryErrorState message="Invoices could not be loaded." />
          ) : invoices.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-primary">
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice._id} className="border-t">
                      <td className="p-3 font-medium">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="p-3">{formatDate(invoice.invoiceDate)}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            invoice.status === "sent"
                              ? "default"
                              : invoice.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(invoice.amountTotalPaise / 100)}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download PDF"
                            disabled={isDownloadingInvoice}
                            onClick={() => downloadInvoice(invoice)}
                          >
                            <Download className="size-4" />
                          </Button>
                          {invoice.status === "failed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Retry delivery"
                              disabled={isRetryingInvoice}
                              onClick={() => retryInvoiceMutate(invoice._id)}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
              No invoices yet.
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
