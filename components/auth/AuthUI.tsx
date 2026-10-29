import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { ComponentProps, CSSProperties, ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Shared pieces for the auth cards, so every page gets the same fields,
// button and entrance timing.

/** Staggered one-time entrance; delay in seconds. */
export const enter = (
  delay: number
): { className: string; style: CSSProperties } => ({
  className: "auth-enter",
  style: { animationDelay: `${delay}s` }
});

export const authInputClass =
  "h-[46px] rounded-[var(--radius)] border-border bg-card px-3.5 text-[15px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--ring)_18%,transparent)] transition-[border-color,box-shadow,background-color] duration-150";

export function AuthHeader({
  title,
  subtitle,
  live = false
}: {
  title: string;
  subtitle: ReactNode;
  /** Adds the pulsing "online" dot before the subtitle. */
  live?: boolean;
}) {
  return (
    <div>
      <h1 className="font-heading text-[28px] leading-tight font-extrabold tracking-[-0.5px] text-foreground">
        {title}
      </h1>
      <p className="mt-1.5 flex items-center gap-2 text-[14.5px] text-muted-foreground">
        {live && (
          <span className="auth-live-dot size-[7px] shrink-0 rounded-full bg-primary" />
        )}
        {subtitle}
      </p>
    </div>
  );
}

export function AuthField({
  label,
  htmlFor,
  aside,
  error,
  delay,
  children
}: {
  label: string;
  htmlFor: string;
  aside?: ReactNode;
  error?: string;
  delay?: number;
  children: ReactNode;
}) {
  const motion = delay === undefined ? undefined : enter(delay);
  return (
    <div
      className={cn("grid gap-[7px]", motion?.className)}
      style={motion?.style}
    >
      <div className="flex items-baseline justify-between">
        <Label htmlFor={htmlFor} className="text-[13.5px] font-semibold">
          {label}
        </Label>
        {aside}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AuthInput({ className, ...props }: ComponentProps<"input">) {
  return <Input className={cn(authInputClass, className)} {...props} />;
}

export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={isVisible ? "text" : "password"}
        className={cn(authInputClass, "pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
      >
        {isVisible ? (
          <EyeOff className="size-[18px]" />
        ) : (
          <Eye className="size-[18px]" />
        )}
      </button>
    </div>
  );
}

export function AuthSubmit({
  children,
  isLoading,
  disabled,
  delay = 0.34,
  showArrow = true,
  ...props
}: ComponentProps<typeof Button> & { delay?: number; showArrow?: boolean }) {
  const motion = enter(delay);
  return (
    <div className={cn("mt-1.5", motion.className)} style={motion.style}>
      <Button
        type="submit"
        isLoading={isLoading}
        disabled={disabled || isLoading}
        className="auth-submit h-12 w-full rounded-[var(--radius)] text-[15px] font-semibold"
        {...props}
      >
        {children}
        {showArrow && <ArrowRight className="auth-arrow size-4" />}
      </Button>
    </div>
  );
}

export function AuthFormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function AuthAlt({
  children,
  delay = 0.42
}: {
  children: ReactNode;
  delay?: number;
}) {
  const motion = enter(delay);
  return (
    <p
      className={cn(
        "mt-5 text-center text-sm text-muted-foreground",
        motion.className
      )}
      style={motion.style}
    >
      {children}
    </p>
  );
}

export const authLinkClass =
  "font-semibold text-primary underline-offset-2 hover:underline";
