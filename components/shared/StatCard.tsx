import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  href?: string;
  /** Shown on hover; explains the number. */
  tooltip?: string;
  /** Amber icon when the number needs someone to act. */
  attention?: boolean;
}

// One card for every figure on Overview, so the rows line up and read the
// same way: label, number, one line of context.
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tooltip,
  attention = false
}: StatCardProps) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">
          {value}
        </p>
        {detail && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {detail}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          attention
            ? "bg-amber-50 text-amber-600"
            : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-4" />
      </div>
    </>
  );
  const className =
    "flex h-full items-start justify-between gap-3 rounded-lg border bg-white p-4 shadow-xs";

  return href ? (
    <Link
      href={href}
      title={tooltip}
      className={cn(
        className,
        "transition hover:border-primary/40 hover:shadow-md"
      )}
    >
      {content}
    </Link>
  ) : (
    <div title={tooltip} className={className}>
      {content}
    </div>
  );
}

export function StatSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}
