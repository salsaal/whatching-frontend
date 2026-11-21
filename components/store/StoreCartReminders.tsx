import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { createCartTemplate } from "@/client-api/functions/stores";
import type {
  CreateCartTemplateResponse,
  ReadyMadeCartTemplate,
  StoreCartReminderStep,
  StoreConnection,
  StoreTemplateChoice,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import { useStoreApi } from "@/components/store/StoreApiContext";
import {
  StoreTemplatePicker,
  StoreVariableChips
} from "@/components/store/StoreTemplatePicker";
import { STORE_TEMPLATE_LANGUAGES } from "@/components/store/StoreTemplatesDialog";
import { useStoreSettings } from "@/components/store/useStoreSettings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatLanguage } from "@/lib/displayFormat";
import { storeErrorMessage } from "@/lib/store";
import {
  type DelayDraft,
  type DelayUnit,
  cartDelaysProblem,
  cartReminderSteps,
  cartReminderVariables,
  cartTemplatesWaiting,
  delayDraftFromMinutes,
  delayDraftMinutes
} from "@/lib/storeCarts";

export const CART_CONSENT_TEXT =
  "My store collects customers’ consent to receive WhatsApp marketing messages, such as cart reminders.";

/** First switch-on: the merchant confirms their store collects consent. */
function ConsentDialog({
  open,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves to the API's reason when it's refused. */
  onConfirm: () => Promise<string | null>;
}) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const close = (next: boolean) => {
    if (!next) {
      setChecked(false);
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn on cart reminders</DialogTitle>
          <DialogDescription className="sr-only">
            Confirm your store collects consent for marketing messages.
          </DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          {CART_CONSENT_TEXT}
        </label>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => close(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            disabled={!checked || isSaving}
            onClick={async () => {
              setIsSaving(true);
              const problem = await onConfirm();
              setIsSaving(false);
              if (problem) setError(problem);
              else close(false);
            }}
          >
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Turn on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const createdText = (result: CreateCartTemplateResponse["data"]) => {
  const approved = String(result.status || "").toUpperCase() === "APPROVED";
  const start =
    result.outcome === "already_existed"
      ? "It was already in your account, and your reminders now use it."
      : "Created, and your reminders now use it.";
  return approved
    ? start
    : `${start} Waiting for WhatsApp to approve it, which usually takes a few minutes.`;
};

/** "Create ready-made reminder template": language, text, then the result. */
function CartTemplateDialog({
  open,
  onOpenChange,
  connectionId,
  readyMade,
  variables
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  readyMade: ReadyMadeCartTemplate;
  variables: StoreTemplateVariable[];
}) {
  const queryClient = useQueryClient();
  const api = useStoreApi();
  const [language, setLanguage] = useState("en");
  const [text, setText] = useState(readyMade.body);
  const [result, setResult] = useState<
    CreateCartTemplateResponse["data"] | null
  >(null);
  const [error, setError] = useState("");

  const { mutate: create, isPending } = useMutation({
    mutationFn: createCartTemplate,
    meta: { showToast: false },
    onSuccess: (response) => {
      setResult(response.data);
      // The backend put the template on the reminders that had none.
      queryClient.invalidateQueries({ queryKey: api.storeKey });
      if (api.templatesKey) {
        queryClient.invalidateQueries({ queryKey: api.templatesKey });
      }
    },
    onError: (createError) =>
      setError(
        storeErrorMessage(
          createError,
          "The template couldn't be created. Please try again."
        )
      )
  });

  const close = () => {
    onOpenChange(false);
    setResult(null);
    setError("");
    setText(readyMade.body);
    setLanguage("en");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create ready-made reminder template</DialogTitle>
          <DialogDescription>
            We&apos;ll add this cart reminder template to your WhatsApp account
            and use it for your reminders. WhatsApp reviews it before it can be
            sent.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <p className="flex gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            {createdText(result)}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="cart-template-language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="cart-template-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORE_TEMPLATE_LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {formatLanguage(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Write the message below in this language.
              </p>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <Textarea
                value={text}
                rows={4}
                maxLength={1024}
                onChange={(event) => setText(event.target.value)}
                aria-label="Cart reminder message"
              />
              <div className="flex items-center justify-center gap-1.5 rounded-md border bg-muted/40 py-2 text-sm font-medium text-sky-700">
                <ExternalLink className="size-3.5" />
                {readyMade.linkButton}
              </div>
              <StoreVariableChips variables={variables} />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close} disabled={isPending}>
                Cancel
              </Button>
              <Button
                disabled={isPending || text.trim().length < 10}
                onClick={() => {
                  setError("");
                  const body = text.trim();
                  create({
                    connectionId,
                    payload: {
                      language,
                      ...(body !== readyMade.body ? { body } : {})
                    }
                  });
                }}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Create template
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type StepDraft = {
  enabled: boolean;
  delay: DelayDraft;
  templateName: string | null;
  templateLanguage: string | null;
};

const toDraft = (step: StoreCartReminderStep): StepDraft => ({
  enabled: step.enabled !== false,
  delay: delayDraftFromMinutes(step.delayMinutes),
  templateName: step.templateName || null,
  templateLanguage: step.templateName ? step.templateLanguage || null : null
});

/**
 * The three reminders, edited together and saved with one button (the
 * delays depend on each other). Mounted afresh whenever the saved
 * reminders change.
 */
function ReminderSteps({
  connectionId,
  steps,
  templates,
  canManage
}: {
  connectionId: string;
  steps: StoreCartReminderStep[];
  templates: {
    options: StoreTemplateChoice[];
    allTemplates: StoreTemplateChoice[];
  };
  canManage: boolean;
}) {
  const { save } = useStoreSettings(connectionId);
  const initial = useMemo(() => steps.map(toDraft), [steps]);
  const [drafts, setDrafts] = useState<StepDraft[]>(initial);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const problem = cartDelaysProblem(drafts.map((draft) => draft.delay));
  const isDirty = JSON.stringify(drafts) !== JSON.stringify(initial);
  const disabled = !canManage || isSaving;

  const update = (index: number, change: Partial<StepDraft>) => {
    setSaveError(null);
    setDrafts((current) =>
      current.map((draft, at) =>
        at === index ? { ...draft, ...change } : draft
      )
    );
  };

  const submit = async () => {
    setIsSaving(true);
    const refused = await save({
      cartReminders: {
        steps: drafts.map((draft) => ({
          enabled: draft.enabled,
          delayMinutes: delayDraftMinutes(draft.delay) as number,
          templateName: draft.templateName,
          templateLanguage: draft.templateName ? draft.templateLanguage : null
        }))
      }
    });
    setIsSaving(false);
    setSaveError(refused);
  };

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {drafts.map((draft, index) => {
          const label = `Reminder ${index + 1}`;
          return (
            <li key={label} className="space-y-2 p-3 sm:p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,9rem)_minmax(0,14rem)_minmax(0,1fr)] md:items-start">
                <div className="flex items-center gap-2 md:pt-7">
                  <Switch
                    checked={draft.enabled}
                    disabled={disabled}
                    aria-label={`Send ${label.toLowerCase()}`}
                    onCheckedChange={(checked) =>
                      update(index, { enabled: checked })
                    }
                  />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cart-delay-${index}`} className="text-xs">
                    Send after
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`cart-delay-${index}`}
                      type="number"
                      inputMode="decimal"
                      min={1}
                      className="w-24 bg-white"
                      value={draft.delay.value}
                      disabled={disabled}
                      aria-invalid={problem?.index === index}
                      onChange={(event) =>
                        update(index, {
                          delay: { ...draft.delay, value: event.target.value }
                        })
                      }
                    />
                    <Select
                      value={draft.delay.unit}
                      disabled={disabled}
                      onValueChange={(unit) =>
                        update(index, {
                          delay: { ...draft.delay, unit: unit as DelayUnit }
                        })
                      }
                    >
                      <SelectTrigger
                        className="w-28 bg-white"
                        aria-label={`${label} unit`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">minutes</SelectItem>
                        <SelectItem value="hours">hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cart-template-${index}`} className="text-xs">
                    Template
                  </Label>
                  <StoreTemplatePicker
                    id={`cart-template-${index}`}
                    templateName={draft.templateName}
                    templateLanguage={draft.templateLanguage}
                    options={templates.options}
                    allTemplates={templates.allTemplates}
                    disabled={disabled}
                    onChange={(choice) =>
                      update(index, {
                        templateName: choice?.name || null,
                        templateLanguage: choice?.language || null
                      })
                    }
                  />
                </div>
              </div>
              {problem?.index === index && (
                <p className="text-xs text-destructive" role="alert">
                  {problem.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {canManage && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {saveError && (
            <p className="text-sm text-destructive sm:mr-auto" role="alert">
              {saveError}
            </p>
          )}
          {isDirty && (
            <Button
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                setDrafts(initial);
                setSaveError(null);
              }}
            >
              Discard changes
            </Button>
          )}
          <Button
            disabled={!isDirty || Boolean(problem) || isSaving}
            onClick={submit}
          >
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Save reminders
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Cart reminders (WooCommerce, with the plugin linked): the on/off switch,
 * up to three reminders and their templates.
 */
export function StoreCartReminders({
  connection,
  readyMadeCartTemplate,
  variables: variablesFromApi,
  templates,
  canManage
}: {
  connection: StoreConnection;
  readyMadeCartTemplate?: ReadyMadeCartTemplate;
  variables?: StoreTemplateVariable[];
  templates: {
    options: StoreTemplateChoice[];
    allTemplates: StoreTemplateChoice[];
  };
  canManage: boolean;
}) {
  const { save } = useStoreSettings(connection.id);
  const settings = connection.settings?.cartReminders;
  const enabled = settings?.enabled === true;
  const steps = useMemo(
    () => cartReminderSteps(settings?.steps),
    [settings?.steps]
  );
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const variables = cartReminderVariables(variablesFromApi);
  const linked = connection.plugin?.connected === true;
  const noTemplates = steps.every((step) => !step.templateName);
  const waiting = cartTemplatesWaiting(steps, templates.allTemplates);

  const turn = async (checked: boolean) => {
    if (checked && !settings?.consentConfirmedAt) {
      setIsConsentOpen(true);
      return;
    }
    setIsSwitching(true);
    setSwitchError(await save({ cartReminders: { enabled: checked } }));
    setIsSwitching(false);
  };

  return (
    <section className="rounded-lg border bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">Cart reminders</h2>
        {linked && (
          <Switch
            checked={enabled}
            disabled={!canManage || isSwitching}
            aria-label="Send cart reminders"
            onCheckedChange={turn}
          />
        )}
      </div>

      {!linked ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Install and link the plugin above to send cart reminders.
        </p>
      ) : (
        <div className="mt-1 space-y-4">
          {switchError && (
            <p className="text-sm text-destructive" role="alert">
              {switchError}
            </p>
          )}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Shoppers who type their phone number at checkout and leave without
              ordering get up to 3 WhatsApp reminders, each with a button that
              brings back their cart. Reminders stop when they order, reply, or
              opt out.
            </p>
            <p className="text-xs text-muted-foreground">
              Cart reminders are marketing messages. WhatsApp (Meta) charges its
              marketing rate for each one delivered.
            </p>
          </div>

          {canManage && noTemplates && readyMadeCartTemplate && (
            <Button variant="outline" onClick={() => setIsTemplateOpen(true)}>
              Create ready-made reminder template
            </Button>
          )}
          {waiting && (
            <p className="text-sm text-amber-800">
              Waiting for WhatsApp to approve your template. This usually takes
              a few minutes.
            </p>
          )}

          <ReminderSteps
            key={JSON.stringify(steps)}
            connectionId={connection.id}
            steps={steps}
            templates={templates}
            canManage={canManage}
          />

          <div className="flex flex-wrap gap-1.5">
            <StoreVariableChips variables={variables} />
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Link button</span>
              Brings back the cart
            </span>
          </div>
        </div>
      )}

      <ConsentDialog
        open={isConsentOpen}
        onOpenChange={setIsConsentOpen}
        onConfirm={() =>
          save({ cartReminders: { enabled: true, consentConfirmed: true } })
        }
      />
      {readyMadeCartTemplate && (
        <CartTemplateDialog
          open={isTemplateOpen}
          onOpenChange={setIsTemplateOpen}
          connectionId={connection.id}
          readyMade={readyMadeCartTemplate}
          variables={variables}
        />
      )}
    </section>
  );
}
