import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Eye,
  FileText,
  Flag,
  Info,
  Plus,
  Trash2,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createDrip, updateDrip } from "@/client-api/functions/drips";
import { getAllTemplates } from "@/client-api/functions/templates";
import {
  Drip,
  DripComponent,
  DripPayload
} from "@/client-api/types/drips.type";
import { MessageTemplate } from "@/client-api/types/templates.type";
import { useOrgTimezone } from "@/components/broadcasts/BroadcastActions";
import { rememberDrip } from "@/components/drips/dripCache";
import { BroadcastSenderSelect } from "@/components/broadcasts/BroadcastSenderSelect";
import { VariableMappingRows } from "@/components/broadcasts/VariableMappingRows";
import { TemplateCategoryBadge } from "@/components/shared/StatusBadges";
import { TemplatePickerList } from "@/components/templates/TemplatePickerList";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { isPaymentBlocked } from "@/components/whatsapp/PaymentBlockedCallout";
import { WhatsAppPreview } from "@/components/whatsapp/WhatsAppPreview";
import {
  isUsableWhatsAppNumber,
  useWhatsAppNumberContext
} from "@/components/whatsapp/WhatsAppNumberSwitcher";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { humanizeTemplateName } from "@/lib/displayFormat";
import {
  DEFAULT_SEND_HOURS,
  DRIP_MAX_STEPS,
  DRIP_MIN_STEPS,
  dripErrorMessage,
  hasStopPromotionsButton,
  hourLabel,
  isDripTemplate,
  isOfferCategory,
  sendHoursProblem,
  waitFromMinutes,
  waitProblem,
  waitToMinutes,
  WaitUnit,
  WaitValue
} from "@/lib/drips";
import {
  buildBroadcastTemplateComponents,
  defaultMappingForSlot,
  getTemplateVariableSlots,
  isMappingComplete,
  mappingsFromComponents,
  resolvePreviewValues,
  VariableMapping
} from "@/lib/templateVariables";
import { timezoneOptions } from "@/lib/timezones";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

interface StepDraft {
  key: string;
  templateId: string;
  /** The saved values, applied once the template list arrives. */
  savedComponents?: DripComponent[];
  savedName?: string;
  /** null until the template is known. */
  mappings: Record<string, VariableMapping> | null;
  wait: WaitValue;
}

let keySeed = 0;
const newKey = () => `step-${(keySeed += 1)}`;

const blankStep = (isFirst: boolean): StepDraft => ({
  key: newKey(),
  templateId: "",
  mappings: {},
  wait: isFirst
    ? { immediate: true, amount: "1", unit: "days" }
    : { immediate: false, amount: "1", unit: "days" }
});

const stepsFromDrip = (drip?: Drip | null): StepDraft[] =>
  drip?.steps.length
    ? drip.steps.map((step) => ({
        key: newKey(),
        templateId: step.templateId,
        savedComponents: step.components,
        savedName: step.templateName,
        mappings: null,
        wait: waitFromMinutes(step.delayMinutes)
      }))
    : [blankStep(true), blankStep(false)];

const mappingsFor = (template: MessageTemplate, saved?: DripComponent[]) => {
  const slots = getTemplateVariableSlots(template.components);
  const fromSaved = saved ? mappingsFromComponents(slots, saved) : {};
  return Object.fromEntries(
    slots.map((slot) => [
      slot.id,
      fromSaved[slot.id] || defaultMappingForSlot(slot)
    ])
  );
};

const START_HOURS = Array.from({ length: 23 }, (_, hour) => hour);
const END_HOURS = Array.from({ length: 23 }, (_, index) => index + 2);

export type DripSaveIntent = "save" | "next";

/**
 * Create or edit a drip: name and number, the messages with the wait before
 * each, sending hours and "Stop when they reply". After a drip has started,
 * messages can be changed or added but not removed, and the number is
 * fixed. Archived drips are shown read-only.
 */
