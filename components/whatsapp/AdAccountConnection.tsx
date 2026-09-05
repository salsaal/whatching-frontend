import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeCheck, Megaphone } from "lucide-react";
import { toast } from "sonner";

import { listAdAccounts, selectAdAccount } from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useOrganizationStore } from "@/stores/organizationStore";

export default function AdAccountConnection() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const upsertOrganization = useOrganizationStore(
    (state) => state.upsertOrganization
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState("");

  const connectedAdAccountId = activeOrganization?.metaConfig?.adAccountId;
  const connectedAdAccountName = activeOrganization?.metaConfig?.adAccountName;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ad-accounts", activeOrganization?._id],
    queryFn: listAdAccounts,
    enabled: isPickerOpen
  });
  const adAccounts = data?.data.adAccounts || [];

  const { mutate: connectAdAccount, isPending: isConnecting } = useMutation({
    mutationFn: selectAdAccount,
    meta: { showToast: false },
    onSuccess: (res) => {
      if (activeOrganization) {
        upsertOrganization({
          ...activeOrganization,
          metaConfig: {
            ...activeOrganization.metaConfig,
            adAccountId: res.data.adAccountId,
            adAccountName: res.data.adAccountName || undefined
          }
        });
      }
      toast.success(res.message || "Ad account connected.");
      setIsPickerOpen(false);
    },
    onError: () => {
      toast.error("Couldn't connect that ad account. Try again.");
    }
  });

  const handleConnect = () => {
    if (!selectedAdAccountId) return;
    const account = adAccounts.find((item) => item.id === selectedAdAccountId);
    connectAdAccount({
      adAccountId: selectedAdAccountId,
      adAccountName: account?.name
    });
  };

  return (
    <section className="rounded-lg border bg-white p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Megaphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">
            Connected ad account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Links your Meta ad account so campaign spend and cost-per-outcome
            can show up alongside your WhatsApp funnel numbers.
          </p>
        </div>
      </div>

      {connectedAdAccountId ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <BadgeCheck className="size-4 shrink-0 text-primary" />
            <span className="font-medium">
              {connectedAdAccountName || connectedAdAccountId}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPickerOpen(true)}
          >
            Change account
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          {!isPickerOpen ? (
            <Button type="button" onClick={() => setIsPickerOpen(true)}>
              Connect ad account
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-dashed p-3">
              {isError ? (
                <p className="text-sm text-destructive">
                  Couldn&apos;t list ad accounts. This usually means the
                  ads_read permission hasn&apos;t been granted yet, or the
                  WhatsApp Business Account isn&apos;t connected.
                </p>
              ) : (
                <>
                  <Select
                    value={selectedAdAccountId}
                    onValueChange={setSelectedAdAccountId}
                    disabled={isLoading || !adAccounts.length}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          isLoading
                            ? "Loading ad accounts..."
                            : adAccounts.length
                              ? "Select an ad account"
                              : "No ad accounts found"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {adAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!selectedAdAccountId || isConnecting}
                      onClick={handleConnect}
                    >
                      {isConnecting ? "Connecting..." : "Connect"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsPickerOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
