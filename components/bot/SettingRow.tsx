import { PauseCircle } from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Marks a setting that's saved but not running because a master switch is
// off. The controls stay editable so it can be set up ahead of time.
export function PausedNote({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      <PauseCircle className="size-3" />
      {label}
    </span>
  );
}

// One card per setting: the explanation on the left (about a third on
// desktop), the controls on the right. Stacks on mobile.
export function SettingRow({
  title,
  description,
  children,
  id,
  className,
  pausedLabel
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  /** Shows a paused note and mutes the controls (they stay editable). */
  pausedLabel?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "grid gap-4 rounded-lg bg-white p-5 shadow-xs md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8",
        className
      )}
    >
      <div>
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        {pausedLabel && (
          <div className="mt-2">
            <PausedNote label={pausedLabel} />
          </div>
        )}
      </div>
      <div className={cn("min-w-0", pausedLabel && "opacity-60")}>
        {children}
      </div>
    </section>
  );
}
