import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type {
  StoreConnection,
  StoreCustomStatusRule,
  StoreFixedMessageKind,
  StoreOrderStatus,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import type { MessageTemplate } from "@/client-api/types/templates.type";
import {
  StoreTemplatePicker,
  StoreVariableChips
} from "@/components/store/StoreTemplatePicker";
import { useStoreSettings } from "@/components/store/useStoreSettings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MAX_CUSTOM_STATUS_RULES,
  STORE_MESSAGE_COPY,
  STORE_MESSAGE_KINDS,
  humanizeStatus,
  unavailableCustomStatuses
} from "@/lib/store";

type TemplateLists = {
  options: MessageTemplate[];
  allTemplates: MessageTemplate[];
};

// The API takes exactly these fields per rule (anything else is refused).
const cleanRule = (rule: StoreCustomStatusRule): StoreCustomStatusRule => ({
  status: rule.status,
  statusLabel: rule.statusLabel || undefined,
  enabled: rule.enabled !== false,
  templateName: rule.templateName || null,
  templateLanguage: rule.templateName ? rule.templateLanguage || null : null
});

function MessageCard({
  connection,
  kind,
  variables,
  templates,
  canManage,
  statusPicker
}: {
  connection: StoreConnection;
  kind: StoreFixedMessageKind;
  variables?: StoreTemplateVariable[];
  templates: TemplateLists;
  canManage: boolean;
  statusPicker?: React.ReactNode;
}) {
  const { save } = useStoreSettings(connection.id);
  const setting = connection.settings?.messages?.[kind] || {};
  const enabled = setting.enabled !== false;
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const copy = STORE_MESSAGE_COPY[kind];

  const run = async (
    payload: Parameters<typeof save>[0],
    clearError = true
  ) => {
    setIsSaving(true);
    const problem = await save(payload);
    setIsSaving(false);
    if (problem) setError(problem);
    else if (clearError) setError(null);
  };

  return (
    <div className="flex flex-col rounded-lg border bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{copy.title}</h3>
          {copy.help && (
            <p className="mt-0.5 text-sm text-muted-foreground">{copy.help}</p>
          )}
        </div>
        <Switch
          checked={enabled}
          disabled={!canManage || isSaving}
          aria-label={`Send “${copy.title}”`}
          onCheckedChange={(checked) =>
            run({ messages: { [kind]: { enabled: checked } } }, false)
          }
        />
      </div>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`store-template-${kind}`} className="text-xs">
            Template
          </Label>
          <StoreTemplatePicker
            id={`store-template-${kind}`}
            templateName={setting.templateName}
            templateLanguage={setting.templateLanguage}
            options={templates.options}
            allTemplates={templates.allTemplates}
            disabled={!canManage || isSaving}
            error={error}
            onChange={(choice) =>
              run({
                messages: {
                  [kind]: {
                    templateName: choice?.name || null,
                    templateLanguage: choice?.language || null
                  }
                }
              })
            }
          />
        </div>
        {statusPicker}
        <StoreVariableChips variables={variables} />
      </div>
    </div>
  );
}

