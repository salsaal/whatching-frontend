import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compactNumberFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

// 3 significant digits keeps "2.99M" from rounding up to "3M", while round
// numbers stay short ("3M", "500K"). Used for AI token figures.
const tokenNumberFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3
});

export function formatTokenCount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return tokenNumberFormat.format(value);
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return compactNumberFormat.format(value);
}
