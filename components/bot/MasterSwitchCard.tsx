import { Power } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type PillState = "on" | "off" | "paused";

/** AI replies and spam protection only run while the master switch is on. */
export const dependentPillState = (
  isMasterOn: boolean,
  isOn: boolean
): PillState => (!isMasterOn ? "paused" : isOn ? "on" : "off");

export function StatusPill({
  label,
  state,
  href
}: {
  label: string;
  state: PillState;
  href?: string;
}) {
  const content: ReactNode = (
    <>
      <span
        className={cn(
          "size-2 rounded-full",
          state === "on" ? "bg-primary" : "bg-muted-foreground/40"
        )}
      />
      {label}: {state === "on" ? "On" : state === "off" ? "Off" : "Paused"}
    </>
  );
  const className = cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
    state === "paused" ? "bg-slate-50 text-muted-foreground" : "bg-white"
  );
  return href ? (
    <Link href={href} className={cn(className, "hover:border-primary/40")}>
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}

// The prominent on/off card for a channel's master switch (WhatsApp bot,
// Instagram automation). Turning off asks first; turning on is immediate.
export function MasterSwitchCard({
  title,
  isOn,
  onText,
  offText,
  note,
  confirmTitle,
  confirmDescription,
  disabled,
  onChange
}: {
  title: string;
  isOn: boolean;
  onText: string;
  offText: string;
  note: string;
  confirmTitle: string;
  confirmDescription: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const [isConfirmingOff, setIsConfirmingOff] = useState(false);

  return (
    <section
      className={cn(
        "rounded-lg border-2 bg-white p-5 shadow-xs",
        isOn ? "border-primary/30" : "border-slate-200"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md",
            isOn
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Power className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm font-medium">
            {isOn ? onText : offText}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{note}</p>
        </div>
        <Switch
          checked={isOn}
          disabled={disabled}
          aria-label={title}
          className="h-7 w-12 [&>span]:size-6"
          onCheckedChange={(checked) => {
            if (checked) onChange(true);
            else setIsConfirmingOff(true);
          }}
        />
      </div>

      <AlertDialog open={isConfirmingOff} onOpenChange={setIsConfirmingOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => onChange(false)}
            >
              Turn off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
