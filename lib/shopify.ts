// Helpers for the screens inside Shopify admin (/shopify). No browser or
// React imports: middleware.ts uses this file too.

import type { AxiosError } from "axios";

export const SHOPIFY_ADMIN_ORIGIN = "https://admin.shopify.com";

// The shop as Shopify sends it: the full name.myshopify.com domain.
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export const isShopifyPath = (pathname: string) =>
  pathname === "/shopify" || pathname.startsWith("/shopify/");

/**
 * The frame-ancestors policy for a /shopify page: the store's own admin
 * domain when `shop` is a real one, and always Shopify admin.
 */
export const shopifyFrameAncestors = (shop?: string | null) => {
  const ancestors =
    shop && SHOP_DOMAIN.test(shop)
      ? `https://${shop} ${SHOPIFY_ADMIN_ORIGIN}`
      : SHOPIFY_ADMIN_ORIGIN;
  return `frame-ancestors ${ancestors};`;
};

/** Store calls answer 409 not_linked once the store isn't linked any more. */
export const isNotLinkedError = (error: unknown) => {
  const response = (error as AxiosError<{ code?: string }> | null)?.response;
  return response?.status === 409 && response.data?.code === "not_linked";
};

/** Shopify Help Center: the customer contact method at checkout. */
export const SHOPIFY_CHECKOUT_CONTACT_HELP_URL =
  "https://help.shopify.com/en/manual/checkout-settings/checkout-form-options#customer-contact-method";
