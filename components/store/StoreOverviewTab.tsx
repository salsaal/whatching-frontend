import { Check, Minus } from "lucide-react";
import { useState } from "react";

import type {
  StoreConnection,
  StoreTemplateChoice
} from "@/client-api/types/stores.type";
import type { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
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
  const actions = shownSteps.filter(
    (step) => step.action && (step.action === "plugin" || canManage)
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-3">
        <h3 className="font-heading text-base font-semibold">
          What your customers receive
        </h3>
        <ul className="space-y-2">
          {journey.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onOpenTab("messages")}
                className="flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 text-left transition hover:border-primary/40 hover:bg-muted/30"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    row.on
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                  aria-hidden="true"
                >
                  {row.on ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Minus className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{row.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {row.when}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold",
                    row.on ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {row.on ? "On" : "Off"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full space-y-3 lg:w-80 lg:shrink-0">
        <section className="rounded-lg border bg-white p-4">
          <h3 className="font-heading text-base font-semibold">Setup</h3>
          <ol className="mt-3 space-y-3">
            {shownSteps.map((step, index) => (
              <li key={step.id} className="flex gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    step.done
                      ? "bg-primary/10 text-primary"
                      : "bg-amber-100 text-amber-800"
                  )}
                  aria-label={step.done ? "Done" : "Needs action"}
                >
                  {step.done ? <Check className="size-3" /> : index + 1}
                </span>
                <div className="min-w-0 text-sm">
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
                </div>
              </li>
            ))}
          </ol>
          {actions.length > 0 && (
            <div className="mt-4 space-y-2">
              {actions.map((step) => (
                <Button
                  key={step.id}
                  variant="outline"
                  className="min-h-11 w-full sm:min-h-9"
                  onClick={() => {
                    if (step.action === "templates") onCreateTemplates();
                    else if (step.action === "sender") setIsSenderOpen(true);
                    else onOpenTab("carts");
                  }}
                >
                  {step.action === "templates"
                    ? "Create ready-made templates"
                    : step.action === "sender"
                      ? "Choose a number"
                      : "Link the cart plugin"}
                </Button>
              ))}
            </div>
          )}
        </section>
        <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          WhatsApp (Meta) charges for each order message and cart reminder
          delivered, and bills you directly. Whatching doesn&apos;t add a
          charge.
        </p>
      </div>

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
