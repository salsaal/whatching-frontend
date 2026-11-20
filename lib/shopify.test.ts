import { describe, expect, it } from "vitest";

import {
  isNotLinkedError,
  isShopifyPath,
  shopifyFrameAncestors
} from "@/lib/shopify";

describe("shopifyFrameAncestors", () => {
  it("allows the store's own admin and Shopify admin", () => {
    expect(shopifyFrameAncestors("whatching-test.myshopify.com")).toBe(
      "frame-ancestors https://whatching-test.myshopify.com https://admin.shopify.com;"
    );
  });

  it("allows only Shopify admin for a missing or unexpected shop", () => {
    const adminOnly = "frame-ancestors https://admin.shopify.com;";
    expect(shopifyFrameAncestors(null)).toBe(adminOnly);
    expect(shopifyFrameAncestors("")).toBe(adminOnly);
    expect(shopifyFrameAncestors("evil.com")).toBe(adminOnly);
    expect(shopifyFrameAncestors("shop.myshopify.com.evil.com")).toBe(
      adminOnly
    );
    expect(shopifyFrameAncestors("Shop.myshopify.com")).toBe(adminOnly);
    expect(shopifyFrameAncestors("-shop.myshopify.com")).toBe(adminOnly);
    expect(shopifyFrameAncestors("shop.myshopify.com https://evil.com")).toBe(
      adminOnly
    );
  });
});

describe("isShopifyPath", () => {
  it("matches the /shopify section only", () => {
    expect(isShopifyPath("/shopify")).toBe(true);
    expect(isShopifyPath("/shopify/anything")).toBe(true);
    expect(isShopifyPath("/shopifyish")).toBe(false);
    expect(isShopifyPath("/store")).toBe(false);
  });
});

describe("isNotLinkedError", () => {
  it("is a 409 with the not_linked code", () => {
    expect(
      isNotLinkedError({
        response: { status: 409, data: { code: "not_linked" } }
      })
    ).toBe(true);
    expect(
      isNotLinkedError({ response: { status: 409, data: { message: "x" } } })
    ).toBe(false);
    expect(isNotLinkedError(null)).toBe(false);
  });
});
