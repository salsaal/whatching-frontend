import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  activateWhatsAppPhoneNumber,
  deactivateWhatsAppPhoneNumber,
  getWhatsAppPhoneNumbers,
  replaceWhatsAppPhoneNumber,
  setDefaultWhatsAppPhoneNumber,
  syncWhatsAppPhoneNumbers
} from "@/client-api/functions/organizations";
import { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
import {
  isPaymentBlocked,
  PaymentBlockedCallout
} from "@/components/whatsapp/PaymentBlockedCallout";
import { isUsableWhatsAppNumber } from "@/components/whatsapp/WhatsAppNumberSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListLoadingSkeleton } from "@/components/ui/loading-skeletons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { useLiveFlows } from "@/hooks/useLiveFlows";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";

const errorMessage = (error: AxiosError<{ message?: string }>) =>
  error.response?.data?.message || "WhatsApp number action failed.";

type Tone = "good" | "warn" | "bad" | "unknown";

const toneDot: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  unknown: "bg-slate-300"
};

const connectionTone = (
  status: WhatsAppPhoneNumber["connectionStatus"]
): Tone =>
  status === "ready" ? "good" : status === "pending" ? "warn" : "bad";

const qualityTone = (rating?: string): Tone => {
  const value = (rating || "").toUpperCase();
  if (value === "GREEN") return "good";
  if (value === "YELLOW") return "warn";
  if (value === "RED") return "bad";
  return "unknown";
};

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

