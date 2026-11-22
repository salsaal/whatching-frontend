import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

import type {
  ReadyMadeStoreTemplate,
  StoreFixedMessageKind,
  StorePlatform,
  StoreTemplateResult,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import { useStoreApi } from "@/components/store/StoreApiContext";
import { StoreVariableChips } from "@/components/store/StoreTemplatePicker";
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
import { Textarea } from "@/components/ui/textarea";
import { formatLanguage } from "@/lib/displayFormat";
import { storeErrorMessage, storeMessageCopy } from "@/lib/store";

// Languages WhatsApp templates are commonly written in. The text below is
// what gets sent, so it should be written in the language picked here.
export const STORE_TEMPLATE_LANGUAGES = [
  "en",
  "en_US",
  "en_GB",
  "hi",
  "bn",
  "gu",
  "kn",
  "ml",
  "mr",
  "pa",
  "ta",
  "te",
  "ur",
  "ar",
  "es",
  "pt_BR",
  "id"
];

export const outcomeText = (result: StoreTemplateResult) => {
  if (result.outcome === "failed") {
    return result.message || "WhatsApp didn't accept this template.";
  }
  const approved = String(result.status || "").toUpperCase() === "APPROVED";
  if (result.outcome === "already_existed") {
    return approved
      ? "Already in your account, and selected."
      : "Already in your account and selected. Waiting for WhatsApp to approve it.";
  }
  return approved
    ? "Created and selected."
    : "Created and selected. Waiting for WhatsApp to approve it, which usually takes a few minutes.";
};

type StoreTemplatesProps = {
  connectionId: string;
  platform?: StorePlatform;
  readyMadeTemplates: ReadyMadeStoreTemplate[];
  templateVariables: Record<string, StoreTemplateVariable[]>;
};

export const STORE_TEMPLATES_TITLE = "Create ready-made templates";
export const STORE_TEMPLATES_DESCRIPTION =
  "We'll add these order message templates to your WhatsApp account and use them for your store. WhatsApp reviews each one before it can be sent.";

/**
 * The ready-made templates form and its results. Mount it fresh for each
 * use: in a dialog on the Store page, inline inside Shopify admin (no
 * pop-ups there). `onClose` is Cancel, and Done once they're created.
 */
export function StoreTemplatesForm({
  connectionId,
  platform,
  readyMadeTemplates,
  templateVariables,
  onClose
}: StoreTemplatesProps & { onClose: () => void }) {
  const queryClient = useQueryClient();
  const api = useStoreApi();
  const [language, setLanguage] = useState("en");
  const [selected, setSelected] = useState<StoreFixedMessageKind[]>(() =>
    readyMadeTemplates.map((template) => template.kind)
  );
  const [texts, setTexts] = useState<Partial<Record<string, string>>>({});
  const [results, setResults] = useState<StoreTemplateResult[] | null>(null);
  const [error, setError] = useState("");
  const titleOf = (kind: StoreFixedMessageKind) =>
    storeMessageCopy(kind, platform)?.title || kind;

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
      connectionId,
      payload: {
        language,
        ...(selected.length < readyMadeTemplates.length
          ? { kinds: selected }
          : {}),
        ...(Object.keys(bodyOverrides).length ? { bodyOverrides } : {})
      }
    });
  };

  const tooShort = readyMadeTemplates.some(
    (template) =>
      selected.includes(template.kind) && textFor(template).trim().length < 10
  );

  return (
    <>
      {results ? (
        <ul className="space-y-3">
          {results.map((result) => (
            <li key={result.kind} className="flex gap-2 text-sm">
              {result.outcome === "failed" ? (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              )}
              <div>
                <p className="font-medium">{titleOf(result.kind)}</p>
                <p className="text-muted-foreground">{outcomeText(result)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-5">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="store-template-language">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="store-template-language" className="w-full">
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
              Write the messages below in this language.
            </p>
          </div>

          {readyMadeTemplates.map((template) => {
            const checked = selected.includes(template.kind);
            return (
              <div key={template.kind} className="rounded-md border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      setSelected((current) =>
                        value === true
                          ? [...current, template.kind]
                          : current.filter((kind) => kind !== template.kind)
                      )
                    }
                  />
                  {titleOf(template.kind)}
                </label>
                {checked && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={textFor(template)}
                      rows={3}
                      maxLength={1024}
                      onChange={(event) =>
                        setTexts((current) => ({
                          ...current,
                          [template.kind]: event.target.value
                        }))
                      }
                      aria-label={`${titleOf(template.kind)} message`}
                    />
                    <StoreVariableChips
                      variables={templateVariables[template.kind]}
                    />
                    {template.buttons.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Buttons: {template.buttons.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {results ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !selected.length || tooShort}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Create templates
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/** "Create ready-made templates" on the Store page, in a dialog. */
export function StoreTemplatesDialog({
  open,
  onOpenChange,
  ...props
}: StoreTemplatesProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{STORE_TEMPLATES_TITLE}</DialogTitle>
          <DialogDescription>{STORE_TEMPLATES_DESCRIPTION}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        {open && (
          <StoreTemplatesForm {...props} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
