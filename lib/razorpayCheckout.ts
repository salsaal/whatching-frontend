export type RazorpayCheckoutResponse = {
  razorpay_payment_id?: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  subscription_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  callback_url?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler?: (response: RazorpayCheckoutResponse) => void;
  modal?: {
    confirm_close?: boolean;
    ondismiss?: () => void;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
    };
  }
}

const razorpayCheckoutScriptId = "razorpay-checkout-js";

// Loads Razorpay's Checkout.js, which renders an embedded modal overlay on
// top of our own page -- unlike a Payment Link, the customer never leaves
// the site, and payment status is available immediately via the `handler`
// callback with no redirect/callback_url needed.
export const loadRazorpayCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay checkout can only open in the browser."));
      return;
    }

    if (window.Razorpay) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(
      razorpayCheckoutScriptId
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Razorpay checkout failed to load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = razorpayCheckoutScriptId;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Razorpay checkout failed to load."));
    document.body.appendChild(script);
  });
