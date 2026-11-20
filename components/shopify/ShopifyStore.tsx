import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { getShopifyStore } from "@/client-api/functions/shopify";
import type {
  ShopifyLinkInfo,
  ShopifyShopInfo
} from "@/client-api/types/shopify.type";
import { ShopifyHome } from "@/components/shopify/ShopifyHome";
import {
  SHOPIFY_STORE_KEY,
  createShopifyStoreApi,
  showShopifyLinkScreen
} from "@/components/shopify/shopifyStoreApi";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { StoreApiProvider } from "@/components/store/StoreApiContext";
import { StoreCodSection } from "@/components/store/StoreCodSection";
import { StoreMessagesSection } from "@/components/store/StoreMessagesSection";
import { StoreOrderLog } from "@/components/store/StoreOrderLog";
import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isNotLinkedError } from "@/lib/shopify";
import { storeErrorMessage, storeTemplateOptions } from "@/lib/store";

const SETTING_UP_POLL_MS = 5_000;

/**
 * The store screens for a linked Shopify store: Home (status and setup),
 * Messages, Cash on delivery and Orders. Everyone in this Shopify admin
 * can change them; the backend checks the store is linked on every call.
 */
export function ShopifyStore({
  shop,
  link
}: {
  shop: ShopifyShopInfo;
  link: ShopifyLinkInfo;
}) {
  const queryClient = useQueryClient();
  const store = useQuery({
    queryKey: SHOPIFY_STORE_KEY,
    queryFn: getShopifyStore,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.data.connection?.status === "connecting"
        ? SETTING_UP_POLL_MS
        : false
  });

  const api = useMemo(
    () =>
      createShopifyStoreApi(() => {
        toast("This store isn't linked to Whatching any more.", {
          id: "shopify-not-linked"
        });
        showShopifyLinkScreen(queryClient);
      }),
    [queryClient]
  );

  const notLinked = store.isError && isNotLinkedError(store.error);
  useEffect(() => {
    if (notLinked) showShopifyLinkScreen(queryClient);
  }, [notLinked, queryClient]);

  const templates = store.data?.data.templates;
  const templateLists = useMemo(
    () => ({
      options: storeTemplateOptions(templates || []),
      allTemplates: templates || []
    }),
    [templates]
  );

  if (store.isPending || notLinked) return <DetailLoadingSkeleton />;

  const data = store.data?.data;
  const connection = data?.connection;
  if (store.isError || !data || !connection) {
    return (
      <QueryErrorState
        message={storeErrorMessage(
          store.error,
          "Your store couldn't be loaded. Please reload the app."
        )}
      />
    );
  }

  return (
    <StoreApiProvider api={api}>
      <div className="space-y-5">
        <header>
          <p className="text-sm font-medium text-primary">Whatching</p>
          <h1 className="font-heading text-2xl font-semibold">
            Order updates on WhatsApp
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {shop.name} · linked to the {link.workspaceName || "Whatching"}{" "}
            workspace
          </p>
        </header>

        <Tabs defaultValue="home" className="gap-5">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="cod">Cash on delivery</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>
          <TabsContent value="home">
            <ShopifyHome data={data} connection={connection} shop={shop} />
          </TabsContent>
          <TabsContent value="messages">
            <StoreMessagesSection
              connection={connection}
              templateVariables={data.templateVariables}
              templates={templateLists}
              canManage
            />
          </TabsContent>
          <TabsContent value="cod">
            <StoreCodSection connection={connection} canManage />
          </TabsContent>
          <TabsContent value="orders">
            <StoreOrderLog connectionId={connection.id} platform="shopify" />
          </TabsContent>
        </Tabs>
      </div>
    </StoreApiProvider>
  );
}
