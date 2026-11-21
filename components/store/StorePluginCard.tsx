import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Download, Loader2, Plug } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createStorePluginCode } from "@/client-api/functions/stores";
import type {
  StoreConnection,
  StorePluginInfo
} from "@/client-api/types/stores.type";
import { useStoreApi } from "@/components/store/StoreApiContext";
import { Button } from "@/components/ui/button";
import { badgeToneClass } from "@/lib/statusPresentation";
import { storeErrorMessage } from "@/lib/store";
import {
  STORE_PLUGIN_DOWNLOAD_URL,
  isPluginQuiet,
  pluginLastSeenText
} from "@/lib/storeCarts";
import { cn } from "@/lib/utils";

const LINK_POLL_MS = 5_000;

type IssuedCode = {
  code: string;
  expiresAt: string;
  /** The link the plugin had when the code was made: a new one replaces it. */
  linkedAtBefore: string | null;
};

/**
 * The one-time code for linking the plugin. While a code is showing, the
 * store is asked for again every 5 seconds (up to the code's 15 minutes);
 * a new link from the plugin clears it with "Plugin linked." It lives in
 * the card, so it outlasts the switch from "not linked" to "linked".
 */
function usePluginCode(connectionId: string, plugin: StorePluginInfo) {
  const queryClient = useQueryClient();
  const api = useStoreApi();
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkedAt = plugin.connected ? plugin.connectedAt || null : null;

  const { mutate: getCode, isPending } = useMutation({
    mutationFn: () => createStorePluginCode(connectionId),
    meta: { showToast: false },
    onSuccess: (response) => {
      setError(null);
      setExpired(false);
      setIssued({ ...response.data, linkedAtBefore: linkedAt });
    },
    onError: (codeError) =>
      setError(
        storeErrorMessage(
          codeError,
          "We couldn't make a code just now. Please try again."
        )
      )
  });

  // Swap the code for "Get a new code" when it runs out.
  useEffect(() => {
    if (!issued) return;
    const left = new Date(issued.expiresAt).getTime() - Date.now();
    if (!(left > 0)) {
      setExpired(true);
      return;
    }
    const timer = setTimeout(() => setExpired(true), left);
    return () => clearTimeout(timer);
  }, [issued]);

  const isWaiting = Boolean(issued) && !expired;
  useEffect(() => {
    if (!isWaiting) return;
    const timer = setInterval(() => {
      void queryClient.refetchQueries({
        queryKey: api.storeKey,
        type: "active"
      });
    }, LINK_POLL_MS);
    return () => clearInterval(timer);
  }, [isWaiting, queryClient, api.storeKey]);

  // Linked (or re-linked) with the code.
  useEffect(() => {
    if (issued && linkedAt && linkedAt !== issued.linkedAtBefore) {
      toast.success("Plugin linked.");
      setIssued(null);
      setExpired(false);
    }
  }, [issued, linkedAt]);

  return { issued, expired, error, isPending, getCode: () => getCode() };
}

type PluginCode = ReturnType<typeof usePluginCode>;

/** "Get code", then the code with Copy, then "Get a new code" once it expires. */
function PluginCodeFlow({
  flow,
  canManage,
  firstLabel,
  firstVariant
}: {
  flow: PluginCode;
  canManage: boolean;
  firstLabel: string;
  firstVariant: "default" | "outline";
}) {
  const { issued, expired, error, isPending, getCode } = flow;

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied.");
    } catch {
      toast.error(
        "The code couldn't be copied. Select it and copy it instead."
      );
    }
  };

  return (
    <div className="space-y-3">
      {issued && !expired ? (
        <div className="space-y-3 rounded-md border bg-muted/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p
              className="font-mono text-2xl font-semibold tracking-wider break-all"
              aria-label="Your code"
            >
              {issued.code}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => copy(issued.code)}
            >
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            In WordPress, open WooCommerce › Whatching, paste this code and
            click Connect. The code works once and expires in 15 minutes.
          </p>
        </div>
      ) : (
        <Button
          variant={issued ? "default" : firstVariant}
          onClick={getCode}
          disabled={!canManage || isPending}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {issued ? "Get a new code" : firstLabel}
        </Button>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {n}
    </span>
  );
}

/** The WordPress plugin for cart reminders: install and link, or linked. */
export function StorePluginCard({
  connection,
  canManage
}: {
  connection: StoreConnection;
  canManage: boolean;
}) {
  const plugin = connection.plugin as StorePluginInfo;
  const flow = usePluginCode(connection.id, plugin);
  const lastChecked = plugin.lastSeenAt
    ? `last checked in ${pluginLastSeenText(plugin.lastSeenAt)}`
    : "";

  return (
    <section className="rounded-lg border bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Plug className="size-5 text-primary" />
        <h2 className="font-heading text-xl font-semibold">
          Cart reminders plugin
        </h2>
        {plugin.connected && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              badgeToneClass.green
            )}
          >
            Linked
          </span>
        )}
      </div>

      {plugin.connected ? (
        <div className="mt-2 space-y-4">
          {(plugin.version || lastChecked) && (
            <p className="text-sm text-muted-foreground">
              {plugin.version
                ? [`Version ${plugin.version}`, lastChecked]
                    .filter(Boolean)
                    .join(" · ")
                : lastChecked.charAt(0).toUpperCase() + lastChecked.slice(1)}
            </p>
          )}
          {isPluginQuiet(plugin.lastSeenAt) && (
            <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              We haven&apos;t heard from the plugin in a while. Check it&apos;s
              still active in WordPress.
            </p>
          )}
          {canManage && (
            <PluginCodeFlow
              flow={flow}
              canManage={canManage}
              firstLabel="Get a new code"
              firstVariant="outline"
            />
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Send WhatsApp reminders to shoppers who leave checkout. Install our
            free WordPress plugin, then link it with a code.
          </p>
          <ol className="mt-5 space-y-5">
            <li className="flex gap-3">
              <StepNumber n={1} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Download the plugin.</p>
                <Button asChild variant="outline" className="mt-2">
                  <a href={STORE_PLUGIN_DOWNLOAD_URL} download>
                    <Download className="size-4" />
                    Download plugin (.zip)
                  </a>
                </Button>
              </div>
            </li>
            <li className="flex gap-3">
              <StepNumber n={2} />
              <p className="min-w-0 flex-1 text-sm">
                In WordPress, go to Plugins › Add New › Upload Plugin, choose
                the file, then click Activate.
              </p>
            </li>
            <li className="flex gap-3">
              <StepNumber n={3} />
              <div className="min-w-0 flex-1">
                <p className="mb-2 font-medium">Get a code.</p>
                <PluginCodeFlow
                  flow={flow}
                  canManage={canManage}
                  firstLabel="Get code"
                  firstVariant="default"
                />
              </div>
            </li>
          </ol>
        </>
      )}
    </section>
  );
}