export function DripBuilder({
  drip,
  onSaved
}: {
  drip?: Drip | null;
  onSaved: (drip: Drip, intent: DripSaveIntent) => void;
}) {
  const { can } = useCurrentMembership();
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const orgTimezone = useOrgTimezone();
  const { numbers, effectiveNumber } = useWhatsAppNumberContext();

  const isDraft = !drip || drip.status === "draft";
  const isArchived = drip?.status === "archived";
  const hasStarted = Boolean(drip?.activatedAt) || !isDraft;
  const lockedCount = hasStarted ? drip?.steps.length || 0 : 0;

  const [name, setName] = useState(drip?.name || "");
  const [senderId, setSenderId] = useState(drip?.phoneNumberId || "");
  const [steps, setSteps] = useState<StepDraft[]>(() => stepsFromDrip(drip));
  const [stepsChanged, setStepsChanged] = useState(!drip);
  const [startHour, setStartHour] = useState(
    drip?.sendWindow?.startHour ?? DEFAULT_SEND_HOURS.startHour
  );
  const [endHour, setEndHour] = useState(
    drip?.sendWindow?.endHour ?? DEFAULT_SEND_HOURS.endHour
  );
  const [timezone, setTimezone] = useState(
    drip?.sendWindow?.timezone || orgTimezone
  );
  const [stopOnReply, setStopOnReply] = useState(drip?.stopOnReply ?? true);
  const [focusedKey, setFocusedKey] = useState(steps[0]?.key || "");
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [mobilePreviewKey, setMobilePreviewKey] = useState<string | null>(null);
  // The button last pressed, so its problems show.
  const [attempted, setAttempted] = useState<DripSaveIntent | null>(null);
  const showProblems = attempted !== null;
  const [error, setError] = useState("");

  // ---------- sender ----------
  const senders = useMemo(
    () => numbers.filter(isUsableWhatsAppNumber),
    [numbers]
  );
  const sender = numbers.find((number) => number.phoneNumberId === senderId);
  useEffect(() => {
    if (senderId) return;
    const preferred =
      effectiveNumber && !isPaymentBlocked(effectiveNumber)
        ? effectiveNumber
        : senders.find((number) => !isPaymentBlocked(number));
    if (preferred?.phoneNumberId) setSenderId(preferred.phoneNumberId);
  }, [effectiveNumber, senderId, senders]);

  // ---------- templates ----------
  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery({
    queryKey: ["templates", orgId],
    queryFn: getAllTemplates,
    enabled: Boolean(orgId) && can("templates:view"),
    refetchOnMount: "always"
  });
  const templates = useMemo(
    () =>
      (templatesData?.data.templates || []).filter((template) =>
        isDripTemplate(template, sender?.wabaId)
      ),
    [sender?.wabaId, templatesData?.data.templates]
  );
  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.templateId, template])),
    [templates]
  );
  const templatesReady = Boolean(templatesData) || !can("templates:view");

  // Saved steps get their values once their templates are known.
  useEffect(() => {
    if (!templates.length) return;
    setSteps((current) =>
      current.some((step) => step.mappings === null)
        ? current.map((step) => {
            if (step.mappings !== null) return step;
            const template = templateById.get(step.templateId);
            return template
              ? {
                  ...step,
                  mappings: mappingsFor(template, step.savedComponents)
                }
              : step;
          })
        : current
    );
  }, [templateById, templates.length]);

  const timezones = useMemo(
    () => timezoneOptions(timezone, orgTimezone),
    [orgTimezone, timezone]
  );

  // ---------- step edits ----------
  const changeStep = (key: string, patch: Partial<StepDraft>) => {
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, ...patch } : step))
    );
    setStepsChanged(true);
  };
  const pickTemplate = (key: string, template: MessageTemplate) =>
    changeStep(key, {
      templateId: template.templateId,
      savedComponents: undefined,
      savedName: undefined,
      mappings: mappingsFor(template)
    });
  const addStep = () => {
    const step = blankStep(false);
    setSteps((current) => [...current, step]);
    setFocusedKey(step.key);
    setStepsChanged(true);
  };
  const removeStep = (key: string) => {
    setSteps((current) => current.filter((step) => step.key !== key));
    if (focusedKey === key) setFocusedKey(steps[0]?.key || "");
    setStepsChanged(true);
  };

  // ---------- problems ----------
  const stepIssues = steps.map((step, index) => {
    const template = templateById.get(step.templateId);
    const isUnavailable =
      Boolean(step.templateId) && !template && templatesReady;
    const slots = template ? getTemplateVariableSlots(template.components) : [];
    const missingValues = template
      ? slots.some((slot) => !isMappingComplete(step.mappings?.[slot.id]))
      : false;
    return {
      template: !step.templateId
        ? "Choose a template."
        : isUnavailable
          ? "This template can't be used any more. Choose another one."
          : "",
      wait: waitProblem(step.wait, index === 0),
      values: missingValues ? "Fill in every value." : ""
    };
  });
  const filledSteps = steps.filter((step) => step.templateId);
  const hoursProblem = sendHoursProblem(startHour, endHour);

  const problemFor = (intent: DripSaveIntent) => {
    if (!name.trim()) return "Give the drip a name.";
    if (!hasStarted && (!senderId || (sender && isPaymentBlocked(sender))))
      return "Choose a WhatsApp number.";
    if (stepsChanged) {
      for (const [index, issue] of stepIssues.entries()) {
        const isEmpty = !steps[index].templateId;
        if (isEmpty && intent === "save") continue;
        const text = issue.template || issue.wait || issue.values;
        if (text) return `Message ${index + 1}: ${text}`;
      }
    }
    if (intent === "next" && filledSteps.length < DRIP_MIN_STEPS)
      return "A drip needs at least 2 messages.";
    if (hoursProblem) return hoursProblem;
    return "";
  };

  // ---------- save ----------
  const buildSteps = () =>
    filledSteps.map((step) => {
      const template = templateById.get(step.templateId);
      const built = template
        ? buildBroadcastTemplateComponents(
            getTemplateVariableSlots(template.components),
            step.mappings || {}
          )
        : null;
      return {
        templateId: step.templateId,
        components: built?.ok
          ? built.components
          : (step.savedComponents as DripComponent[]) || [],
        delayMinutes: waitToMinutes(step.wait) ?? 0
      };
    });

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async (intent: DripSaveIntent) => {
      const payload: DripPayload = {
        name: name.trim(),
        ...(hasStarted ? {} : { phoneNumberId: senderId }),
        ...(stepsChanged ? { steps: buildSteps() } : {}),
        sendWindow: { startHour, endHour, timezone },
        stopOnReply
      };
      const saved = drip
        ? await updateDrip({ dripId: drip.id, payload })
        : await createDrip(payload);
      return { saved, intent };
    },
    meta: { showToast: false },
    onSuccess: ({ saved, intent }) => {
      rememberDrip(queryClient, saved);
      setStepsChanged(false);
      setAttempted(null);
      setError("");
      if (intent === "save") {
        toast.success(isDraft ? "Draft saved." : "Changes saved.");
      }
      onSaved(saved, intent);
    },
    onError: (failure) =>
      setError(
        dripErrorMessage(
          failure,
          "The drip couldn't be saved. Please try again."
        )
      )
  });

  const attempt = (intent: DripSaveIntent) => {
    setAttempted(intent);
    setError("");
    if (problemFor(intent)) return;
    save(intent);
  };
  const footerProblem = attempted ? problemFor(attempted) : "";

  // ---------- preview ----------
  const previewFor = (step?: StepDraft) => {
    const template = step ? templateById.get(step.templateId) : undefined;
    if (!template || !step) {
      return (
        <div className="rounded-lg bg-[#efeae2] p-10 text-center text-sm text-slate-500">
          Choose a template to see the message.
        </div>
      );
    }
    const slots = getTemplateVariableSlots(template.components);
    return (
      <WhatsAppPreview
        components={template.components}
        variableValues={resolvePreviewValues(slots, step.mappings || {})}
      />
    );
  };
  const focusedIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === focusedKey)
  );
  const pickingIndex = steps.findIndex((step) => step.key === pickingKey);
  const hasOfferStep = steps.some((step) =>
    isOfferCategory(templateById.get(step.templateId)?.category)
  );
  const senderLabel =
    sender?.displayPhoneNumber || sender?.phoneNumberId || senderId;

  return (
    <div className="space-y-5 pb-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={isArchived} className="min-w-0 space-y-5">
          {/* ---------- basics ---------- */}
          <section className="grid gap-4 rounded-lg bg-white p-5 shadow-xs sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="drip-name">Name</Label>
              <Input
                id="drip-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Welcome series"
                maxLength={120}
                aria-invalid={showProblems && !name.trim()}
              />
              <p className="text-xs text-muted-foreground">
                Only your team sees this.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Send from</Label>
              {hasStarted ? (
                <>
                  <p className="flex h-11 items-center rounded-sm border bg-muted/40 px-3 text-sm">
                    {senderLabel || "Your WhatsApp number"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The number can&apos;t change after the drip has started.
                  </p>
                </>
              ) : (
                <BroadcastSenderSelect
                  numbers={senders}
                  value={senderId}
                  onValueChange={(value) => {
                    setSenderId(value);
                    setStepsChanged(true);
                  }}
                />
              )}
            </div>
          </section>

          {/* ---------- messages ---------- */}
          <section className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
            <div>
              <h2 className="font-heading text-lg font-semibold">Messages</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each person gets these in order, with a wait before each one.
                Use 2 to 5 approved templates.
              </p>
            </div>
            {hasOfferStep && (
              <p className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
                <span>
                  A contact gets at most one offer a day. Offer steps less than
                  a day apart will wait until the day is up.
                </span>
              </p>
            )}

            <ol aria-label="Messages in this drip">
              <li className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserPlus className="size-4" />
                </span>
                <span className="text-sm font-medium">
                  Someone joins the drip
                </span>
              </li>
              {steps.map((step, index) => {
                const template = templateById.get(step.templateId);
                const issue = stepIssues[index];
                const slots = template
                  ? getTemplateVariableSlots(template.components)
                  : [];
                const canRemove =
                  !isArchived && index >= lockedCount && steps.length > 1;
                const isNew = hasStarted && index >= lockedCount;
                const showIssue = showProblems && stepsChanged;
                const offerWithoutStop =
                  template &&
                  isOfferCategory(template.category) &&
                  !hasStopPromotionsButton(template.components);
                return (
                  <Fragment key={step.key}>
                    <li className="ml-[17px] border-l-2 border-dashed border-primary/25 py-4 pl-6">
                      <WaitEditor
                        wait={step.wait}
                        isFirst={index === 0}
                        onChange={(wait) => changeStep(step.key, { wait })}
                        problem={showIssue ? issue.wait : ""}
                      />
                    </li>
                    <li>
                      <div
                        onFocusCapture={() => setFocusedKey(step.key)}
                        onClick={() => setFocusedKey(step.key)}
                        className={cn(
                          "rounded-lg border bg-white p-4 transition",
                          focusedIndex === index &&
                            "lg:border-primary/50 lg:ring-1 lg:ring-primary/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium">Message {index + 1}</p>
                              {(template || step.savedName) && (
                                <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="truncate">
                                    {humanizeTemplateName(
                                      template?.name || step.savedName
                                    )}
                                  </span>
                                  {template && (
                                    <TemplateCategoryBadge
                                      category={template.category}
                                    />
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {template && !isArchived && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPickingKey(step.key)}
                              >
                                Change
                              </Button>
                            )}
                            {canRemove && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label={`Remove message ${index + 1}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeStep(step.key);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          {!step.templateId ? (
                            <button
                              type="button"
                              onClick={() => setPickingKey(step.key)}
                              className={cn(
                                "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground",
                                showProblems && "border-destructive/50"
                              )}
                            >
                              <FileText className="size-5" />
                              <span className="font-medium text-foreground">
                                Choose a template
                              </span>
                              <span className="text-xs">
                                The message this person gets.
                              </span>
                            </button>
                          ) : !template && templatesReady ? (
                            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center">
                              <AlertTriangle className="size-4 shrink-0" />
                              <p className="flex-1">
                                This template can&apos;t be used any more. It
                                may no longer be approved by WhatsApp. Choose
                                another one.
                              </p>
                              {!isArchived && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPickingKey(step.key)}
                                >
                                  Choose
                                </Button>
                              )}
                            </div>
                          ) : null}

                          {template && slots.length > 0 && step.mappings && (
                            <div className="space-y-2">
                              <div>
                                <p className="text-sm font-medium">
                                  Fill in the blanks
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Use each person&apos;s details, or type the
                                  same text for everyone.
                                </p>
                              </div>
                              <VariableMappingRows
                                slots={slots}
                                mappings={step.mappings}
                                showMissing={showIssue}
                                onChange={(slotId, mapping) =>
                                  changeStep(step.key, {
                                    mappings: {
                                      ...(step.mappings || {}),
                                      [slotId]: mapping
                                    }
                                  })
                                }
                              />
                            </div>
                          )}

                          {offerWithoutStop && (
                            <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                              This offer has no Stop promotions button. People
                              who don&apos;t want offers may block or report you
                              instead, which can hurt your number&apos;s
                              quality.
                            </p>
                          )}

                          {isNew && (
                            <p className="flex gap-2 text-xs text-muted-foreground">
                              <Info className="mt-0.5 size-3.5 shrink-0" />
                              People who finished the drip will get the new
                              message too.
                            </p>
                          )}

                          {showIssue && issue.template && step.templateId && (
                            <p className="text-xs text-destructive">
                              {issue.template}
                            </p>
                          )}

                          {template && (
                            <div className="lg:hidden">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                  setMobilePreviewKey((current) =>
                                    current === step.key ? null : step.key
                                  )
                                }
                              >
                                <Eye className="size-4" />
                                {mobilePreviewKey === step.key
                                  ? "Hide preview"
                                  : "Preview"}
                              </Button>
                              {mobilePreviewKey === step.key && (
                                <div className="mt-3">{previewFor(step)}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  </Fragment>
                );
              })}
              {!isArchived && steps.length < DRIP_MAX_STEPS ? (
                <li className="ml-[17px] flex flex-wrap items-center gap-3 border-l-2 border-dashed border-primary/25 py-4 pl-6">
                  <Button type="button" variant="outline" onClick={addStep}>
                    <Plus className="size-4" />
                    Add another message
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {steps.length} of {DRIP_MAX_STEPS}
                  </span>
                </li>
              ) : (
                <li
                  aria-hidden
                  className="ml-[17px] h-6 border-l-2 border-dashed border-primary/25"
                />
              )}
              <li className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Flag className="size-4" />
                </span>
                <span className="text-sm text-muted-foreground">
                  Done. They get nothing more from this drip.
                </span>
              </li>
            </ol>
          </section>

          {/* ---------- settings ---------- */}
          <section className="space-y-5 rounded-lg bg-white p-5 shadow-xs">
            <div className="space-y-3">
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Sending hours
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Messages only go out between these hours. Anything due outside
                  them waits for the next morning.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>From</span>
                <Select
                  value={String(startHour)}
                  onValueChange={(value) => setStartHour(Number(value))}
                >
                  <SelectTrigger
                    className="h-10 w-28 bg-white"
                    aria-label="Start of sending hours"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {START_HOURS.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {hourLabel(hour)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>to</span>
                <Select
                  value={String(endHour)}
                  onValueChange={(value) => setEndHour(Number(value))}
                >
                  <SelectTrigger
                    className="h-10 w-28 bg-white"
                    aria-label="End of sending hours"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {END_HOURS.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {hourLabel(hour)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hoursProblem && (
                <p className="text-xs text-destructive">{hoursProblem}</p>
              )}
              <div className="space-y-2 sm:max-w-sm">
                <Label>Time zone</Label>
                <Combobox
                  value={timezone}
                  onChange={(value) => value && setTimezone(value)}
                  options={timezones}
                  placeholder="Choose a time zone"
                  disabled={isArchived}
                />
              </div>
            </div>
            <div className="border-t pt-5">
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">
                    Stop when they reply
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Someone who replies leaves the drip and gets no more
                    messages from it, so you can talk to them in Conversations.
                  </span>
                </span>
                <Switch
                  checked={stopOnReply}
                  onCheckedChange={setStopOnReply}
                />
              </label>
            </div>
          </section>
        </fieldset>

        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-2 rounded-lg bg-white p-4 shadow-xs">
            <p className="text-sm font-medium">
              Message {focusedIndex + 1} preview
            </p>
            {previewFor(steps[focusedIndex])}
            <p className="text-xs text-muted-foreground">
              Click a message to preview it.
            </p>
          </div>
        </aside>
      </div>

      {!isArchived && (
        <div className="sticky bottom-0 z-20 rounded-lg border bg-white/95 p-3 shadow-xs backdrop-blur">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              className={cn(
                "text-xs",
                footerProblem ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {footerProblem ||
                (isDraft
                  ? "Nothing is sent until you choose who joins and start the drip."
                  : "Changes apply to the next messages people get.")}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {isDraft ? (
                <>
                  <Button
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => attempt("save")}
                  >
                    Save draft
                  </Button>
                  <Button isLoading={isSaving} onClick={() => attempt("next")}>
                    Next: choose who joins
                    <ArrowRight className="size-4" />
                  </Button>
                </>
              ) : (
                <Button isLoading={isSaving} onClick={() => attempt("save")}>
                  Save changes
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(pickingKey)}
        onOpenChange={(open) => !open && setPickingKey(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Choose a template for message {pickingIndex + 1}
            </DialogTitle>
            <DialogDescription>
              Templates WhatsApp has approved for this number. Login code
              templates can&apos;t be used in a drip.
            </DialogDescription>
          </DialogHeader>
          <TemplatePickerList
            templates={templates}
            selectedId={steps[pickingIndex]?.templateId}
            isLoading={isTemplatesLoading}
            onSelect={(template) => {
              if (pickingKey) pickTemplate(pickingKey, template);
              setPickingKey(null);
            }}
            emptyText="No approved templates for this number yet."
          />
          <p className="text-xs text-muted-foreground">
            Need a new one?{" "}
            <Link
              href="/templates/create"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              Create a template
            </Link>
            . WhatsApp reviews it before it can be used.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WaitEditor({
  wait,
  isFirst,
  onChange,
  problem
}: {
  wait: WaitValue;
  isFirst: boolean;
  onChange: (wait: WaitValue) => void;
  problem?: string;
}) {
  const one = wait.amount === "1";
  const amountFields = (
    <>
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        value={wait.amount}
        onChange={(event) => onChange({ ...wait, amount: event.target.value })}
        className="h-9 w-20 bg-white"
        aria-label="How long to wait"
        aria-invalid={Boolean(problem)}
      />
      <Select
        value={wait.unit}
        onValueChange={(unit) => onChange({ ...wait, unit: unit as WaitUnit })}
      >
        <SelectTrigger className="h-9 w-28 bg-white" aria-label="Hours or days">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hours">{one ? "hour" : "hours"}</SelectItem>
          <SelectItem value="days">{one ? "day" : "days"}</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Clock className="size-4 shrink-0 text-muted-foreground" />
        {isFirst ? (
          <>
            <Select
              value={wait.immediate ? "now" : "wait"}
              onValueChange={(value) =>
                onChange({ ...wait, immediate: value === "now" })
              }
            >
              <SelectTrigger
                className="h-9 w-auto bg-white"
                aria-label="When to send the first message"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Send right away</SelectItem>
                <SelectItem value="wait">Wait first</SelectItem>
              </SelectContent>
            </Select>
            {!wait.immediate && amountFields}
            <span className="text-muted-foreground">
              {wait.immediate ? "when they join" : "after they join"}
            </span>
          </>
        ) : (
          <>
            <span>Wait</span>
            {amountFields}
            <span className="text-muted-foreground">
              after the previous message
            </span>
          </>
        )}
      </div>
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}
