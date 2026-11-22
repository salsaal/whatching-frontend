import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  ReadyMadeStoreTemplate,
  StoreConnection,
  StoreFixedMessageKind,
  StoreTemplateChoice,
  StoreTemplateResult,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import type { TemplateButton } from "@/client-api/types/templates.type";
import { useStoreApi } from "@/components/store/StoreApiContext";
import { StoreTemplateEditor } from "@/components/store/StoreTemplateEditor";
import {
  STORE_TEMPLATE_LANGUAGES,
  outcomeText
} from "@/components/store/StoreTemplatesDialog";
import { storeMessageIcon } from "@/components/store/storeIcons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { formatLanguage } from "@/lib/displayFormat";
import { type BadgeTone, badgeToneClass } from "@/lib/statusPresentation";
import { storeErrorMessage } from "@/lib/store";
import {
  ORDER_MESSAGE_WHEN,
  STORE_PAGE_MESSAGE_TITLES,
  storePreviewValues,
  storeTemplatePill
} from "@/lib/storePage";
import { cn } from "@/lib/utils";

type MessageState = "ready" | "review" | "needs";

const STATE_BADGE: Record<MessageState, { label: string; tone: BadgeTone }> = {
  ready: { label: "Already set up", tone: "green" },
  review: { label: "In review", tone: "amber" },
  needs: { label: "No approved template", tone: "grey" }
};

/** Whether a message already has a template WhatsApp approved (or is reviewing). */
export const readyMadeState = (
  connection: StoreConnection,
  kind: StoreFixedMessageKind,
  templates: StoreTemplateChoice[]
): MessageState => {
  const setting = connection.settings?.messages?.[kind];
  const pill = storeTemplatePill(
    setting?.templateName,
    setting?.templateLanguage,
    templates
  );
  if (pill?.tone === "green") return "ready";
  if (pill?.tone === "amber") return "review";
  return "needs";
};

type Props = {
  connection: StoreConnection;
  readyMadeTemplates: ReadyMadeStoreTemplate[];
  templateVariables: Record<string, StoreTemplateVariable[]>;
  templates: StoreTemplateChoice[];
  currency?: string;
  onClose: () => void;
};

