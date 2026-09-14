import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Megaphone } from "lucide-react";
import { toast } from "sonner";

import {
  completeAdAccountSignup,
  listAdAccounts,
  selectAdAccount
} from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useOrganizationStore } from "@/stores/organizationStore";

// Config for the standalone "ad account access" Meta login flow -- fully
// separate from the WhatsApp embedded signup config used on the overview
// page. Only `code` and (per the "General" login variation) a top-level
// `data.ad_account_ids` are expected back; the FacebookSdk/Window.FB
// ambient types are declared globally in pages/overview.tsx (the page that
// loads the SDK script this component depends on).
const AD_ACCOUNT_SIGNUP_CONFIG_ID =
  process.env.NEXT_PUBLIC_META_AD_ACCOUNT_SIGNUP_CONFIG_ID;

interface AdAccountLoginResponse {
  authResponse?: { code?: string };
  data?: { ad_account_ids?: string[]; [key: string]: unknown };
}

export default function AdAccountConnection() {
  const queryClient = useQueryClient();
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

  const {
    mutate: completeAdAccountMutate,
    isPending: isCompletingAdAccountSignup
  } = useMutation({
    mutationFn: completeAdAccountSignup,
    meta: { showToast: false },
    onSuccess: (res) => {
      if (res.data.adAccountId) {
        toast.success("Ad account connected.");
        queryClient.invalidateQueries({ queryKey: ["organization"] });
      } else {
        // Meta didn't deliver a clean selection this time -- fall back to
        // the existing manual picker, which will now actually list
        // accounts since real access was just granted.
        setIsPickerOpen(true);
      }
    },
    onError: () => {
      toast.error("Couldn't connect that ad account. Try again.");
    }
  });

  // Standalone Meta login for ad-account access, separate from the WhatsApp
  // embedded signup flow entirely -- own login config, own callback.
  const startAdAccountSignup = useCallback(() => {
    if (!AD_ACCOUNT_SIGNUP_CONFIG_ID) {
      toast.error(
        "Ad account sign-up isn't configured. Use the manual picker below instead."
      );
      setIsPickerOpen(true);
      return;
    }
    if (!window.FB) {
      toast.error("Meta login isn't ready yet. Try again in a moment.");
      setIsPickerOpen(true);
      return;
    }
    window.FB.login(
      (response) => {
        const loginResponse = response as AdAccountLoginResponse;
        const code = loginResponse.authResponse?.code?.trim();
        if (!code) {
          toast.error("Meta didn't return an authorization code. Try again.");
          return;
        }
        completeAdAccountMutate({ code, data: loginResponse.data });
      },
      {
        config_id: AD_ACCOUNT_SIGNUP_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true
      }
    );
  }, [completeAdAccountMutate]);

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
            <Button
              type="button"
              disabled={isCompletingAdAccountSignup}
              isLoading={isCompletingAdAccountSignup}
              onClick={startAdAccountSignup}
            >
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
