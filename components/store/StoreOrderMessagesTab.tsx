import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import type {
  StoreConnection,
  StoreCustomStatusRule,
  StoreFixedMessageKind,
  StoreOrderStatus,
  StoreTemplateChoice,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import { StoreCodPaymentMethods } from "@/components/store/StoreCodPaymentMethods";
import {
  ShippedStatusPicker,
  type StoreTemplateLists,
  cleanRule
} from "@/components/store/StoreMessagesSection";
import { StorePreview } from "@/components/store/StorePreview";
import { StoreTemplatePicker } from "@/components/store/StoreTemplatePicker";
import { useStoreSettings } from "@/components/store/useStoreSettings";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatLanguage } from "@/lib/displayFormat";
import { badgeToneClass } from "@/lib/statusPresentation";
import {
  MAX_CUSTOM_STATUS_RULES,
  STORE_MESSAGE_KINDS,
  unavailableCustomStatuses
} from "@/lib/store";
import {
  ORDER_MESSAGE_WHEN,
  STORE_PAGE_MESSAGE_TITLES,
  customRuleLabel,
  paymentMethodLabel,
  storePreviewValues,
  storeTemplatePill
} from "@/lib/storePage";
import { cn } from "@/lib/utils";

type Choice = { name: string; language: string } | null;

/**
 * One message: its switch, when it's sent and its template on the left;
 * what a customer reads on the right. Stacks on a phone.
 */
export function StoreMessageCard({
  id,
  title,
  when,
  enabled,
  switchLabel,
  onToggle,
  extra,
  headerAction,
  templateName,
  templateLanguage,
  templates,
  templatesLoaded,
  onTemplateChange,
  preview,
  error,
  disabled
}: {
  id: string;
  title: string;
  when?: string;
  enabled: boolean;
  switchLabel: string;
  onToggle: (checked: boolean) => void;
  extra?: ReactNode;
  headerAction?: ReactNode;
  templateName?: string | null;
  templateLanguage?: string | null;
  templates: StoreTemplateLists;
  templatesLoaded: boolean;
  onTemplateChange: (choice: Choice) => void;
  preview: Record<string, string>;
  error?: string | null;
  disabled: boolean;
}) {
  const pill = templatesLoaded
    ? storeTemplatePill(templateName, templateLanguage, templates.allTemplates)
    : null;
  const template =
    templateName && !pill?.missing
      ? templates.allTemplates.find(
          (entry) =>
            entry.name === templateName && entry.language === templateLanguage
        )
      : undefined;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-white md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          <div className="flex shrink-0 items-center gap-1">
            {headerAction}
            <Switch
              checked={enabled}
              disabled={disabled}
              aria-label={switchLabel}
              onCheckedChange={onToggle}
            />
          </div>
        </div>
        {when && <p className="text-sm text-muted-foreground">{when}</p>}
        {extra}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
          {pill && (
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                badgeToneClass[pill.tone]
              )}
            >
              {pill.label}
            </span>
          )}
          {template && (
            <span className="text-xs text-muted-foreground">
              {formatLanguage(template.language)}
            </span>
          )}
          <StoreTemplatePicker
            id={id}
            templateName={templateName}
            templateLanguage={templateLanguage}
            options={templates.options}
            allTemplates={templates.allTemplates}
            disabled={disabled}
            showBodyPreview
            trigger={templateName ? "Change template" : "Choose template"}
            triggerLabel={`${templateName ? "Change" : "Choose"} the template for ${title}`}
            onChange={onTemplateChange}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="min-h-40 border-t md:w-[46%] md:shrink-0 md:border-t-0 md:border-l">
        <StorePreview components={template?.components} values={preview} />
      </div>
    </article>
  );
}

type PreviewContext = { storeName: string; currency?: string };

function FixedMessageCard({
  connection,
  kind,
  variables,
  templates,
  templatesLoaded,
  canManage,
  previewContext,
  statusPicker
}: {
  connection: StoreConnection;
  kind: StoreFixedMessageKind;
  variables?: StoreTemplateVariable[];
  templates: StoreTemplateLists;
  templatesLoaded: boolean;
  canManage: boolean;
  previewContext: PreviewContext;
  statusPicker?: ReactNode;
}) {
  const { save } = useStoreSettings(connection.id);
  const setting = connection.settings?.messages?.[kind] || {};
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const title = STORE_PAGE_MESSAGE_TITLES[kind];

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
    <StoreMessageCard
      id={`store-template-${kind}`}
      title={title}
      when={ORDER_MESSAGE_WHEN[kind]}
      enabled={setting.enabled !== false}
      switchLabel={`Send “${title}”`}
      onToggle={(checked) =>
        run({ messages: { [kind]: { enabled: checked } } }, false)
      }
      extra={statusPicker}
      templateName={setting.templateName}
      templateLanguage={setting.templateLanguage}
      templates={templates}
      templatesLoaded={templatesLoaded}
      onTemplateChange={(choice) =>
        run({
          messages: {
            [kind]: {
              templateName: choice?.name || null,
              templateLanguage: choice?.language || null
            }
          }
        })
      }
      preview={storePreviewValues(kind, variables, previewContext)}
      error={error}
      disabled={!canManage || isSaving}
    />
  );
}

