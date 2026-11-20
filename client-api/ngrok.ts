/**
 * ngrok's free tunnels (ngrok-free.app, ngrok-free.dev) answer with a
 * browser warning page instead of the API unless this header is sent.
 */
export const usesNgrokFreeTunnel = (url?: string) =>
  /\.ngrok-free\.(app|dev)(\/|:|$)/i.test(url || "");

export const NGROK_SKIP_HEADER = "ngrok-skip-browser-warning";
