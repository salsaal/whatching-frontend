// The screens inside Shopify admin (/shopify). Shapes follow the backend's
// /api/v1/shopify routes; see docs/SHOPIFY_EMBEDDED_FRONTEND_SPEC.md in the
// backend repo.

import type {
  StoreResponse,
  StoreTemplateChoice,
  UpdateStoreSettingsPayload
} from "./stores.type";

export interface ShopifyShopInfo {
  domain: string;
  name: string;
}

export interface ShopifyLinkInfo {
  workspaceName: string;
  linkedAt?: string | null;
}

export interface ShopifySession {
  shop: ShopifyShopInfo;
  /** null until the store is linked to a Whatching workspace. */
  link: ShopifyLinkInfo | null;
}

export interface ShopifySessionResponse {
  status: string;
  data: ShopifySession;
}

export interface ShopifyLinkPayload {
  email: string;
  password: string;
  optInConfirmed: true;
  workspaceId?: string;
}

export interface ShopifyWorkspaceChoice {
  id: string;
  name: string;
}

export interface ShopifyLinkResponse {
  status: string;
  /**
   * Linked (shop + link), or, for someone in several workspaces, the list
   * to choose from; the same request then goes again with `workspaceId`.
   */
  data:
    | (ShopifySession & { needsWorkspace?: false })
    | { needsWorkspace: true; workspaces: ShopifyWorkspaceChoice[] };
}

/** The Store page's data, plus what the setup checklist needs. */
export type ShopifyStoreData = StoreResponse["data"] & {
  workspace: { name: string };
  whatsappConnected: boolean;
  /** The Whatching website, for things that happen there. */
  whatchingUrl: string;
  /** Approved and in-review templates, for the message pickers. */
  templates: StoreTemplateChoice[];
};

export interface ShopifyStoreResponse {
  status: string;
  data: ShopifyStoreData;
}

export type ShopifyStoreSettingsPayload = UpdateStoreSettingsPayload;