/** Which order status counts as shipped; it triggers "Order shipped". */
function ShippedStatusPicker({
  connection,
  statuses,
  statusesError,
  canManage
}: {
  connection: StoreConnection;
  statuses: StoreOrderStatus[];
  statusesError?: string | null;
  canManage: boolean;
}) {
  const { save } = useStoreSettings(connection.id);
  const [error, setError] = useState<string | null>(null);
  const current = connection.settings?.shippedStatuses?.[0] || "completed";
  const reserved = unavailableCustomStatuses();
  const options = statuses.filter((status) => !reserved.has(status.slug));
  if (!options.some((status) => status.slug === current)) {
    options.unshift({ slug: current, name: humanizeStatus(current) });
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor="store-shipped-status" className="text-xs">
        Send when an order is marked
      </Label>
      <Select
        value={current}
        disabled={!canManage}
        onValueChange={async (slug) => {
          const problem = await save({ shippedStatuses: [slug] });
          setError(problem);
        }}
      >
        <SelectTrigger id="store-shipped-status" className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((status) => (
            <SelectItem key={status.slug} value={status.slug}>
              {status.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(error || statusesError) && (
        <p className="text-xs text-muted-foreground">
          {error || statusesError}
        </p>
      )}
    </div>
  );
}

/** "Send a message when an order moves to…": up to 10 extra statuses. */
function ExtraStatusMessages({
  connection,
  statuses,
  statusesError,
  variables,
  templates,
  canManage
}: {
  connection: StoreConnection;
  statuses: StoreOrderStatus[];
  statusesError?: string | null;
  variables?: StoreTemplateVariable[];
  templates: TemplateLists;
  canManage: boolean;
}) {
  const { save } = useStoreSettings(connection.id);
  const rules = connection.settings?.customStatusRules || [];
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const unavailable = unavailableCustomStatuses(
    connection.settings?.shippedStatuses || ["completed"]
  );
  const used = new Set(rules.map((rule) => rule.status));
  const addable = statuses.filter(
    (status) => !unavailable.has(status.slug) && !used.has(status.slug)
  );

  const saveRules = async (next: StoreCustomStatusRule[], status?: string) => {
    setIsSaving(true);
    const problem = await save({ customStatusRules: next.map(cleanRule) });
    setIsSaving(false);
    if (status) setErrors((current) => ({ ...current, [status]: problem }));
    else setAddError(problem);
    return problem;
  };

  return (
    <div className="rounded-lg border bg-white p-4 shadow-xs sm:p-5">
      <h3 className="font-medium">Send a message when an order moves to…</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Add a message for other order statuses, such as &ldquo;Out for
        delivery&rdquo;. Up to {MAX_CUSTOM_STATUS_RULES}.
      </p>

      {rules.length > 0 && (
        <ul className="mt-4 divide-y rounded-md border">
          {rules.map((rule) => (
            <li
              key={rule.status}
              className="grid gap-3 p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-start"
            >
              <div className="flex items-center gap-2 sm:pt-2">
                <Switch
                  checked={rule.enabled !== false}
                  disabled={!canManage || isSaving}
                  aria-label={`Send a message for ${rule.statusLabel || rule.status}`}
                  onCheckedChange={(checked) =>
                    saveRules(
                      rules.map((entry) =>
                        entry.status === rule.status
                          ? { ...entry, enabled: checked }
                          : entry
                      ),
                      rule.status
                    )
                  }
                />
                <span className="truncate text-sm font-medium">
                  {rule.statusLabel || humanizeStatus(rule.status)}
                </span>
              </div>
              <StoreTemplatePicker
                id={`store-template-status-${rule.status}`}
                templateName={rule.templateName}
                templateLanguage={rule.templateLanguage}
                options={templates.options}
                allTemplates={templates.allTemplates}
                disabled={!canManage || isSaving}
                error={errors[rule.status]}
                onChange={(choice) =>
                  saveRules(
                    rules.map((entry) =>
                      entry.status === rule.status
                        ? {
                            ...entry,
                            templateName: choice?.name || null,
                            templateLanguage: choice?.language || null
                          }
                        : entry
                    ),
                    rule.status
                  )
                }
              />
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  aria-label={`Remove the message for ${rule.statusLabel || rule.status}`}
                  title="Remove"
                  disabled={isSaving}
                  onClick={() =>
                    saveRules(
                      rules.filter((entry) => entry.status !== rule.status)
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && rules.length < MAX_CUSTOM_STATUS_RULES && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select
            value=""
            disabled={isSaving || !addable.length}
            onValueChange={(slug) => {
              const status = addable.find((entry) => entry.slug === slug);
              if (!status) return;
              void saveRules([
                ...rules,
                {
                  status: status.slug,
                  statusLabel: status.name,
                  enabled: true
                }
              ]);
            }}
          >
            <SelectTrigger className="w-full bg-white sm:w-72">
              <Plus className="size-4 text-muted-foreground" />
              <SelectValue
                placeholder={
                  addable.length
                    ? "Add a message for a status"
                    : "No other statuses to add"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {addable.map((status) => (
                <SelectItem key={status.slug} value={status.slug}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {(addError || statusesError) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {addError || statusesError}
        </p>
      )}
      {rules.length > 0 && (
        <div className="mt-4">
          <StoreVariableChips variables={variables} />
        </div>
      )}
    </div>
  );
}

/** Section E: one card per order message, plus extra status messages. */
export function StoreMessagesSection({
  connection,
  templateVariables,
  templates,
  statuses,
  statusesError,
  canManage
}: {
  connection: StoreConnection;
  templateVariables: Record<string, StoreTemplateVariable[]>;
  templates: TemplateLists;
  statuses: StoreOrderStatus[];
  statusesError?: string | null;
  canManage: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Order messages</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose which messages customers get, and the WhatsApp template for
          each.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {STORE_MESSAGE_KINDS.map((kind) => (
          <MessageCard
            key={kind}
            connection={connection}
            kind={kind}
            variables={templateVariables[kind]}
            templates={templates}
            canManage={canManage}
            statusPicker={
              kind === "order_shipped" ? (
                <ShippedStatusPicker
                  connection={connection}
                  statuses={statuses}
                  statusesError={statusesError}
                  canManage={canManage}
                />
              ) : undefined
            }
          />
        ))}
      </div>
      <ExtraStatusMessages
        connection={connection}
        statuses={statuses}
        statusesError={statusesError}
        variables={templateVariables.custom_status}
        templates={templates}
        canManage={canManage}
      />
    </section>
  );
}
