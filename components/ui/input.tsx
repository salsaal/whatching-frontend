import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex w-full min-w-0 h-11 rounded-sm border border-border px-4 text-sm font-body",
        "placeholder:text-muted-foreground/70",
        "transition-all duration-200 outline-none",
        "focus-visible:ring-0.5 focus-visible:ring-primary/30 focus-visible:border-primary/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        className
      )}
      {...props}
    />
  );
}

export { Input };
