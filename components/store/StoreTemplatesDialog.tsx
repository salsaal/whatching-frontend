import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

import { createStoreTemplates } from "@/client-api/functions/stores";
import type {
  ReadyMadeStoreTemplate,
  StoreFixedMessageKind,
  StoreTemplateResult,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import { StoreVariableChips } from "@/components/store/StoreTemplatePicker";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { storeQueryKey } from "@/hooks/useStore";
import { formatLanguage } from "@/lib/displayFormat";
import { STORE_MESSAGE_COPY, storeErrorMessage } from "@/lib/store";
import { useOrganizationStore } from "@/stores/organizationStore";

// Languages WhatsApp templates are commonly written in. The text below is
// what gets sent, so it should be written in the language picked here.
const LANGUAGES = [
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

const outcomeText = (result: StoreTemplateResult) => {
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

/**
 * "Create ready-made templates": our order message templates, created in
 * the merchant's WhatsApp account and selected for each message.
 */
export function StoreTemplatesDialog({
  open,
  onOpenChange,
  connectionId,
  readyMadeTemplates,
  templateVariables
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  readyMadeTemplates: ReadyMadeStoreTemplate[];
  templateVariables: Record<string, StoreTemplateVariable[]>;
}) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const [language, setLanguage] = useState("en");
  const [selected, setSelected] = useState<StoreFixedMessageKind[]>(() =>
    readyMadeTemplates.map((template) => template.kind)
  );
  const [texts, setTexts] = useState<Partial<Record<string, string>>>({});
  const [results, setResults] = useState<StoreTemplateResult[] | null>(null);
  const [error, setError] = useState("");

  // Starts fresh each time it opens (adjusting state during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLanguage("en");
      setSelected(readyMadeTemplates.map((template) => template.kind));
      setTexts({});
      setResults(null);
      setError("");
    }
  }

  const { mutate: create, isPending } = useMutation({
    mutationFn: createStoreTemplates,
    meta: { showToast: false },
    onSuccess: (response) => {
      setResults(response.data.results);
      queryClient.invalidateQueries({
        queryKey: storeQueryKey(organizationId)
      });
      queryClient.invalidateQueries({
        queryKey: ["templates", organizationId]
      });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create ready-made templates</DialogTitle>
          <DialogDescription>
            We&apos;ll add these order message templates to your WhatsApp
            account and use them for your store. WhatsApp reviews each one
            before it can be sent.
          </DialogDescription>
        </DialogHeader>

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
                  <p className="font-medium">
                    {STORE_MESSAGE_COPY[result.kind]?.title || result.kind}
                  </p>
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
                  {LANGUAGES.map((code) => (
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
                    {STORE_MESSAGE_COPY[template.kind]?.title || template.kind}
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
                        aria-label={`${STORE_MESSAGE_COPY[template.kind]?.title} message`}
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

        <DialogFooter>
          {results ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
