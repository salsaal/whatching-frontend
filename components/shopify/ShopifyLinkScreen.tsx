import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { linkShopify } from "@/client-api/functions/shopify";
import type {
  ShopifySessionResponse,
  ShopifyShopInfo,
  ShopifyWorkspaceChoice
} from "@/client-api/types/shopify.type";
import { SHOPIFY_SESSION_KEY } from "@/components/shopify/shopifyStoreApi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { storeErrorMessage } from "@/lib/store";

const OPT_IN_TEXT =
  "My store's checkout tells customers they'll get order updates on WhatsApp.";

/**
 * Link this Shopify store to a Whatching workspace, with the merchant's
 * Whatching email and password. Someone in several workspaces picks one;
 * the password is kept in memory for that step only.
 */
export function ShopifyLinkScreen({ shop }: { shop: ShopifyShopInfo }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [workspaces, setWorkspaces] = useState<ShopifyWorkspaceChoice[] | null>(
    null
  );
  const [workspaceId, setWorkspaceId] = useState("");
  const [error, setError] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: linkShopify,
    meta: { showToast: false },
    onSuccess: (response) => {
      const data = response.data;
      if (data.needsWorkspace) {
        setWorkspaces(data.workspaces);
        setWorkspaceId("");
        return;
      }
      setPassword("");
      queryClient.setQueryData<ShopifySessionResponse>(SHOPIFY_SESSION_KEY, {
        status: response.status,
        data: { shop: data.shop, link: data.link }
      });
      if (data.link) toast.success("Your Whatching account is connected.");
    },
    onError: (linkError) =>
      setError(
        storeErrorMessage(
          linkError,
          "We couldn't connect your account. Please try again."
        )
      )
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    mutate({
      email: email.trim(),
      password,
      optInConfirmed: true,
      ...(workspaces && workspaceId ? { workspaceId } : {})
    });
  };

  const startOver = () => {
    setWorkspaces(null);
    setWorkspaceId("");
    setPassword("");
    setError("");
  };

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-xs sm:p-8">
      <h1 className="font-heading text-2xl font-semibold">
        Connect your Whatching account
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Link {shop.name} to your Whatching workspace to send order updates on
        WhatsApp. Only workspace owners and admins can connect.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {workspaces ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Which workspace should this store use?
            </p>
            <RadioGroup
              value={workspaceId}
              onValueChange={setWorkspaceId}
              aria-label="Workspace"
            >
              {workspaces.map((workspace) => (
                <Label
                  key={workspace.id}
                  htmlFor={`workspace-${workspace.id}`}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem
                    id={`workspace-${workspace.id}`}
                    value={workspace.id}
                  />
                  {workspace.name || "Unnamed workspace"}
                </Label>
              ))}
            </RadioGroup>
            <button
              type="button"
              onClick={startOver}
              className="cursor-pointer text-sm text-primary hover:underline"
            >
              Use a different account
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="shopify-link-email">Email</Label>
              <Input
                id="shopify-link-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shopify-link-password">Password</Label>
              <Input
                id="shopify-link-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                checked={optIn}
                onCheckedChange={(value) => setOptIn(value === true)}
                className="mt-0.5"
              />
              {OPT_IN_TEXT}
            </label>
          </>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={
            isPending ||
            !email.trim() ||
            !password ||
            !optIn ||
            Boolean(workspaces && !workspaceId)
          }
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Connect
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        New to Whatching?{" "}
        {/* Sign-up happens on the Whatching website, in a new tab. */}
        <Link
          href="/auth/signup"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </section>
  );
}
