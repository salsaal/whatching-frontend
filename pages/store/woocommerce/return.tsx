import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { getStore } from "@/client-api/functions/stores";
import { StoreGate } from "@/components/store/StoreGate";
import { Button } from "@/components/ui/button";
import { storeQueryKey } from "@/hooks/useStore";
import { storeReturnOutcome } from "@/lib/store";
import { useOrganizationStore } from "@/stores/organizationStore";

const POLL_MS = 2_000;
const GIVE_UP_MS = 60_000;

function Panel({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-lg rounded-lg border bg-white p-6 text-center shadow-xs sm:p-8">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h1 className="mt-4 font-heading text-xl font-semibold">{title}</h1>
      {children}
    </section>
  );
}

const tryAgain = (
  <Button asChild className="mt-5">
    <Link href="/store">Try again</Link>
  </Button>
);

/** WooCommerce approved: wait for the store to finish setting up. */
function FinishingSetup() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const { data } = useQuery({
    queryKey: storeQueryKey(organizationId),
    queryFn: getStore,
    enabled: Boolean(organizationId),
    refetchOnMount: "always",
    refetchInterval: (query) => {
      const outcome = storeReturnOutcome(query.state.data?.data.connection);
      return outcome === "waiting" && Date.now() - startedAt < GIVE_UP_MS
        ? POLL_MS
        : false;
    }
  });
  const connection = data?.data.connection;
  const outcome = storeReturnOutcome(connection);

  useEffect(() => {
    if (outcome !== "connected") return;
    toast.success("Your store is connected.", { id: "store-connected" });
    void queryClient.invalidateQueries({
      queryKey: storeQueryKey(organizationId)
    });
    router.replace("/store");
  }, [organizationId, outcome, queryClient, router]);

  if (outcome === "failed") {
    return (
      <Panel
        icon={<AlertTriangle className="size-6 text-amber-600" />}
        title="Your store couldn't be connected"
      >
        <p className="mt-2 text-sm text-muted-foreground">
          {connection?.setupFailure?.message}
        </p>
        {tryAgain}
      </Panel>
    );
  }

  if (timedOut && outcome === "waiting") {
    return (
      <Panel
        icon={<Clock className="size-6 text-muted-foreground" />}
        title="This is taking longer than usual"
      >
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll keep trying. Check back in a minute.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/store">Go to Store</Link>
        </Button>
      </Panel>
    );
  }

  return (
    <Panel
      icon={<Loader2 className="size-6 animate-spin text-primary" />}
      title="Finishing setup…"
    >
      <p className="mt-2 text-sm text-muted-foreground">
        Connecting your store. This usually takes a few seconds.
      </p>
    </Panel>
  );
}

/**
 * WooCommerce sends the merchant here after Approve or Deny, with
 * `success` and `user_id`. Only `success` is read; the rest of the query
 * is dropped from the address bar straight away and never shown or logged.
 */
export default function StoreWooCommerceReturnPage() {
  const router = useRouter();
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const value =
      typeof router.query.success === "string" ? router.query.success : "";
    setSuccess(value);
    router.replace(
      { pathname: router.pathname, query: value ? { success: value } : {} },
      undefined,
      { shallow: true }
    );
    // Read once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  return (
    <StoreGate>
      {() =>
        success === null ? (
          <Panel
            icon={<Loader2 className="size-6 animate-spin text-primary" />}
            title="Finishing setup…"
          />
        ) : success === "1" ? (
          <FinishingSetup />
        ) : (
          <Panel
            icon={<XCircle className="size-6 text-muted-foreground" />}
            title="Nothing was changed"
          >
            <p className="mt-2 text-sm text-muted-foreground">
              You didn&apos;t approve the connection, so nothing was changed.
            </p>
            {tryAgain}
          </Panel>
        )
      }
    </StoreGate>
  );
}
