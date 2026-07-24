import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";

import {
  activateWhatsAppPhoneNumber,
  deactivateWhatsAppPhoneNumber,
  getWhatsAppPhoneNumbers,
  setDefaultWhatsAppPhoneNumber,
  syncWhatsAppPhoneNumbers
} from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { useOrganizationStore } from "@/stores/organizationStore";

const errorMessage = (error: AxiosError<{ message?: string }>) =>
  error.response?.data?.message || "WhatsApp number action failed.";

export default function WhatsAppNumbersPanel({
  onAddNumber,
  addingNumber = false
}: {
  onAddNumber: () => void;
  addingNumber?: boolean;
}) {
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
    enabled: Boolean(organizationId),
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
    onSuccess: async () => {
      toast.success("WhatsApp numbers synced.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const defaultMutation = useMutation({
    mutationFn: setDefaultWhatsAppPhoneNumber,
    onSuccess: async () => {
      toast.success("Default WhatsApp number updated.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const activateMutation = useMutation({
    mutationFn: activateWhatsAppPhoneNumber,
    onSuccess: async () => {
      toast.success("WhatsApp number activated.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const deactivateMutation = useMutation({
    mutationFn: deactivateWhatsAppPhoneNumber,
    onSuccess: async () => {
      toast.success("WhatsApp number deactivated.");
      await refresh();
    },
    onError: mutationOptions.onError
  });
  const isMutating =
    defaultMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending;

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
          <Button onClick={onAddNumber} disabled={addingNumber}>
            {addingNumber && <Loader2 className="size-4 animate-spin" />}
            Add WhatsApp number
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ListLoadingSkeleton className="mt-5" rows={2} />
      ) : summary?.phoneNumbers.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {summary.phoneNumbers.map((number) => (
            <article key={number.id} className="rounded-lg border p-4">
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
                    <Badge className="bg-emerald-100 text-emerald-800">
                      Default
                    </Badge>
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

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/50 p-2.5">
                  <span className="text-muted-foreground">Connection</span>
                  <p className="mt-1 font-medium capitalize">
                    {number.connectionStatus}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5">
                  <span className="text-muted-foreground">Quality</span>
                  <p className="mt-1 font-medium">
                    {number.qualityRating || "Not reported"}
                  </p>
                </div>
              </div>

              {number.activeAlerts?.length ? (
                <div className="mt-3 flex gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>{number.activeAlerts[0].message}</span>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
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
                ) : (
                  <span className="self-center text-xs text-muted-foreground">
                    Contact support to replace this number
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No WhatsApp numbers have been connected to this organisation yet.
        </div>
      )}
    </section>
  );
}