function ReadyMadeBody({
  connection,
  readyMadeTemplates,
  templateVariables,
  templates,
  currency,
  onClose
}: Props) {
  const queryClient = useQueryClient();
  const api = useStoreApi();
  const states = useMemo(
    () =>
      Object.fromEntries(
        readyMadeTemplates.map((template) => [
          template.kind,
          readyMadeState(connection, template.kind, templates)
        ])
      ) as Record<StoreFixedMessageKind, MessageState>,
    [connection, readyMadeTemplates, templates]
  );
  const [language, setLanguage] = useState("en");
  // Ticked: only the messages without a template yet.
  const [selected, setSelected] = useState<StoreFixedMessageKind[]>(() =>
    readyMadeTemplates
      .filter((template) => states[template.kind] === "needs")
      .map((template) => template.kind)
  );
  const [texts, setTexts] = useState<Partial<Record<string, string>>>({});
  const [results, setResults] = useState<StoreTemplateResult[] | null>(null);
  const [error, setError] = useState("");
  const allSetUp = readyMadeTemplates.every(
    (template) => states[template.kind] !== "needs"
  );

  const { mutate: create, isPending } = useMutation({
    mutationFn: api.createTemplates,
    meta: { showToast: false },
    onSuccess: (response) => {
      setResults(response.data.results);
      queryClient.invalidateQueries({ queryKey: api.storeKey });
      if (api.templatesKey) {
        queryClient.invalidateQueries({ queryKey: api.templatesKey });
      }
    },
    onError: (createError) =>
      setError(
        storeErrorMessage(
          createError,
          "The templates couldn't be created. Please try again."
        )
      )
  });

  const textFor = (template: ReadyMadeStoreTemplate) =>
    texts[template.kind] ?? template.body;
  const tooShort = readyMadeTemplates.some(
    (template) =>
      selected.includes(template.kind) && textFor(template).trim().length < 10
  );

  const handleCreate = () => {
    setError("");
    const bodyOverrides = Object.fromEntries(
      readyMadeTemplates
        .filter(
          (template) =>
            selected.includes(template.kind) &&
            textFor(template).trim() !== template.body
        )
        .map((template) => [template.kind, textFor(template).trim()])
    );
    create({
      connectionId: connection.id,
      payload: {
        language,
        ...(selected.length < readyMadeTemplates.length
          ? { kinds: selected }
          : {}),
        ...(Object.keys(bodyOverrides).length ? { bodyOverrides } : {})
      }
    });
  };

  if (results) {
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <ul className="divide-y rounded-lg border bg-white">
            {results.map((result) => {
              const Icon = storeMessageIcon(result.kind);
              const failed = result.outcome === "failed";
              return (
                <li key={result.kind} className="flex gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {STORE_PAGE_MESSAGE_TITLES[result.kind]}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {outcomeText(result)}
                    </p>
                  </div>
                  {failed ? (
                    <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end border-t bg-white px-5 py-4 sm:px-6">
          <Button onClick={onClose}>Done</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/30 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <Label htmlFor="ready-made-language" className="shrink-0">
            Language
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger
              id="ready-made-language"
              className="w-full bg-white sm:w-56"
            >
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
            Write the messages in this language.
          </p>
        </div>

        {allSetUp && (
          <p className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
            All your order messages already have templates. Tick one to create
            it again, for example in another language.
          </p>
        )}

        <ul className="space-y-3">
          {readyMadeTemplates.map((template) => {
            const checked = selected.includes(template.kind);
            const state = STATE_BADGE[states[template.kind]];
            const Icon = storeMessageIcon(template.kind);
            const title = STORE_PAGE_MESSAGE_TITLES[template.kind];
            const buttons: TemplateButton[] = template.buttons.map((text) => ({
              type: "QUICK_REPLY",
              text
            }));
            return (
              <li
                key={template.kind}
                className={cn(
                  "overflow-hidden rounded-lg border bg-white transition",
                  checked && "border-primary/40 shadow-xs"
                )}
              >
                <label className="flex cursor-pointer items-center gap-3 p-4">
                  <Checkbox
                    checked={checked}
                    aria-label={`Create “${title}”`}
                    onCheckedChange={(value) =>
                      setSelected((current) =>
                        value === true
                          ? [...current, template.kind]
                          : current.filter((kind) => kind !== template.kind)
                      )
                    }
                  />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {ORDER_MESSAGE_WHEN[template.kind]}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
                      badgeToneClass[state.tone]
                    )}
                  >
                    {state.label}
                  </span>
                </label>
                {checked && (
                  <div className="border-t p-4">
                    <StoreTemplateEditor
                      id={`ready-made-${template.kind}`}
                      label={`${title} message`}
                      value={textFor(template)}
                      onChange={(value) =>
                        setTexts((current) => ({
                          ...current,
                          [template.kind]: value
                        }))
                      }
                      variables={templateVariables[template.kind]}
                      previewValues={storePreviewValues(
                        template.kind,
                        templateVariables[template.kind],
                        { storeName: connection.storeName, currency }
                      )}
                      buttons={buttons}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">
          WhatsApp reviews each template before it can be sent, usually within a
          few minutes.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isPending || !selected.length || tooShort}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {selected.length === 1
              ? "Create 1 template"
              : `Create ${selected.length} templates`}
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Ready-made order message templates on the Store page: pick the messages,
 * adjust the text with a live preview, create them. The screens inside
 * Shopify admin keep their own form (StoreTemplatesForm).
 */
export function StoreReadyMadeDialog({
  open,
  onOpenChange,
  ...props
}: Omit<Props, "onClose"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b bg-white px-5 py-4 text-left sm:px-6">
          <DialogTitle className="font-heading text-lg">
            Ready-made templates
          </DialogTitle>
          <DialogDescription>
            Pick the messages to create. We add them to your WhatsApp account
            and use them for your store.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        {open && (
          <ReadyMadeBody {...props} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
