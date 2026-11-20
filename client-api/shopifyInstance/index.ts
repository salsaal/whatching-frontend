import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

/**
 * Requests from the screens inside Shopify admin (/shopify). There's no
 * Whatching login there and no cookies: every request carries a fresh
 * Shopify ID token from App Bridge, which only lasts a minute, so it's
 * never cached. The API is on another domain, so App Bridge doesn't add
 * the token itself.
 */

/** Shown when a fresh session is refused too. */
export const SHOPIFY_RELOAD_MESSAGE = "Please reload the app.";

const RETRY_HEADER = "x-shopify-retry-invalid-session-request";

interface ShopifyAppBridge {
  idToken: () => Promise<string>;
}

declare global {
  interface Window {
    /** App Bridge, loaded by _document on /shopify pages only. */
    shopify?: ShopifyAppBridge;
  }
}

/** The page isn't open inside Shopify admin (App Bridge isn't there). */
export class NotInShopifyError extends Error {
  constructor() {
    super("Open Whatching from your Shopify admin.");
    this.name = "NotInShopifyError";
  }
}

export const getShopifyIdToken = async () => {
  const appBridge = typeof window === "undefined" ? undefined : window.shopify;
  if (typeof appBridge?.idToken !== "function") throw new NotInShopifyError();
  return appBridge.idToken();
};

const headerValue = (headers: unknown, name: string) => {
  if (!headers || typeof headers !== "object") return undefined;
  const lookup = headers as Record<string, unknown> & {
    get?: (header: string) => unknown;
  };
  return typeof lookup.get === "function" ? lookup.get(name) : lookup[name];
};

/** A 401 that asks for a fresh ID token and one retry. */
export const isStaleShopifySession = (error: unknown) => {
  const response = (error as AxiosError | null)?.response;
  return (
    response?.status === 401 &&
    Boolean(headerValue(response.headers, RETRY_HEADER))
  );
};

const shopifyApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: false
});

shopifyApi.interceptors.request.use(async (config) => {
  config.headers.set("Authorization", `Bearer ${await getShopifyIdToken()}`);
  config.headers.set("Content-Type", "application/json");
  // Same as the main client: a test tunnel's warning page would answer
  // instead of the API otherwise.
  if (process.env.NEXT_PUBLIC_API_BASE_URL?.includes("ngrok-free.app")) {
    config.headers.set("ngrok-skip-browser-warning", "true");
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & {
  _sessionRetried?: boolean;
};

shopifyApi.interceptors.response.use(undefined, async (error: AxiosError) => {
  if (!isStaleShopifySession(error)) throw error;
  const config = error.config as RetriableConfig | undefined;
  if (config && !config._sessionRetried) {
    config._sessionRetried = true;
    // The request interceptor fetches a fresh token for the retry.
    return shopifyApi(config);
  }
  if (error.response) {
    error.response.data = {
      ...(error.response.data as object),
      message: SHOPIFY_RELOAD_MESSAGE
    };
  }
  throw error;
});

export default shopifyApi;
