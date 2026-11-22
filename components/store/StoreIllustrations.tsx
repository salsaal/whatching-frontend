import { cn } from "@/lib/utils";

/**
 * A cart reminder arriving in a chat: a bubble with a cart and a "bring
 * back the cart" button. Decorative; drawn in the app's colours.
 */
export function CartReminderIllustration({
  className
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 150"
      fill="none"
      aria-hidden="true"
      className={cn("text-primary", className)}
    >
      {/* Chat background */}
      <rect width="220" height="150" rx="16" fill="#efeae2" />
      <circle cx="26" cy="26" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="194" cy="124" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="176" cy="22" r="2" fill="currentColor" opacity="0.12" />
      {/* Message bubble */}
      <path
        d="M34 30a10 10 0 0 1 10-10h122a10 10 0 0 1 10 10v58a10 10 0 0 1-10 10H44a10 10 0 0 1-10-10V30Z"
        fill="#fff"
      />
      <path d="M34 26 26 20h12z" fill="#fff" />
      {/* Cart */}
      <rect
        x="46"
        y="32"
        width="40"
        height="40"
        rx="10"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M55 43h4l4 15h14l3-10H62"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="65" cy="63" r="2.2" fill="currentColor" />
      <circle cx="75" cy="63" r="2.2" fill="currentColor" />
      {/* Text lines */}
      <rect x="96" y="36" width="66" height="7" rx="3.5" fill="#d9dee3" />
      <rect x="96" y="50" width="54" height="7" rx="3.5" fill="#e4e8ec" />
      <rect x="96" y="64" width="40" height="7" rx="3.5" fill="#e4e8ec" />
      <rect x="140" y="84" width="26" height="5" rx="2.5" fill="#e4e8ec" />
      {/* Link button */}
      <rect x="34" y="104" width="142" height="28" rx="9" fill="#fff" />
      <rect
        x="78"
        y="114"
        width="54"
        height="8"
        rx="4"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M140 113h5v5M145 113l-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}
