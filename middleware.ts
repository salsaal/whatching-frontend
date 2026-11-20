import { type NextRequest, NextResponse } from "next/server";

import { shopifyFrameAncestors } from "@/lib/shopify";

/**
 * Shopify admin shows /shopify pages in an iframe; only that store's admin
 * and Shopify admin may frame them. The shop differs for every store, so
 * the header is set per request.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set(
    "Content-Security-Policy",
    shopifyFrameAncestors(request.nextUrl.searchParams.get("shop"))
  );
  return response;
}

export const config = {
  matcher: ["/shopify", "/shopify/:path*"]
};
