import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { CreditCard, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  getWhatsAppOutboundReadiness,
  testWhatsAppOutboundReadiness
} from "@/client-api/functions/organizations";
import { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
import { Button } from "@/components/ui/button";
import { useOrganizationStore } from "@/stores/organizationStore";

export const PAYMENT_BLOCKED_CODE = "META_PAYMENT_BLOCKED";

/** Meta won't send from this number until its WABA has a payment method. */
export const isPaymentBlocked = (number: WhatsAppPhoneNumber) =>
  Boolean(
    number.activeAlerts?.some((alert) => alert.code === PAYMENT_BLOCKED_CODE) ||
      number.outboundReadiness?.failureCategory === "payment"
  );

// Replaces Meta's raw billing alert on a number card with a plain-language
// fix: open this number's own payment setup, then re-run the send test.
export function PaymentBlockedCallout({
  number
}: {
  number: WhatsAppPhoneNumber;
}) {
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const [showDetails, setShowDetails] = useState(false);
  const recordId = number.id;

  // Same key as the overview's broadcast-setup check, so they share a fetch.
  const readinessKey = ["whatsapp-outbound-readiness", recordId];
  const { data } = useQuery({
    queryKey: readinessKey,
    queryFn: () => getWhatsAppOutboundReadiness(recordId),
    enabled: Boolean(recordId)
  });
  const blocker = data?.data.blocker;
  const paymentSetupUrl =
    blocker?.code === PAYMENT_BLOCKED_CODE
      ? blocker.details?.paymentSetupUrl
      : undefined;
  const rawMessage =
    blocker?.message ||
    number.activeAlerts?.find((alert) => alert.code === PAYMENT_BLOCKED_CODE)
      ?.message ||
    number.outboundReadiness?.failureMessage;

  const { mutate: recheck, isPending: isRechecking } = useMutation({
    mutationFn: () => testWhatsAppOutboundReadiness(recordId),
    meta: { showToast: false },
    onSuccess: (response) => {
      toast.success(
        response.message ||
          "Re-check started. We'll update this number once Meta confirms."
      );
    },
    onError: (error: AxiosError<{ code?: string }>) => {
      // Never surface Meta's raw text here; it's behind "Details".
      toast.error(
        error.response?.data?.code === PAYMENT_BLOCKED_CODE
          ? "Still blocked. Add a payment method in Meta, then re-check."
          : "Couldn't re-check this number. Try again in a moment."
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: readinessKey }),
        queryClient.invalidateQueries({
          queryKey: ["whatsapp-phone-numbers", orgId]
        })
      ]);
    }
  });

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
      <div className="flex gap-2.5">
        <CreditCard className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold">Payment method needed</p>
            <p className="mt-0.5 text-xs leading-5">
              Meta can&apos;t send messages from this number until a payment
              method is assigned to its WhatsApp Business Account.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {paymentSetupUrl && (
              <Button size="sm" asChild>
                <a href={paymentSetupUrl} target="_blank" rel="noreferrer">
                  <CreditCard className="size-4" />
                  Add payment method
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              disabled={isRechecking}
              onClick={() => recheck()}
            >
              {isRechecking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Re-check
            </Button>
          </div>
          {rawMessage && (
            <div>
              <button
                type="button"
                className="cursor-pointer text-xs text-amber-800 underline-offset-2 hover:underline"
                onClick={() => setShowDetails((current) => !current)}
              >
                {showDetails ? "Hide details" : "Details"}
              </button>
              {showDetails && (
                <p className="mt-1 rounded-sm bg-white/70 p-2 text-[11px] leading-4 break-words text-amber-900">
                  {rawMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
