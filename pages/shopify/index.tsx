import { ShopifyApp } from "@/components/shopify/ShopifyApp";

/**
 * The Whatching app inside Shopify admin, in Shopify's iframe. It has no
 * Whatching login (_app skips the route guard here); App Bridge is loaded
 * by _document for /shopify pages only, and middleware.ts sets the
 * frame-ancestors header.
 */
export default function ShopifyPage() {
  return <ShopifyApp />;
}
