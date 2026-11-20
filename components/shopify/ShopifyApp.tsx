import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { openShopifySession } from "@/client-api/functions/shopify";
import { NotInShopifyError } from "@/client-api/shopifyInstance";
import { ShopifyLinkScreen } from "@/components/shopify/ShopifyLinkScreen";
import { ShopifyStore } from "@/components/shopify/ShopifyStore";
import { SHOPIFY_SESSION_KEY } from "@/components/shopify/shopifyStoreApi";
import { Button } from "@/components/ui/button";
import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { storeErrorMessage } from "@/lib/store";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}

/**
 * The Whatching app inside Shopify admin. Each open starts a session
 * (which also finishes setting up access after an install), then shows
 * the Link screen or the store.
 */
export function ShopifyApp() {
  const session = useQuery({
    queryKey: SHOPIFY_SESSION_KEY,
    queryFn: openShopifySession,
    staleTime: Infinity,
    retry: false
  });

  if (session.isPending) {
    return (
      <Shell>
        <DetailLoadingSkeleton />
      </Shell>
    );
  }

  if (session.isError) {
    const outsideShopify = session.error instanceof NotInShopifyError;
    return (
      <Shell>
        <section className="mx-auto mt-10 max-w-lg rounded-lg border bg-white p-6 text-center shadow-xs">
          <AlertTriangle className="mx-auto size-8 text-amber-600" />
          <p className="mt-3 font-medium">
            {outsideShopify
              ? session.error.message
              : storeErrorMessage(
                  session.error,
                  "Whatching couldn't load just now. Please reload the app."
                )}
          </p>
          {!outsideShopify && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => session.refetch()}
              disabled={session.isFetching}
            >
              Try again
            </Button>
          )}
        </section>
      </Shell>
    );
  }

  const { shop, link } = session.data.data;
  return (
    <Shell>
      {link ? (
        <ShopifyStore shop={shop} link={link} />
      ) : (
        <ShopifyLinkScreen shop={shop} />
      )}
    </Shell>
  );
}