function StatusDot({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", toneDot[tone])} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

export default function WhatsAppNumbersPanel({
  onAddNumber,
  addingNumber = false
}: {
  onAddNumber: () => void;
  addingNumber?: boolean;
}) {
  const { can } = useCurrentMembership();
  const canSeeFlows = can("flows:manage");
  const { effectiveCanvasFor } = useLiveFlows();
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const subscriptionStatus = useOrganizationStore(
    (state) => state.activeOrganization?.subscriptionStatus
  );
  const canSelfDeactivate = !["active", "trialing"].includes(
    subscriptionStatus || ""
  );
  const queryKey = ["whatsapp-phone-numbers", organizationId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: getWhatsAppPhoneNumbers,
    enabled: Boolean(organizationId) && can("whatsapp_numbers:view"),
    refetchOnMount: "always"
  });
  const summary = data?.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };
  const mutationOptions = {
    onSuccess: refresh,
    onError: (error: AxiosError<{ message?: string }>) =>
      toast.error(errorMessage(error))
  };
  const syncMutation = useMutation({
    mutationFn: syncWhatsAppPhoneNumbers,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("WhatsApp numbers synced.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const defaultMutation = useMutation({
    mutationFn: setDefaultWhatsAppPhoneNumber,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Default WhatsApp number updated.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const activateMutation = useMutation({
    mutationFn: activateWhatsAppPhoneNumber,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("WhatsApp number activated.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const deactivateMutation = useMutation({
    mutationFn: deactivateWhatsAppPhoneNumber,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("WhatsApp number deactivated.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  // Replace only archives the old number -- it doesn't connect a
  // replacement. Deliberately not auto-launching the "Add WhatsApp number"
  // popup here: this resolves in an async onSuccess, outside the original
  // click's call stack, so a same-turn FB.login() popup would very likely
  // get blocked by the browser's popup blocker. Refreshing just re-enables
  // "Add WhatsApp number" with the freed-up slot for the customer to click.
  const replaceMutation = useMutation({
    mutationFn: replaceWhatsAppPhoneNumber,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Number archived -- connect its replacement now.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const isMutating =
    defaultMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    replaceMutation.isPending;

  return (
    <section
      id="whatsapp-numbers"
      className="scroll-mt-24 rounded-lg border bg-white p-6 shadow-xs"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-600" />
            <h2 className="font-heading text-xl font-semibold">
              WhatsApp phone numbers
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Each active number keeps its own inbox sender identity and can use
            its own published flow.
          </p>
          {summary && (
            <p className="mt-2 text-xs text-muted-foreground">
              {summary.activeCount} active
              {summary.planLimit === null
                ? " · unlimited by plan"
                : ` of ${summary.planLimit} allowed`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync numbers
          </Button>
          {summary?.remainingActiveSlots === 0 ? (
            <p className="self-center text-sm text-muted-foreground">
              {summary.activeCount} of{" "}
              {summary.planLimit ?? summary.activeCount} numbers used ·{" "}
              <Link
                href="/plans"
                className="font-medium text-primary hover:underline"
              >
                Upgrade
              </Link>
            </p>
          ) : (
            <Button onClick={onAddNumber} disabled={addingNumber}>
              {addingNumber && <Loader2 className="size-4 animate-spin" />}
              Add WhatsApp number
            </Button>
          )}
        </div>
      </div>
      {summary?.remainingActiveSlots === 0 && (
        <p className="mt-2 text-xs text-muted-foreground sm:text-right">
          Upgrade your plan or replace an existing number to add another.
        </p>
      )}

      {isLoading ? (
        <ListLoadingSkeleton className="mt-5" rows={2} />
      ) : summary?.phoneNumbers.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {summary.phoneNumbers.map((number) => {
            // Same rule as the Flows tab: the number's own flow, else the
            // default. Only for active numbers members can manage flows for.
            const showFlow = canSeeFlows && isUsableWhatsAppNumber(number);
            const flow = showFlow ? effectiveCanvasFor(number) : null;
            return (
              <article
                key={number.id}
                className="flex flex-col rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {number.displayPhoneNumber || number.phoneNumberId}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {number.verifiedName ||
                        number.businessAccountName ||
                        number.phoneNumberId}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {number.isDefault && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-default">
                            <Badge className="bg-emerald-100 text-emerald-800">
                              Default
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Used when a sender isn&apos;t picked, e.g. for
                          broadcasts and tests.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Badge
                      variant={
                        number.status === "active" ? "default" : "secondary"
                      }
                      className="capitalize"
                    >
                      {number.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                  <StatusDot
                    label="Connection"
                    value={titleCase(number.connectionStatus)}
                    tone={connectionTone(number.connectionStatus)}
                  />
                  <StatusDot
                    label="Quality"
                    value={
                      number.qualityRating
                        ? titleCase(number.qualityRating)
                        : "Not reported"
                    }
                    tone={qualityTone(number.qualityRating)}
                  />
                </div>

                {showFlow ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Flow:{" "}
                    <Link
                      href="/bot/flows"
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {flow?.name || "None"}
                    </Link>
                  </p>
                ) : null}

                {isPaymentBlocked(number) ? (
                  <PaymentBlockedCallout number={number} />
                ) : number.activeAlerts?.length ? (
                  <div className="mt-3 flex gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 overflow-wrap-anywhere">
                    <ShieldAlert className="size-4 shrink-0" />
                    <span>{number.activeAlerts[0].message}</span>
                  </div>
                ) : null}

                {/* mt-auto pins the actions to the bottom so cards line up. */}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {!number.isDefault && number.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isMutating}
                      onClick={() => defaultMutation.mutate(number.id)}
                    >
                      <CheckCircle2 className="size-4" />
                      Make default
                    </Button>
                  )}
                  {number.status !== "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        isMutating ||
                        number.connectionStatus !== "ready" ||
                        summary.remainingActiveSlots === 0
                      }
                      onClick={() => activateMutation.mutate(number.id)}
                    >
                      {summary.remainingActiveSlots === 0
                        ? "Plan limit reached"
                        : "Activate"}
                    </Button>
                  ) : canSelfDeactivate ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isMutating}
                      onClick={() => deactivateMutation.mutate(number.id)}
                    >
                      Deactivate
                    </Button>
                  ) : summary.nextReplacementAllowedAt ? (
                    <span className="self-center text-xs text-muted-foreground">
                      Number replacement available{" "}
                      {new Date(
                        summary.nextReplacementAllowedAt
                      ).toLocaleDateString()}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isMutating}
                      onClick={() => replaceMutation.mutate(number.id)}
                    >
                      Replace number
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No WhatsApp numbers have been connected to this organisation yet.
        </div>
      )}
    </section>
  );
}
