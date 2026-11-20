import {
  type DocumentProps,
  Head,
  Html,
  Main,
  NextScript
} from "next/document";

import { isShopifyPath } from "@/lib/shopify";

export default function Document({ __NEXT_DATA__ }: DocumentProps) {
  // App Bridge is for the screens inside Shopify admin only; the rest of
  // Whatching never loads it.
  const isShopify = isShopifyPath(__NEXT_DATA__.page);
  return (
    <Html lang="en">
      <Head>
        {isShopify && (
          <>
            <meta
              name="shopify-api-key"
              content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ""}
            />
            {/* Shopify requires App Bridge as a plain script, first in the
                head, with no async or defer. */}
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
          </>
        )}
        <link rel="icon" href="/favicon2.ico" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
