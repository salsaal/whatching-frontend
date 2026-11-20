import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface AccountStat {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  href?: string;
  /** Shown on hover; explains the number. */
  tooltip?: string;
  /** 0–1: draws a usage bar under the value (amber from 80%). */
  progress?: number;
}

const GRID_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4"
};

function StatCell({ stat }: { stat: AccountStat }) {
  const Icon = stat.icon;
  const progress =
    typeof stat.progress === "number"
      ? Math.min(1, Math.max(0, stat.progress))
      : null;
  const content = (
    <>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{stat.label}</span>
      </p>
      <p className="mt-2 truncate font-heading text-2xl font-semibold tabular-nums">
        {stat.value}
      </p>
      {progress !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              progress >= 0.8 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${Math.max(progress * 100, progress ? 2 : 0)}%` }}
          />
        </div>
      )}
      {stat.detail && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground">
          {stat.detail}
        </p>
      )}
    </>
  );
  const className = "block min-w-0 bg-white p-4 sm:p-5";
  return stat.href ? (
    <Link
      href={stat.href}
      title={stat.tooltip}
      className={cn(className, "transition hover:bg-slate-50")}
    >
      {content}
    </Link>
  ) : (
    <div title={stat.tooltip} className={className}>
      {content}
    </div>
  );
}

/**
 * Account figures on Overview in one strip instead of a box each: contacts,
 * AI usage, the daily limit and ad campaigns.
 */
export function AccountStrip({
  stats,
  action
}: {
  stats: AccountStat[];
  action?: { href: string; label: string };
}) {
  return (
    <section
      aria-label="Your account"
      className="overflow-hidden rounded-lg border bg-white shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Your account
        </h2>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {action.label}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {/* 1px gaps over a border-coloured background draw the dividers in
          any layout; an odd last cell spans the row on small screens. */}
      <div
        className={cn(
          "grid grid-cols-2 gap-px bg-border",
          "[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1",
          GRID_COLUMNS[stats.length] || "lg:grid-cols-4"
        )}
      >
        {stats.map((stat) => (
          <StatCell key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}
