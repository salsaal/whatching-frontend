import { ReactNode } from "react";

import { cn } from "@/lib/utils";

// One card per setting: the explanation on the left (about a third on
// desktop), the controls on the right. Stacks on mobile.
export function SettingRow({
  title,
  description,
  children,
  id,
  className
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
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
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
