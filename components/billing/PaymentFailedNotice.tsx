import { AlertCircle } from "lucide-react";
import { useRouter } from "next/router";

import { Button } from "@/components/ui/button";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { formatDate, getPaymentState, getPlanByTier } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

// Not dismissible: it is about money and access. Amber while the plan still
// works (grace), red once it has ended.
export function PaymentFailedNotice({
  variant
}: {
  variant: "banner" | "card";
}) {
  const router = useRouter();
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const { isOwner, isLoading } = useCurrentMembership();
  const paymentState = getPaymentState(activeOrganization);

  if (!activeOrganization || paymentState === "ok") return null;

  const planName =
    getPlanByTier(activeOrganization.planTier)?.name || "current";
  const graceUntil = activeOrganization.paymentGraceUntil;
  const message =
    paymentState === "ended"
      ? "Your plan ended because the payment didn't go through."
      : `Your last payment didn't go through. Razorpay will try again, and your ${planName} plan keeps working ${
          graceUntil ? `until ${formatDate(graceUntil)}` : "for now"
        }.`;

  const openPayment = () => {
    if (paymentState === "ended") {
      router.push("/plans");
      return;
    }
    router.push({
      pathname: "/checkout",
      query: { tier: activeOrganization.planTier, intent: "subscribe" }
    });
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 border sm:flex-row sm:items-center",
        variant === "banner"
          ? "rounded-md px-3 py-2 text-sm"
          : "rounded-lg p-4 text-sm",
        paymentState === "grace"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-red-200 bg-red-50 text-red-950"
      )}
    >
      <AlertCircle
        className={cn(
          "size-4 shrink-0",
          paymentState === "grace" ? "text-amber-600" : "text-red-600"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className={cn(variant === "card" && "font-medium")}>{message}</p>
        {!isLoading && !isOwner ? (
          <p className="mt-0.5 opacity-80">
            Ask your organisation owner to update the payment.
          </p>
        ) : null}
      </div>
      {isOwner ? (
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          onClick={openPayment}
        >
          {paymentState === "ended"
            ? "Choose a plan"
            : "Pay now with another method"}
        </Button>
      ) : null}
    </div>
  );
}
