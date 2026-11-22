import { AlertCircle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { useState } from "react";

import type {
  StoreConnection,
  StoreTemplateChoice
} from "@/client-api/types/stores.type";
import type { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
import { storeMessageIcon } from "@/components/store/storeIcons";
import { useStoreSettings } from "@/components/store/useStoreSettings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { StoreTab } from "@/lib/storePage";
import { storeJourney, storeSetupSteps } from "@/lib/storePage";
import { formatPhoneNumber } from "@/lib/inbox";
import { cn } from "@/lib/utils";

export const numberLabel = (number: WhatsAppPhoneNumber) =>
  [formatPhoneNumber(number.displayPhoneNumber), number.verifiedName]
    .filter(Boolean)
    .join(" · ") || "WhatsApp number";

/** Which number sends store messages (workspaces with more than one). */
function SenderDialog({
  open,
  onOpenChange,
  connection,
  numbers
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: StoreConnection;
  numbers: WhatsAppPhoneNumber[];
}) {
  const { save, isSaving } = useStoreSettings(connection.id);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose the WhatsApp number to send from</DialogTitle>
          <DialogDescription>
            Order messages and cart reminders go out from this number, using its
            templates.
          </DialogDescription>
        </DialogHeader>
        <Select
          value={connection.settings?.senderPhoneNumberId || ""}
          disabled={isSaving}
          onValueChange={async (value) => {
            const problem = await save({ senderPhoneNumberId: value });
            setError(problem);
            if (!problem) onOpenChange(false);
          }}
        >
          <SelectTrigger
            className="w-full bg-white"
            aria-label="Sending number"
          >
            <SelectValue placeholder="Choose a number" />
          </SelectTrigger>
          <SelectContent>
            {numbers.map((number) => (
              <SelectItem
                key={number.phoneNumberId}
                value={number.phoneNumberId}
              >
                {numberLabel(number)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Overview: what customers receive, and a setup checklist that stays. */
export function StoreOverviewTab({
  connection,
  statusName,
  templates,
  templatesLoaded,
  numbers,
  canManage,
  showCarts,
  onOpenTab,
  onCreateTemplates
}: {
  connection: StoreConnection;
  statusName: (slug: string) => string;
  templates: StoreTemplateChoice[];
  templatesLoaded: boolean;
  numbers: WhatsAppPhoneNumber[];
  canManage: boolean;
  showCarts: boolean;
  onOpenTab: (tab: StoreTab) => void;
  onCreateTemplates: () => void;
}) {
  const [isSenderOpen, setIsSenderOpen] = useState(false);
  const journey = storeJourney(connection, statusName);
  const senderId = connection.settings?.senderPhoneNumberId;
  const sender = numbers.find((number) => number.phoneNumberId === senderId);
  const steps = storeSetupSteps({
    connection,
    templates,
    numberCount: numbers.length,
    senderLabel: sender ? numberLabel(sender) : null,
    showCarts
  });
  // Template counts mean nothing until the templates have loaded.
  const shownSteps = templatesLoaded
    ? steps
    : steps.filter((step) => step.id !== "templates");
  const done = shownSteps.filter((step) => step.done).length;
  const actionLabel = {
    templates: "Create ready-made templates",
    sender: "Choose a number",
    plugin: "Link the cart plugin"
  } as const;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <section className="min-w-0 flex-1">
        <div className="mb-3">
          <h3 className="font-heading text-base font-semibold">
            What your customers receive
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Open a message to change it or its template.
          </p>
        </div>
        <ul className="divide-y overflow-hidden rounded-lg border bg-white">
          {journey.map((row) => {
            const Icon = storeMessageIcon(row.key);
            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onOpenTab("messages")}
                  className="group flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      row.on
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block font-medium",
                        !row.on && "text-muted-foreground"
                      )}
                    >
                      {row.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {row.when}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      row.on
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {row.on ? "On" : "Off"}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="w-full space-y-3 lg:w-80 lg:shrink-0">
        <section className="rounded-lg border bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-heading text-base font-semibold">Setup</h3>
            <span className="text-xs font-medium text-muted-foreground">
              {done} of {shownSteps.length} done
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Setup"
            aria-valuemin={0}
            aria-valuemax={shownSteps.length}
            aria-valuenow={done}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                done === shownSteps.length ? "bg-primary" : "bg-amber-500"
              )}
              style={{
                width: `${shownSteps.length ? (done / shownSteps.length) * 100 : 0}%`
              }}
            />
          </div>
          <ol className="mt-4 space-y-4">
            {shownSteps.map((step) => (
              <li key={step.id} className="flex gap-2.5">
                {step.done ? (
                  <CheckCircle2
                    className="mt-0.5 size-[18px] shrink-0 text-primary"
                    aria-label="Done"
                  />
                ) : (
                  <AlertCircle
                    className="mt-0.5 size-[18px] shrink-0 text-amber-600"
                    aria-label="Needs action"
                  />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{step.label}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {step.note}
                    {step.id === "sender" && sender && canManage && (
                      <>
                        {" · "}
                        <button
                          type="button"
                          className="cursor-pointer font-medium text-primary hover:underline"
                          onClick={() => setIsSenderOpen(true)}
                        >
                          Change
                        </button>
                      </>
                    )}
                  </p>
                  {step.hint && (
                    <p className="mt-1 text-amber-800">{step.hint}</p>
                  )}
                  {step.action && (step.action === "plugin" || canManage) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 min-h-11 sm:min-h-8"
                      onClick={() => {
                        if (step.action === "templates") onCreateTemplates();
                        else if (step.action === "sender")
                          setIsSenderOpen(true);
                        else onOpenTab("carts");
                      }}
                    >
                      {actionLabel[step.action]}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <p className="flex gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          WhatsApp (Meta) charges for each order message and cart reminder
          delivered, and bills you directly. Whatching doesn&apos;t add a
          charge.
        </p>
      </aside>

      {numbers.length > 1 && (
        <SenderDialog
          open={isSenderOpen}
          onOpenChange={setIsSenderOpen}
          connection={connection}
          numbers={numbers}
        />
      )}
    </div>
  );
}
