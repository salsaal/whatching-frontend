import type { QueryClient } from "@tanstack/react-query";

import {
  checkShopifyStore,
  createShopifyStoreTemplates,
  getShopifyStoreOrders,
  updateShopifyStoreSettings
} from "@/client-api/functions/shopify";
import type { ShopifySessionResponse } from "@/client-api/types/shopify.type";
import type { StoreApi } from "@/components/store/StoreApiContext";
import { isNotLinkedError } from "@/lib/shopify";

export const SHOPIFY_SESSION_KEY = ["shopify", "session"];
export const SHOPIFY_STORE_KEY = ["shopify", "store"];
const SHOPIFY_ORDERS_KEY = ["shopify", "store-orders"];

/** Back to the Link screen: the store isn't linked (any more). */
export const showShopifyLinkScreen = (queryClient: QueryClient) => {
  queryClient.setQueryData<ShopifySessionResponse>(
    SHOPIFY_SESSION_KEY,
    (current) =>
      current && { ...current, data: { ...current.data, link: null } }
  );
  queryClient.removeQueries({ queryKey: SHOPIFY_STORE_KEY });
  queryClient.removeQueries({ queryKey: SHOPIFY_ORDERS_KEY });
};

/**
 * The shared store pieces' requests, for the store this Shopify admin
 * belongs to (the ID token says which, so no connection id is sent). Any
 * store call answering 409 not_linked calls `onNotLinked`.
 */
export const createShopifyStoreApi = (onNotLinked: () => void): StoreApi => {
  const watch = async <T>(request: Promise<T>) => {
    try {
      return await request;
    } catch (error) {
      if (isNotLinkedError(error)) onNotLinked();
      throw error;
    }
  };
  return {
    storeKey: SHOPIFY_STORE_KEY,
    ordersKey: (_connectionId, page) => [...SHOPIFY_ORDERS_KEY, page],
    updateSettings: ({ payload }) => watch(updateShopifyStoreSettings(payload)),
    createTemplates: ({ payload }) =>
      watch(createShopifyStoreTemplates(payload)),
    getOrders: ({ page, limit }) =>
      watch(getShopifyStoreOrders({ page, limit })),
    checkConnection: () => watch(checkShopifyStore()),
    // There's no Whatching inbox inside Shopify admin.
    opensChats: false
  };
};
