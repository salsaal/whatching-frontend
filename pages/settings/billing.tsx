"use client";

import { AlertTriangle, ReceiptText, XCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  cancelSubscription,
  getBillingHistory
} from "@/api/functions/organizations";
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
import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);

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
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["billing-history", activeOrganization?._id],
    queryFn: getBillingHistory,
    enabled: Boolean(activeOrganization?._id),
    refetchOnMount: "always"
  });

  const { mutate: cancelSubscriptionMutate, isPending: isCancelling } =
    useMutation({
      mutationFn: cancelSubscription,
      onSuccess: (res) => {
        toast.success(res.message);
        refetch();
      }
    });

  const transactions = data?.data.transactions || [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={
                  !activeOrganization ||
                  activeOrganization.planTier === "none" ||
                  isCancelling
                }
              >
                <XCircle className="size-4" />
                Cancel subscription
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your subscription will remain active until the end of the
                  current billing period. This action will stop renewal.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3 rounded-sm bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                You can continue using paid features until the current cycle
                ends.
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => cancelSubscriptionMutate()}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Cancel subscription
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                        {formatAmount(transaction.amount)}
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
      </div>
    </AppLayout>
  );
}
