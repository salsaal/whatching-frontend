import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { BadgeCheck, ChevronDown, Megaphone } from "lucide-react";
import { toast } from "sonner";

import {
  completeAdAccountSignup,
  disconnectAdAccount,
  listAdAccounts,
  selectAdAccount
} from "@/client-api/functions/organizations";
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
import {
  Popover,
  PopoverAnchor,
  PopoverContent
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { useOrganizationStore } from "@/stores/organizationStore";

// Config for the standalone "ad account access" Meta login flow -- fully
// separate from the WhatsApp embedded signup config used on the overview
// page. Only `code` and (per the "General" login variation) a top-level
// `data.ad_account_ids` are expected back; the FacebookSdk/Window.FB
// ambient types are declared globally in pages/overview.tsx (the page that
// loads the SDK script this component depends on).
const AD_ACCOUNT_DISCONNECT_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;

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
  const { isOwnerOrAdmin } = useCurrentMembership();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState("");
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);

  const connectedAdAccountId = activeOrganization?.metaConfig?.adAccountId;
  const connectedAdAccountName = activeOrganization?.metaConfig?.adAccountName;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ad-accounts", activeOrganization?._id],
    queryFn: listAdAccounts,
    enabled: isPickerOpen
  });
  const adAccounts = data?.data.adAccounts || [];

  // Ad accounts can be disconnected once per 15 days. Take the later of the
  // backend's own answer (when the picker has loaded it) and the date
  // implied by the stored last-disconnect time -- the latter is updated the
  // moment we disconnect, so a cached "allowed" response can't win.
  const storedLastDisconnect =
    activeOrganization?.metaConfig?.lastAdAccountDisconnectedAt;
  const disconnectAvailableAt = [
    data?.data.disconnectAvailableAt
      ? new Date(data.data.disconnectAvailableAt).getTime()
      : 0,
    storedLastDisconnect
      ? new Date(storedLastDisconnect).getTime() +
        AD_ACCOUNT_DISCONNECT_COOLDOWN_MS
      : 0
  ].reduce((latest, time) => Math.max(latest, time), 0);
  const isDisconnectCoolingDown = disconnectAvailableAt > Date.now();

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
      setSelectedAdAccountId("");
    },
    onError: () => {
      toast.error("Couldn't connect that ad account. Try again.");
    }
  });

  const { mutate: disconnect, isPending: isDisconnecting } = useMutation({
    mutationFn: disconnectAdAccount,
    meta: { showToast: false },
    onSuccess: (res) => {
      if (activeOrganization) {
        upsertOrganization({
          ...activeOrganization,
          metaConfig: {
            ...activeOrganization.metaConfig,
            adAccountId: undefined,
            adAccountName: undefined,
            lastAdAccountDisconnectedAt: new Date().toISOString()
          }
        });
      }
      toast.success(res.message || "Ad account disconnected.");
      setIsDisconnectConfirmOpen(false);
      setIsPickerOpen(false);
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message ||
          "Couldn't disconnect the ad account. Try again."
      );
      setIsDisconnectConfirmOpen(false);
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
        // the manual picker, which will now actually list accounts since
        // real access was just granted.
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
        "Ad account sign-up isn't configured. Use the manual picker instead."
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

  // Listing, connecting, and disconnecting are owner/admin-only; everyone
  // else just sees which account is connected.
  if (!isOwnerOrAdmin) {
    return connectedAdAccountId ? (
      <div className="inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm">
        <BadgeCheck className="size-4 text-primary" />
        {connectedAdAccountName || connectedAdAccountId}
      </div>
    ) : null;
  }

  return (
    <Popover
      open={isPickerOpen}
      onOpenChange={(open) => {
        setIsPickerOpen(open);
        if (!open) setSelectedAdAccountId("");
      }}
    >
      {/* PopoverAnchor only positions the popover -- it doesn't intercept
          clicks, so the button's own onClick stays in full control of
          whether this opens the picker or kicks off Meta login directly.
          (A PopoverTrigger would toggle `open` itself on click, which would
          fight the connected-vs-not branching below.) */}
      <PopoverAnchor asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isCompletingAdAccountSignup}
          isLoading={isCompletingAdAccountSignup}
          onClick={() =>
            connectedAdAccountId
              ? setIsPickerOpen(true)
              : startAdAccountSignup()
          }
        >
          {connectedAdAccountId ? (
            <BadgeCheck className="size-4 text-primary" />
          ) : (
            <Megaphone className="size-4" />
          )}
          {connectedAdAccountId
            ? connectedAdAccountName || connectedAdAccountId
            : "Connect ad account"}
          {connectedAdAccountId && (
            <ChevronDown className="size-3.5 opacity-60" />
          )}
        </Button>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium">
          {connectedAdAccountId ? "Change ad account" : "Select an ad account"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Links your Meta ad account so campaign spend and cost-per-outcome can
          show up alongside your WhatsApp funnel numbers.
        </p>
        <div className="mt-3 space-y-3">
          {isError ? (
            <p className="text-sm text-destructive">
              Couldn&apos;t list ad accounts. This usually means the ads_read
              permission hasn&apos;t been granted yet, or the WhatsApp Business
              Account isn&apos;t connected.
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
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPickerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedAdAccountId || isConnecting}
                  onClick={handleConnect}
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </Button>
              </div>
              {connectedAdAccountId && isOwnerOrAdmin && (
                <div className="border-t pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive"
                    disabled={isDisconnectCoolingDown}
                    onClick={() => setIsDisconnectConfirmOpen(true)}
                  >
                    Disconnect ad account
                  </Button>
                  {isDisconnectCoolingDown && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      You can disconnect again on{" "}
                      {new Date(disconnectAvailableAt).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                      . Ad accounts can be disconnected once every 15 days.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
      <AlertDialog
        open={isDisconnectConfirmOpen}
        onOpenChange={setIsDisconnectConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect ad account?</AlertDialogTitle>
            <AlertDialogDescription>
              Campaign spend and cost-per-outcome will stop showing alongside
              your WhatsApp funnel numbers until you connect another ad account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDisconnecting}
              onClick={() => disconnect()}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Popover>
  );
}
