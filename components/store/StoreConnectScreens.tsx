import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Info, Loader2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { connectWooCommerce } from "@/client-api/functions/stores";
import type { StoreConnection } from "@/client-api/types/stores.type";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { storeErrorMessage } from "@/lib/store";
import { disconnectedByOwner, formatDayMonth } from "@/lib/storePage";
import { useOrganizationStore } from "@/stores/organizationStore";

/** Screen A: the plan doesn't include store connections. */
export function StorePlanNotice() {
  const { isOwner } = useCurrentMembership();
  return (
    <section className="rounded-lg border bg-white p-6 shadow-xs sm:p-8">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShoppingBag className="size-5" />
      </div>
      <p className="mt-4 max-w-xl text-sm text-muted-foreground">
        Connect your online store to send order updates on WhatsApp. Store
        connections are included in the Basic and Pro plans.
      </p>
      {isOwner ? (
        <Button asChild className="mt-5">
          <Link href="/settings/billing">See plans</Link>
        </Button>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Ask your organisation owner to change the plan.
        </p>
      )}
    </section>
  );
}

/**
 * Screen B: connect a WooCommerce store. Shown with no store, an earlier
 * attempt that wasn't finished (pending) or one that was removed or failed
 * to set up (disconnected; its message explains why).
 */
export function StoreConnectForm({
  previous
}: {
  previous: StoreConnection | null;
}) {
  const { can } = useCurrentMembership();
  const canManage = can("integrations:manage");
  const workspaceName = useOrganizationStore(
    (state) => state.activeOrganization?.name || ""
  );
  const [storeUrl, setStoreUrl] = useState(
    previous?.status === "pending" ? previous.storeUrl || "" : ""
  );
  const [storeName, setStoreName] = useState(
    (previous?.status === "pending" && previous.storeName) || workspaceName
  );
  const [optInConfirmed, setOptInConfirmed] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [error, setError] = useState("");

  const { mutate: connect, isPending } = useMutation({
    mutationFn: connectWooCommerce,
    meta: { showToast: false },
    onSuccess: (response) => {
      // Same tab: WooCommerce sends the merchant back to
      // /store/woocommerce/return when they approve or deny.
      window.location.assign(response.data.authorizeUrl);
    },
    onError: (connectError) =>
      setError(
        storeErrorMessage(
          connectError,
          "We couldn't start connecting your store. Please try again."
        )
      )
  });

  const nameForSentence = storeName.trim() || "your store";
  const canSubmit =
    canManage && storeUrl.trim().length >= 3 && optInConfirmed && !isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    connect({
      storeUrl: storeUrl.trim(),
      storeName: storeName.trim() || undefined,
      optInConfirmed
    });
  };

  return (
    <section className="rounded-lg border bg-white shadow-xs">
      <div className="border-b p-5 sm:p-6">
        <h2 className="font-heading text-xl font-semibold">
          Connect your WooCommerce store
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send order confirmations, cash-on-delivery checks and completed-order
          updates to your customers on WhatsApp.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
        {previous?.status === "disconnected" && previous.setupFailure && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>{previous.setupFailure.message}</p>
          </div>
        )}
        {disconnectedByOwner(previous) && previous?.disconnectedAt && (
          <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
            You disconnected {previous.storeName} on{" "}
            {formatDayMonth(new Date(previous.disconnectedAt))}. Connect it
            again below.
          </p>
        )}
        {previous?.status === "pending" && (
          <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
            Your last attempt to connect wasn&apos;t finished. Connect again to
            start over.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="store-url">Store address</Label>
            <Input
              id="store-url"
              className="mt-2"
              value={storeUrl}
              onChange={(event) => setStoreUrl(event.target.value)}
              placeholder="https://yourstore.com"
              inputMode="url"
              autoComplete="url"
              disabled={!canManage || isPending}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your store needs a secure address (https).
            </p>
          </div>
          <div>
            <Label htmlFor="store-name">Store name customers see</Label>
            <Input
              id="store-name"
              className="mt-2"
              value={storeName}
              maxLength={80}
              onChange={(event) => setStoreName(event.target.value)}
              disabled={!canManage || isPending}
            />
          </div>
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={optInConfirmed}
              onCheckedChange={(checked) => setOptInConfirmed(checked === true)}
              disabled={!canManage || isPending}
            />
            <span>
              My store&apos;s checkout tells customers they&apos;ll receive
              order updates from {nameForSentence} on WhatsApp.
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowExample((value) => !value)}
            className="mt-1 ml-7 cursor-pointer text-xs font-medium text-primary hover:underline"
            aria-expanded={showExample}
          >
            What should it say?
          </button>
          {showExample && (
            <p className="mt-2 ml-7 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              Add a short line near the checkout button, for example:{" "}
              <span className="font-medium text-foreground">
                &ldquo;We&apos;ll send your order updates on WhatsApp.&rdquo;
              </span>
            </p>
          )}
        </div>

        <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
          <p>
            WooCommerce will ask you to approve access. It lists orders,
            products, coupons and customers because WooCommerce only offers one
            combined level of access. Whatching only uses your orders, to send
            order messages and record cash-on-delivery answers.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSubmit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Connect WooCommerce
          </Button>
          {!canManage && (
            <p className="text-sm text-muted-foreground">
              Ask your organisation owner or an admin to connect your store.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
