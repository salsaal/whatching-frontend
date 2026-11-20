import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { unlinkShopify } from "@/client-api/functions/shopify";
import type {
  ShopifySessionResponse,
  ShopifyShopInfo,
  ShopifyStoreData
} from "@/client-api/types/shopify.type";
import type {
  StoreCheckResponse,
  StoreConnection
} from "@/client-api/types/stores.type";
import {
  SHOPIFY_SESSION_KEY,
  showShopifyLinkScreen
} from "@/components/shopify/shopifyStoreApi";
import { useStoreApi } from "@/components/store/StoreApiContext";
import { StoreCheckNote } from "@/components/store/StoreCheckNote";
import {
  STORE_TEMPLATES_DESCRIPTION,
  STORE_TEMPLATES_TITLE,
  StoreTemplatesForm
} from "@/components/store/StoreTemplatesDialog";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/displayFormat";
import { SHOPIFY_CHECKOUT_CONTACT_HELP_URL } from "@/lib/shopify";
import { badgeToneClass } from "@/lib/statusPresentation";
import {
  storeErrorMessage,
  storeStatusPresentation,
  storeTemplatesState
} from "@/lib/store";
import { cn } from "@/lib/utils";

function Step({
  done,
  note,
  title,
  children
}: {
  done?: boolean;
  /** Advice only: an info icon instead of a tick. */
  note?: boolean;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      {note ? (
        <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      ) : done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

const outsideLink = "inline-flex items-center gap-1";

/** Home: the store's status and the setup checklist. */
export function ShopifyHome({
  data,
  connection,
  shop
}: {
  data: ShopifyStoreData;
  connection: StoreConnection;
  shop: ShopifyShopInfo;
}) {
  const queryClient = useQueryClient();
  const api = useStoreApi();
  const [checkResult, setCheckResult] = useState<
    StoreCheckResponse["data"] | null
  >(null);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const { mutate: check, isPending: isChecking } = useMutation({
    mutationFn: () => api.checkConnection(connection.id),
    meta: { showToast: false },
    onSuccess: (response) => {
      setCheckResult(response.data);
      // A failed check also updates the store's status.
      queryClient.invalidateQueries({ queryKey: api.storeKey });
    },
    onError: (error) =>
      setCheckResult({
        reachable: false,
        message: storeErrorMessage(
          error,
          "We couldn't check your store just now. Please try again."
        )
      })
  });

  const { mutate: unlink, isPending: isUnlinking } = useMutation({
    mutationFn: unlinkShopify,
    meta: { showToast: false },
    onSuccess: (response) => {
      showShopifyLinkScreen(queryClient);
      queryClient.setQueryData<ShopifySessionResponse>(
        SHOPIFY_SESSION_KEY,
        response
      );
      toast.success("This store is unlinked from Whatching.");
    },
    onError: (error) =>
      setUnlinkError(
        storeErrorMessage(
          error,
          "The store couldn't be unlinked. Please try again."
        )
      )
  });

  const status = storeStatusPresentation(connection.status);
  const templates = storeTemplatesState(
    connection.settings?.messages,
    data.templates
  );

  return (
    <div className="space-y-5">
      {!data.enabledForPlan && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            Your Whatching plan doesn&apos;t include store messages.{" "}
            <a
              href={data.whatchingUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(outsideLink, "font-medium underline")}
            >
              Open Whatching
              <ExternalLink className="size-3.5" />
            </a>
          </p>
        </div>
      )}

      <section className="rounded-lg border bg-white shadow-xs">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold">
                {connection.storeName || shop.name}
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  badgeToneClass[status.tone]
                )}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {shop.domain}
            </p>
            {connection.lastSyncAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last checked {formatWhen(connection.lastSyncAt).toLowerCase()}
              </p>
            )}
          </div>
          {connection.status !== "connecting" && (
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => check()}
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Check connection
            </Button>
          )}
        </div>

        {connection.status === "connecting" && (
          <p className="border-t bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
            We&apos;re finishing setting up your store. This usually takes a
            minute.
          </p>
        )}
        {connection.status === "needs_attention" && (
          <p className="flex gap-2 border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            {connection.attention?.message ||
              "Whatching can't reach your store right now."}
          </p>
        )}
        {checkResult && (
          <StoreCheckNote result={checkResult} className="border-t px-5 py-3" />
        )}
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          WhatsApp (Meta) charges for each order message delivered. Meta bills
          you directly; Whatching doesn&apos;t add a charge.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-5 shadow-xs">
        <h2 className="font-heading text-xl font-semibold">Setup</h2>
        <ol className="mt-4 space-y-5">
          <Step done title="Whatching account connected">
            <p className="mt-0.5 text-sm text-muted-foreground">
              Linked to the {data.workspace.name || "Whatching"} workspace.
            </p>
            {isConfirmingUnlink ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p>
                  Whatching will stop sending order messages for this store. You
                  can connect again any time.
                </p>
                {unlinkError && (
                  <p className="mt-2 text-destructive" role="alert">
                    {unlinkError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isUnlinking}
                    onClick={() => {
                      setUnlinkError("");
                      unlink();
                    }}
                  >
                    {isUnlinking && <Loader2 className="size-4 animate-spin" />}
                    Unlink
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    disabled={isUnlinking}
                    onClick={() => {
                      setIsConfirmingUnlink(false);
                      setUnlinkError("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setIsConfirmingUnlink(true)}
              >
                Unlink
              </Button>
            )}
          </Step>

          <Step done={data.whatsappConnected} title="WhatsApp connected">
            {data.whatsappConnected ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Order messages go out from your WhatsApp number on Whatching.
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Connect a WhatsApp number on Whatching to send order messages.
                </p>
                <Button asChild variant="outline" className="mt-3">
                  <a href={data.whatchingUrl} target="_blank" rel="noreferrer">
                    Connect WhatsApp on Whatching
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </>
            )}
          </Step>

          <Step done={templates.ready} title="Message templates ready">
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every message that&apos;s turned on needs a WhatsApp template
              that&apos;s been approved. The quickest way is to use ours.
            </p>
            {!templates.ready && templates.chosen && !isTemplatesOpen && (
              <p className="mt-2 text-sm text-amber-800">
                Waiting for WhatsApp to approve your templates. This usually
                takes a few minutes.
              </p>
            )}
            {!templates.ready && !templates.chosen && !isTemplatesOpen && (
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setIsTemplatesOpen(true)}
              >
                {STORE_TEMPLATES_TITLE}
              </Button>
            )}
            {isTemplatesOpen && (
              <div className="mt-3 rounded-md border bg-muted/20 p-4">
                <h3 className="font-medium">{STORE_TEMPLATES_TITLE}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {STORE_TEMPLATES_DESCRIPTION}
                </p>
                <div className="mt-4">
                  <StoreTemplatesForm
                    connectionId={connection.id}
                    platform="shopify"
                    readyMadeTemplates={data.readyMadeTemplates}
                    templateVariables={data.templateVariables}
                    onClose={() => setIsTemplatesOpen(false)}
                  />
                </div>
              </div>
            )}
          </Step>

          <Step note title="Phone number at checkout">
            <p className="mt-0.5 text-sm text-muted-foreground">
              Order updates go to the phone number customers enter at checkout.
              In Shopify, go to Settings › Checkout and set Shipping address
              phone number to Required, or set the customer contact method to
              Phone number or email.{" "}
              <a
                href={SHOPIFY_CHECKOUT_CONTACT_HELP_URL}
                target="_blank"
                rel="noreferrer"
                className={cn(outsideLink, "font-medium text-primary")}
              >
                Editing the checkout form options
                <ExternalLink className="size-3.5" />
              </a>
            </p>
          </Step>
        </ol>
      </section>
    </div>
  );
}
