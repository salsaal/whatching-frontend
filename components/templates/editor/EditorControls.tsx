import { Check } from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  className
}: {
  value: T;
  options: Array<{
    value: T;
    label: string;
    disabled?: boolean;
    icon?: React.ElementType;
  }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-md bg-muted p-1",
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
              isActive
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const categoryCopy: Record<
  string,
  { title: string; body: string; note: string; tone: string }
> = {
  MARKETING: {
    title: "Marketing",
    body: "Offers, announcements, invitations.",
    note: "Meta limits how many marketing messages one person gets.",
    tone: "text-muted-foreground"
  },
  UTILITY: {
    title: "Utility",
    body: "Updates about something the customer did or asked for: orders, bookings, account.",
    note: "Promotional wording gets reclassified as Marketing.",
    tone: "text-amber-700"
  },
  AUTHENTICATION: {
    title: "Authentication",
    body: "One-time passcodes.",
    note: "Uses Meta's fixed passcode format.",
    tone: "text-muted-foreground"
  }
};

export function CategoryCards({
  value,
  options,
  onChange,
  disabled
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Category"
      className="grid gap-2 sm:grid-cols-2"
    >
      {options.map((option) => {
        const copy = categoryCopy[option];
        const isActive = value.toUpperCase() === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "relative cursor-pointer rounded-lg border bg-white p-3 text-left transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
              isActive && "border-primary ring-1 ring-primary"
            )}
          >
            {isActive && (
              <span className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            )}
            <span className="block pr-6 text-sm font-semibold">
              {copy.title}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {copy.body}
            </span>
            <span className={cn("mt-1.5 block text-xs", copy.tone)}>
              {copy.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A labelled read-only value (edit mode: fields Meta won't let change). */
export function ReadOnlyField({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