/** Extra status messages: cards like the fixed ones, plus Remove. */
function ExtraStatusCards({
  connection,
  variables,
  templates,
  templatesLoaded,
  canManage,
  previewContext
}: {
  connection: StoreConnection;
  variables?: StoreTemplateVariable[];
  templates: StoreTemplateLists;
  templatesLoaded: boolean;
  canManage: boolean;
  previewContext: PreviewContext;
}) {
  const { save } = useStoreSettings(connection.id);
  const rules = connection.settings?.customStatusRules || [];
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [isSaving, setIsSaving] = useState(false);

  const saveRules = async (next: StoreCustomStatusRule[], status: string) => {
    setIsSaving(true);
    const problem = await save({ customStatusRules: next.map(cleanRule) });
    setIsSaving(false);
    setErrors((current) => ({ ...current, [status]: problem }));
  };

  const change = (
    rule: StoreCustomStatusRule,
    patch: Partial<StoreCustomStatusRule>
  ) =>
    saveRules(
      rules.map((entry) =>
        entry.status === rule.status ? { ...entry, ...patch } : entry
      ),
      rule.status
    );

  return (
    <>
      {rules.map((rule) => {
        const label = customRuleLabel(rule);
        return (
          <StoreMessageCard
            key={rule.status}
            id={`store-template-status-${rule.status}`}
            title={label}
            when={`Sent when the order moves to ${label}.`}
            enabled={rule.enabled !== false}
            switchLabel={`Send a message for ${label}`}
            onToggle={(checked) => change(rule, { enabled: checked })}
            headerAction={
              canManage ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove the message for ${label}`}
                  title="Remove"
                  disabled={isSaving}
                  onClick={() =>
                    saveRules(
                      rules.filter((entry) => entry.status !== rule.status),
                      rule.status
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : undefined
            }
            templateName={rule.templateName}
            templateLanguage={rule.templateLanguage}
            templates={templates}
            templatesLoaded={templatesLoaded}
            onTemplateChange={(choice) =>
              change(rule, {
                templateName: choice?.name || null,
                templateLanguage: choice?.language || null
              })
            }
            preview={storePreviewValues(`status_${rule.status}`, variables, {
              ...previewContext,
              statusLabel: label
            })}
            error={errors[rule.status]}
            disabled={!canManage || isSaving}
          />
        );
      })}
    </>
  );
}

/** "Message for another order status": pick a status to add a card for. */
function AddStatusCard({
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
  const rules = connection.settings?.customStatusRules || [];
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const unavailable = unavailableCustomStatuses(
    connection.settings?.shippedStatuses || ["completed"]
  );
  const used = new Set(rules.map((rule) => rule.status));
  const addable = statuses.filter(
    (status) => !unavailable.has(status.slug) && !used.has(status.slug)
  );
  const full = rules.length >= MAX_CUSTOM_STATUS_RULES;

  return (
    <div className="rounded-lg border border-dashed bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold">
            Message for another order status
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            For example &ldquo;Out for delivery&rdquo;. Up to{" "}
            {MAX_CUSTOM_STATUS_RULES}.
          </p>
        </div>
        {canManage && !full && (
          <Select
            value=""
            disabled={isSaving || !addable.length}
            onValueChange={async (slug) => {
              const status = addable.find((entry) => entry.slug === slug);
              if (!status) return;
              setIsSaving(true);
              setError(
                await save({
                  customStatusRules: [
                    ...rules,
                    {
                      status: status.slug,
                      statusLabel: status.name,
                      enabled: true
                    }
                  ].map(cleanRule)
                })
              );
              setIsSaving(false);
            }}
          >
            <SelectTrigger
              className="min-h-11 shrink-0 bg-white font-medium sm:min-h-9"
              aria-label="Add a message for an order status"
            >
              <Plus className="size-4" />
              <SelectValue
                placeholder={
                  addable.length
                    ? "Add status message"
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
        )}
      </div>
      {(error || statusesError) && (
        <p className="mt-2 text-sm text-muted-foreground" role="alert">
          {error || statusesError}
        </p>
      )}
    </div>
  );
}

/** Cash on delivery: cancel on the customer's word, and which payment methods count. */
function CodCard({
  connection,
  canManage
}: {
  connection: StoreConnection;
  canManage: boolean;
}) {
  const { save } = useStoreSettings(connection.id);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingMethods, setIsEditingMethods] = useState(false);
  const autoCancel = connection.settings?.cod?.autoCancel === true;
  const methods = connection.settings?.cod?.paymentMethods?.length
    ? connection.settings.cod.paymentMethods
    : ["cod"];
  const hasCodes = methods.some((method) => method !== "cod");

  const run = async (payload: Parameters<typeof save>[0]) => {
    setIsSaving(true);
    const problem = await save(payload);
    setIsSaving(false);
    setError(problem);
    return problem;
  };

  return (
    <section className="rounded-lg border bg-white p-4 sm:p-5">
      <h3 className="font-heading text-base font-semibold">Cash on delivery</h3>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 text-sm">
          <p className="font-medium">
            Cancel the order when the customer taps Cancel
          </p>
          <p className="mt-1 text-muted-foreground">
            Off: we tag the customer &ldquo;COD cancel requested&rdquo; and add
            a note to the order. You decide. Completed orders are never
            cancelled.
          </p>
        </div>
        <Switch
          checked={autoCancel}
          disabled={!canManage || isSaving}
          aria-label="Cancel the order when the customer taps Cancel"
          onCheckedChange={(checked) => run({ cod: { autoCancel: checked } })}
        />
      </div>

      <div className="mt-4 border-t pt-3 text-sm">
        <p className="text-muted-foreground">
          Cash-on-delivery payment methods:{" "}
          <span className="font-medium text-foreground">
            {methods.map(paymentMethodLabel).join(", ")}
          </span>
          {canManage && (
            <>
              {" · "}
              <button
                type="button"
                className="cursor-pointer font-medium text-primary hover:underline"
                aria-expanded={isEditingMethods}
                onClick={() => setIsEditingMethods((value) => !value)}
              >
                {isEditingMethods ? "Done" : "Change"}
              </button>
            </>
          )}
        </p>
        {(hasCodes || isEditingMethods) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            The code shown in WooCommerce › Settings › Payments
          </p>
        )}
        {isEditingMethods && (
          <div className="mt-1">
            <p className="text-xs text-muted-foreground">
              Orders paid with these get the cash-on-delivery check instead of
              &ldquo;Order confirmed&rdquo;.
            </p>
            <StoreCodPaymentMethods
              methods={methods}
              canManage={canManage}
              isSaving={isSaving}
              onSave={(paymentMethods) => run({ cod: { paymentMethods } })}
              onError={setError}
            />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Customers get tags you can use in broadcasts: &ldquo;Store
        customer&rdquo;, plus &ldquo;COD confirmed&rdquo;, &ldquo;COD cancel
        requested&rdquo;, &ldquo;COD cancelled&rdquo; or &ldquo;COD no
        reply&rdquo;.
      </p>
      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Order messages: a card per message with what customers read. */
export function StoreOrderMessagesTab({
  connection,
  templateVariables,
  templates,
  templatesLoaded,
  statuses,
  statusesError,
  currency,
  canManage,
  onOpenTemplates
}: {
  connection: StoreConnection;
  templateVariables: Record<string, StoreTemplateVariable[]>;
  templates: {
    options: StoreTemplateChoice[];
    allTemplates: StoreTemplateChoice[];
  };
  templatesLoaded: boolean;
  statuses: StoreOrderStatus[];
  statusesError?: string | null;
  currency?: string;
  canManage: boolean;
  onOpenTemplates: () => void;
}) {
  const previewContext = { storeName: connection.storeName, currency };
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Turn messages on or off. Each preview shows what a customer reads.
        </p>
        {canManage && (
          <Button
            variant="outline"
            className="min-h-11 shrink-0 sm:min-h-9"
            onClick={onOpenTemplates}
          >
            Ready-made templates
          </Button>
        )}
      </div>

      {STORE_MESSAGE_KINDS.map((kind) => (
        <FixedMessageCard
          key={kind}
          connection={connection}
          kind={kind}
          variables={templateVariables[kind]}
          templates={templates}
          templatesLoaded={templatesLoaded}
          canManage={canManage}
          previewContext={previewContext}
          statusPicker={
            kind === "order_shipped" ? (
              <div className="max-w-xs">
                <ShippedStatusPicker
                  connection={connection}
                  statuses={statuses}
                  statusesError={statusesError}
                  canManage={canManage}
                />
              </div>
            ) : undefined
          }
        />
      ))}

      <ExtraStatusCards
        connection={connection}
        variables={templateVariables.custom_status}
        templates={templates}
        templatesLoaded={templatesLoaded}
        canManage={canManage}
        previewContext={previewContext}
      />

      <AddStatusCard
        connection={connection}
        statuses={statuses}
        statusesError={statusesError}
        canManage={canManage}
      />

      <CodCard connection={connection} canManage={canManage} />
    </div>
  );
}
