import type { QueryKey } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  checkStoreConnection,
  createStoreTemplates,
  getStoreOrders,
  updateStoreSettings
} from "@/client-api/functions/stores";
import type {
  CreateStoreTemplatesPayload,
  CreateStoreTemplatesResponse,
  StoreCheckResponse,
  StoreOrdersResponse,
  UpdateStoreSettingsPayload,
  UpdateStoreSettingsResponse
} from "@/client-api/types/stores.type";
import { storeQueryKey } from "@/hooks/useStore";
import { useOrganizationStore } from "@/stores/organizationStore";

/**
 * Where the shared store pieces (message cards, cash on delivery, orders,
 * ready-made templates) send their requests. The Whatching Store page uses
 * the organisation's store routes, the default; the screens inside
 * Shopify admin provide their own (components/shopify/shopifyStoreApi.ts).
 */
export interface StoreApi {
  /** The cache entry holding the store; settings saves update it. */
  storeKey: QueryKey;
  /** Also refreshed after creating templates (the Store page's list). */
  templatesKey?: QueryKey;
  ordersKey: (connectionId: string, page: number) => QueryKey;
  updateSettings: (args: {
    connectionId: string;
    payload: UpdateStoreSettingsPayload;
  }) => Promise<UpdateStoreSettingsResponse>;
  createTemplates: (args: {
    connectionId: string;
    payload: CreateStoreTemplatesPayload;
  }) => Promise<CreateStoreTemplatesResponse>;
  getOrders: (args: {
    connectionId: string;
    page: number;
    limit: number;
  }) => Promise<StoreOrdersResponse>;
  checkConnection: (connectionId: string) => Promise<StoreCheckResponse>;
  /** Customers in the order log open their Whatching chat. */
  opensChats: boolean;
}

const StoreApiContext = createContext<StoreApi | null>(null);

export function StoreApiProvider({
  api,
  children
}: {
  api: StoreApi;
  children: ReactNode;
}) {
  return (
    <StoreApiContext.Provider value={api}>{children}</StoreApiContext.Provider>
  );
}

export function useStoreApi(): StoreApi {
  const provided = useContext(StoreApiContext);
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const whatching = useMemo<StoreApi>(
    () => ({
      storeKey: storeQueryKey(organizationId),
      templatesKey: ["templates", organizationId],
      ordersKey: (connectionId, page) => ["store-orders", connectionId, page],
      updateSettings: updateStoreSettings,
      createTemplates: createStoreTemplates,
      getOrders: getStoreOrders,
      checkConnection: checkStoreConnection,
      opensChats: true
    }),
    [organizationId]
  );
  return provided ?? whatching;
}
