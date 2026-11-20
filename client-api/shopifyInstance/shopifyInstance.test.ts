import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import shopifyApi, {
  NotInShopifyError,
  SHOPIFY_RELOAD_MESSAGE
} from "@/client-api/shopifyInstance";

type Reply = { status: number; retryHeader?: boolean };

// Answers each request in turn and records the token it carried.
const answer = (replies: Reply[]) => {
  const tokens: string[] = [];
  shopifyApi.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    tokens.push(String(config.headers.get("Authorization")));
    const reply = replies.shift() ?? { status: 200 };
    const response = {
      data:
        reply.status === 200
          ? { status: "success" }
          : { status: "fail", message: "Your Shopify session has expired." },
      status: reply.status,
      statusText: "",
      headers: new AxiosHeaders(
        reply.retryHeader
          ? { "x-shopify-retry-invalid-session-request": "1" }
          : {}
      ),
      config
    };
    if (reply.status >= 400) {
      throw new AxiosError(
        "Request failed",
        "ERR_BAD_REQUEST",
        config,
        null,
        response
      );
    }
    return response;
  };
  return tokens;
};

let tokenCount = 0;
beforeEach(() => {
  tokenCount = 0;
  window.shopify = {
    idToken: vi.fn(async () => `token-${++tokenCount}`)
  };
});
afterEach(() => {
  delete window.shopify;
});

describe("the Shopify request client", () => {
  it("sends a fresh ID token with every request", async () => {
    const tokens = answer([{ status: 200 }, { status: 200 }]);
    await shopifyApi.get("/shopify/store");
    await shopifyApi.get("/shopify/store");
    expect(tokens).toEqual(["Bearer token-1", "Bearer token-2"]);
  });

  it("retries once with a fresh token when the session was stale", async () => {
    const tokens = answer([
      { status: 401, retryHeader: true },
      { status: 200 }
    ]);
    const response = await shopifyApi.post("/shopify/session");
    expect(response.status).toBe(200);
    expect(tokens).toEqual(["Bearer token-1", "Bearer token-2"]);
  });

  it("asks for a reload when the fresh token is refused too", async () => {
    const tokens = answer([
      { status: 401, retryHeader: true },
      { status: 401, retryHeader: true }
    ]);
    const error = await shopifyApi.post("/shopify/session").catch((e) => e);
    expect(error.response.data.message).toBe(SHOPIFY_RELOAD_MESSAGE);
    expect(tokens).toHaveLength(2);
  });

  it("doesn't retry other errors", async () => {
    const tokens = answer([{ status: 401 }, { status: 200 }]);
    const error = await shopifyApi.get("/shopify/store").catch((e) => e);
    expect(error.response.status).toBe(401);
    expect(tokens).toHaveLength(1);
  });

  it("explains when the page isn't open inside Shopify admin", async () => {
    delete window.shopify;
    answer([{ status: 200 }]);
    await expect(shopifyApi.get("/shopify/store")).rejects.toBeInstanceOf(
      NotInShopifyError
    );
  });
});
