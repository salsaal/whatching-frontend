import { FlowStatusTone } from "@/lib/flowBuilder";
import { cn } from "@/lib/utils";

const toneClasses: Record<FlowStatusTone, { pill: string; dot: string }> = {
  active: { pill: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  ready: { pill: "bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  paused: { pill: "bg-muted text-muted-foreground", dot: "bg-slate-400" },
  draft: {
    pill: "border border-slate-300 bg-white text-muted-foreground",
    dot: "bg-slate-300"
  },
  pending: { pill: "bg-amber-50 text-amber-800", dot: "bg-amber-500" }
};

/** A flow's status: Active, Ready, Paused or Draft (or Active with pending changes). */
export function FlowStatusPill({
  tone,
  label,
  className
}: {
  tone: FlowStatusTone;
  label: string;
  className?: string;
}) {
  const classes = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        classes.pill,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", classes.dot)} />
      {label}
    </span>
  );
}
