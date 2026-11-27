import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Info,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createBroadcast,
  previewBroadcastAudienceCount,
  startBroadcast
} from "@/client-api/functions/broadcasts";
import { getAllSubscribers } from "@/client-api/functions/subscribers";
import { getAllTemplates } from "@/client-api/functions/templates";
import {
  Broadcast,
  BroadcastAudience
} from "@/client-api/types/broadcasts.type";
import { Subscriber } from "@/client-api/types/subscribers.type";
import { MessageTemplate } from "@/client-api/types/templates.type";
import {
  AudiencePicker,
  useAudienceSources
} from "@/components/broadcasts/AudiencePicker";
import { BroadcastSenderSelect } from "@/components/broadcasts/BroadcastSenderSelect";
import { useOrgTimezone } from "@/components/broadcasts/BroadcastActions";
import {
  QuickReplyRouting,
  resolveQuickReplyRoutes,
  useQuickReplyTriggers
} from "@/components/broadcasts/QuickReplyRouting";
import {
  buildScheduledLocal,
  DEFAULT_SCHEDULE,
  ScheduleFields,
  scheduleProblem,
  ScheduleValue
} from "@/components/broadcasts/ScheduleFields";
import { VariableMappingRows } from "@/components/broadcasts/VariableMappingRows";
import { TemplatePickerList } from "@/components/templates/TemplatePickerList";
import { Button } from "@/components/ui/button";
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
import { useLiveFlows } from "@/hooks/useLiveFlows";
import {
  describeAudience,
  hasAudienceSelection,
  warningText
} from "@/lib/broadcastAudience";
import { setBroadcastRetryPreference } from "@/lib/broadcastRetryPreference";
import { isStopPromotionsLabel } from "@/lib/drips";
import { formatCount, humanizeTemplateName } from "@/lib/displayFormat";
import {
  buildBroadcastTemplateComponents,
  defaultMappingForSlot,
  getTemplateVariableSlots,
  isMappingComplete,
  mappingsFromComponents,
  resolvePreviewValues,
  resolveSlotValue,
  VariableMapping
} from "@/lib/templateVariables";
import { whatsappContactName } from "@/lib/inbox";
import { cn } from "@/lib/utils";
import { useWorkspacePaused } from "@/lib/workspacePause";
import { useOrganizationStore } from "@/stores/organizationStore";

const STEPS = ["Message", "Audience", "Personalise", "Review & send"] as const;
const SAMPLE_CONTACT = "__samples__";

const errorMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
  fallback;

const shortDate = () =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date()
  );

const contactName = (contact: Subscriber) => whatsappContactName(contact);

export function CreateBroadcastWizard({
  open,
  onOpenChange,
  initialTemplateId,
  duplicateFrom,
  onCreated
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateId?: string;
  duplicateFrom?: Broadcast | null;
  onCreated: (broadcastId: string) => void;
}) {
  const { can } = useCurrentMembership();
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const timezone = useOrgTimezone();
  const { numbers, effectiveNumber } = useWhatsAppNumberContext();
  const { effectiveCanvasFor } = useLiveFlows();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(
    duplicateFrom ? `${duplicateFrom.name} (copy)` : ""
  );
  const [isNameEdited, setIsNameEdited] = useState(Boolean(duplicateFrom));
  const [senderId, setSenderId] = useState(
    duplicateFrom?.whatsappPhoneNumberId || ""
  );
  const [templateId, setTemplateId] = useState(
    duplicateFrom?.template?.templateId || initialTemplateId || ""
  );
  const [audience, setAudience] = useState<BroadcastAudience>(
    duplicateFrom?.audience
      ? {
          mode: duplicateFrom.audience.mode,
          tags: duplicateFrom.audience.tags || [],
          tagMatch: duplicateFrom.audience.tagMatch || "any",
          subscriberIds: (duplicateFrom.audience.subscriberIds || []).map(
            String
          ),
          campaignSourceIds: duplicateFrom.audience.campaignSourceIds || []
        }
      : {
          mode: "all",
          tags: [],
          tagMatch: "any",
          subscriberIds: [],
          campaignSourceIds: []
        }
  );
  const [mappings, setMappings] = useState<Record<string, VariableMapping>>({});
  const [routePicks, setRoutePicks] = useState<Record<number, string>>({});
  const [retryOnLimit, setRetryOnLimit] = useState(true);
  const [retryOnEngagement, setRetryOnEngagement] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [previewContactId, setPreviewContactId] = useState(SAMPLE_CONTACT);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [personaliseError, setPersonaliseError] = useState("");
  const [submitError, setSubmitError] = useState("");

  // ---------- data ----------
  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery({
    queryKey: ["templates", orgId],
    queryFn: getAllTemplates,
    enabled: open && Boolean(orgId) && can("templates:view"),
    refetchOnMount: "always"
  });
  const templates = useMemo(
    () =>
      (templatesData?.data.templates || []).filter(
        (template) => template.status.toUpperCase() === "APPROVED"
      ),
    [templatesData?.data.templates]
  );
  const template: MessageTemplate | undefined = templates.find(
    (item) => item.templateId === templateId
  );
  const isMarketing = template?.category?.toUpperCase() === "MARKETING";

  const senders = useMemo(
    () => numbers.filter(isUsableWhatsAppNumber),
    [numbers]
  );
  const sender = senders.find((number) => number.phoneNumberId === senderId);
  useEffect(() => {
    if (senderId) return;
    const preferred =
      effectiveNumber && !isPaymentBlocked(effectiveNumber)
        ? effectiveNumber
        : senders.find((number) => !isPaymentBlocked(number));
    if (preferred?.phoneNumberId) setSenderId(preferred.phoneNumberId);
  }, [effectiveNumber, senderId, senders]);
  const senderLabel = sender?.displayPhoneNumber || sender?.phoneNumberId || "";
  const flowName = sender ? effectiveCanvasFor(sender)?.name : undefined;

  const audienceSources = useAudienceSources(audience, open);
  const { contacts } = audienceSources;

  // Audience count, debounced so ticking several boxes doesn't spam it.
  const [debouncedAudience, setDebouncedAudience] = useState(audience);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAudience(audience), 400);
    return () => clearTimeout(timer);
  }, [audience]);
  const isAudienceReady = hasAudienceSelection(audience);
  const { data: countData, isFetching: isCounting } = useQuery({
    // With the sender, the backend also returns its messaging-limit warning.
    queryKey: ["broadcast-audience-count", debouncedAudience, senderId],
    queryFn: () =>
      previewBroadcastAudienceCount(debouncedAudience, senderId || undefined),
    enabled: open && hasAudienceSelection(debouncedAudience),
    placeholderData: (previous) => previous
  });
  const audienceCount = isAudienceReady ? countData?.data?.count : undefined;

  // A few real contacts to preview personalised values with.
  const { data: previewContactsData } = useQuery({
    queryKey: ["broadcast-preview-contacts", audience.mode, audience.tags?.[0]],
    queryFn: () =>
      getAllSubscribers({
        channel: "whatsapp",
        limit: 5,
        broadcastEligibility: "eligible",
        ...(audience.mode === "tags" && audience.tags?.[0]
          ? { tag: audience.tags[0] }
          : {})
      }),
    enabled: open && can("contacts:view") && audience.mode !== "specific"
  });
  const previewContacts = useMemo(() => {
    if (audience.mode === "specific") {
      return contacts
        .filter((contact) => audience.subscriberIds?.includes(contact._id))
        .slice(0, 5);
    }
    return (previewContactsData?.data.subscribers || []).slice(0, 5);
  }, [audience.mode, audience.subscriberIds, contacts, previewContactsData]);
  const previewContact =
    previewContacts.find((contact) => contact._id === previewContactId) || null;
  const firstContact = previewContacts[0] || null;

  // ---------- template-derived ----------
  const slots = useMemo(
    () => getTemplateVariableSlots(template?.components || []),
    [template?.components]
  );
  const quickReplyButtons = useMemo(
    () =>
      (
        template?.components.find((component) => component.type === "BUTTONS")
          ?.buttons || []
      )
        .map((button, index) => ({ button, index }))
        // "Stop promotions" stops offers by itself; it never starts a flow.
        .filter(
          ({ button }) =>
            button.type === "QUICK_REPLY" && !isStopPromotionsLabel(button.text)
        ),
    [template?.components]
  );
  const triggers = useQuickReplyTriggers(
    senderId,
    quickReplyButtons.length > 0
  );
  const needsPersonalise = slots.length > 0 || quickReplyButtons.length > 0;

  // New template: start each variable from its default (or, when
  // duplicating, from the original broadcast). Keyed on the template id so
  // a background refetch of the template list doesn't wipe choices.
  const initialisedTemplateId = useRef("");
  useEffect(() => {
    if (!template || initialisedTemplateId.current === template.templateId)
      return;
    initialisedTemplateId.current = template.templateId;
    const fromDuplicate =
      duplicateFrom &&
      duplicateFrom.template?.templateId === template.templateId
        ? mappingsFromComponents(slots, duplicateFrom.payload?.components)
        : {};
    setMappings(
      Object.fromEntries(
        slots.map((slot) => [
          slot.id,
          fromDuplicate[slot.id] || defaultMappingForSlot(slot)
        ])
      )
    );
    setRoutePicks({});
    setShowMissing(false);
    setPersonaliseError("");
  }, [duplicateFrom, slots, template]);

  useEffect(() => {
    if (template && !isNameEdited)
      setName(`${humanizeTemplateName(template.name)} · ${shortDate()}`);
  }, [isNameEdited, template]);

  const previewValues = resolvePreviewValues(slots, mappings, previewContact);
  const missingSlots = slots.filter(
    (slot) => !isMappingComplete(mappings[slot.id])
  );
  const audienceWarnings = isAudienceReady
    ? (countData?.data?.warnings || []).map(warningText).filter(Boolean)
    : [];

  // ---------- step validity ----------
  const stepProblem = (index: number): string => {
    if (index === 0) {
      if (!senderId || (sender && isPaymentBlocked(sender)))
        return "Choose a sender.";
      if (!template) return "Choose an approved template.";
      if (!name.trim()) return "Give the broadcast a name.";
      return "";
    }
    if (index === 1) {
      if (!isAudienceReady) return "Choose who receives this.";
      if (audienceCount === 0) return "No contacts match this audience.";
      return "";
    }
    if (index === 2) {
      if (!needsPersonalise) return "";
      if (missingSlots.length) return "Fill every variable.";
      if (quickReplyButtons.length && triggers.hasNoLiveFlow)
        return "Quick replies need an active flow on this number.";
      if (quickReplyButtons.length && triggers.isLoading)
        return "Loading the flow…";
      return "";
    }
    return scheduleProblem(schedule);
  };

  const goNext = () => {
    const problem = stepProblem(step);
    if (problem) {
      if (step === 2) setShowMissing(true);
      return;
    }
    let next = step + 1;
    if (next === 2 && !needsPersonalise) next = 3;
    setStep(Math.min(next, STEPS.length - 1));
  };
  const goBack = () => {
    let previous = step - 1;
    if (previous === 2 && !needsPersonalise) previous = 1;
    setStep(Math.max(previous, 0));
  };

  // ---------- submit ----------
  const { mutate: submit, isPending: isSubmitting } = useMutation({
    mutationFn: async (mode: "draft" | "send") => {
      const built = buildBroadcastTemplateComponents(slots, mappings);
      if (!built.ok) throw new Error(built.error);
      const created = await createBroadcast({
        name: name.trim(),
        templateId,
        audience,
        components: built.components,
        phoneNumberId: senderId,
        retryOnRecipientEngagementLimit: isMarketing
          ? retryOnEngagement
          : false,
        ...(quickReplyButtons.length
          ? {
              quickReplyRoutes: resolveQuickReplyRoutes(
                quickReplyButtons,
                routePicks,
                triggers.triggerKeys,
                triggers.defaultTriggerKey
              )
            }
          : {})
      });
      const broadcastId = created.data.broadcast._id;
      setBroadcastRetryPreference(broadcastId, retryOnLimit);
      if (mode === "draft") return { broadcastId, started: false, message: "" };
      try {
        const started = await startBroadcast({
          broadcastId,
          payload:
            schedule.mode === "schedule"
              ? { scheduledLocal: buildScheduledLocal(schedule), timezone }
              : {}
        });
        return { broadcastId, started: true, message: started.message };
      } catch (startError) {
        // The draft exists; land on it so it can be started from there.
        toast.error(
          errorMessage(startError, "The draft was saved but couldn't start.")
        );
        return { broadcastId, started: false, message: "" };
      }
    },
    meta: { showToast: false },
    onSuccess: async ({ broadcastId, started, message }) => {
      if (started) toast.success(message || "Broadcast started.");
      else toast.success("Saved as a draft.");
      await queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      onCreated(broadcastId);
    },
    onError: (failure) => {
      const message = errorMessage(
        failure,
        (failure as Error).message || "Couldn't create the broadcast."
      );
      // Variable problems belong on the Personalise step.
      if (/value|variable|needs/i.test(message) && needsPersonalise) {
        setPersonaliseError(message);
        setShowMissing(true);
        setStep(2);
      } else {
        setSubmitError(message);
      }
    }
  });

  // A paused workspace can't create broadcasts, not even drafts (403).
  const isPaused = useWorkspacePaused();
  const canSubmit =
    !isPaused && [0, 1, 2, 3].every((index) => !stepProblem(index));

  // ---------- render helpers ----------
  const preview = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        {template && slots.length > 0 && previewContacts.length > 0 && (
          <Select value={previewContactId} onValueChange={setPreviewContactId}>
            <SelectTrigger className="h-8 w-auto max-w-48 gap-1 bg-white text-xs">
              <span className="text-muted-foreground">Preview for:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SAMPLE_CONTACT}>Sample values</SelectItem>
              {previewContacts.map((contact) => (
                <SelectItem key={contact._id} value={contact._id}>
                  {contactName(contact)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {template ? (
        <WhatsAppPreview
          components={template.components}
          variableValues={previewValues}
        />
      ) : (
        <div className="rounded-lg bg-[#efeae2] p-10 text-center text-sm text-slate-500">
          Pick a template to see the message.
        </div>
      )}
    </div>
  );

  const reviewRow = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{value}</dd>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:rounded-none">
        <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 text-left">
          <DialogTitle>
            {duplicateFrom ? "Duplicate broadcast" : "New broadcast"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose a message, an audience and when to send.
          </DialogDescription>
          <ol className="mt-3 flex gap-1.5 overflow-x-auto">
            {STEPS.map((label, index) => {
              const isSkipped = index === 2 && !needsPersonalise;
              const isDone = index < step && !isSkipped;
              const reachable = index < step;
              return (
                <li key={label} className="shrink-0">
                  <button
                    type="button"
                    disabled={!reachable || isSkipped}
                    onClick={() => setStep(index)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                      index === step
                        ? "bg-primary text-primary-foreground"
                        : isDone
                          ? "cursor-pointer bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      isSkipped && "line-through opacity-60"
                    )}
                  >
                    <span className="flex size-4 items-center justify-center rounded-full bg-white/25">
                      {isDone ? <Check className="size-3" /> : index + 1}
                    </span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
          <div className="min-w-0 space-y-5 p-5 lg:overflow-y-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full lg:hidden"
              onClick={() => setIsPreviewOpen((current) => !current)}
            >
              <Eye className="size-4" />
              {isPreviewOpen ? "Hide preview" : "Preview"}
            </Button>
            {isPreviewOpen && <div className="lg:hidden">{preview}</div>}

            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="broadcast-name">Name</Label>
                  <Input
                    id="broadcast-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setIsNameEdited(true);
                    }}
                    placeholder="July product update"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sender</Label>
                  <BroadcastSenderSelect
                    numbers={senders}
                    value={senderId}
                    onValueChange={(value) => {
                      setSenderId(value);
                      setRoutePicks({});
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <TemplatePickerList
                    templates={templates}
                    selectedId={templateId}
                    isLoading={isTemplatesLoading}
                    onSelect={(picked) => setTemplateId(picked.templateId)}
                    emptyText="No approved templates yet. Create one and wait for Meta's approval."
                  />
                  {template?.category?.toUpperCase() === "UTILITY" && (
                    <p className="flex gap-1.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      Utility messages aren&apos;t capped by Meta&apos;s
                      marketing limit.
                    </p>
                  )}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <AudiencePicker
                  audience={audience}
                  onChange={setAudience}
                  sources={audienceSources}
                />

                <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-5" />
                  </span>
                  <div className="space-y-0.5 text-sm">
                    <p>
                      {!isAudienceReady ? (
                        <span className="text-muted-foreground">
                          Choose who receives this.
                        </span>
                      ) : audienceCount === undefined ? (
                        "Counting contacts…"
                      ) : (
                        <>
                          <span className="font-heading text-lg font-semibold">
                            {formatCount(audienceCount)}
                          </span>{" "}
                          contact{audienceCount === 1 ? "" : "s"} will receive
                          this
                          {isCounting && (
                            <span className="text-muted-foreground">
                              {" "}
                              (updating…)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Only opted-in contacts are included.
                      {isMarketing &&
                        " Contacts who turned off your marketing in WhatsApp are skipped automatically."}
                    </p>
                  </div>
                </div>

                {audienceWarnings.map((warning) => (
                  <div
                    key={warning}
                    className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {warning}
                  </div>
                ))}
              </>
            )}

            {step === 2 && (
              <>
                {personaliseError && (
                  <p
                    role="alert"
                    className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {personaliseError}
                  </p>
                )}
                {slots.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Variables</h3>
                    <VariableMappingRows
                      slots={slots}
                      mappings={mappings}
                      showMissing={showMissing}
                      onChange={(slotId, mapping) => {
                        setMappings((current) => ({
                          ...current,
                          [slotId]: mapping
                        }));
                        setPersonaliseError("");
                      }}
                    />
                  </section>
                )}
                {quickReplyButtons.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      Quick-reply routing
                    </h3>
                    <QuickReplyRouting
                      buttons={quickReplyButtons}
                      picks={routePicks}
                      onChange={(index, triggerKey) =>
                        setRoutePicks((current) => ({
                          ...current,
                          [index]: triggerKey
                        }))
                      }
                      triggers={triggers}
                      senderLabel={senderLabel}
                      flowName={flowName}
                    />
                  </section>
                )}
              </>
            )}

            {step === 3 && template && (
              <>
                <dl className="divide-y rounded-lg border bg-white px-4">
                  {reviewRow("Template", template.name)}
                  {reviewRow("Sender", senderLabel || "-")}
                  {reviewRow(
                    "Audience",
                    <>
                      {typeof audienceCount === "number"
                        ? `${formatCount(audienceCount)} contacts`
                        : "-"}{" "}
                      <span className="text-muted-foreground">
                        ({describeAudience(audience)})
                      </span>
                    </>
                  )}
                  {slots.length > 0 &&
                    reviewRow(
                      "Variables",
                      <ul className="space-y-0.5">
                        {slots.map((slot) => (
                          <li key={slot.id}>
                            <span className="font-mono text-xs text-muted-foreground">
                              {slot.label}
                            </span>{" "}
                            →{" "}
                            {
                              resolveSlotValue(
                                slot,
                                mappings[slot.id],
                                firstContact
                              ).text
                            }
                          </li>
                        ))}
                        {firstContact && (
                          <li className="text-xs text-muted-foreground">
                            Example for {contactName(firstContact)}
                          </li>
                        )}
                      </ul>
                    )}
                  {quickReplyButtons.length > 0 &&
                    reviewRow(
                      "Quick replies",
                      <ul className="space-y-0.5">
                        {resolveQuickReplyRoutes(
                          quickReplyButtons,
                          routePicks,
                          triggers.triggerKeys,
                          triggers.defaultTriggerKey
                        ).map((route) => (
                          <li key={route.index}>
                            {route.label} →{" "}
                            {route.triggerKey === triggers.defaultTriggerKey
                              ? "Main menu"
                              : triggers.blockTriggers.find(
                                  (trigger) =>
                                    trigger.triggerKey === route.triggerKey
                                )?.name || "Main menu"}
                          </li>
                        ))}
                      </ul>
                    )}
                </dl>

                <section className="space-y-3 rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold">Delivery options</h3>
                  <label className="flex items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-medium">
                        Retry after a Meta messaging-limit pause
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        If Meta pauses this at your daily limit, unfinished
                        contacts are retried once it resets.
                      </span>
                    </span>
                    <Switch
                      checked={retryOnLimit}
                      onCheckedChange={setRetryOnLimit}
                    />
                  </label>
                  {isMarketing && (
                    <label className="flex items-start justify-between gap-4">
                      <span>
                        <span className="block text-sm font-medium">
                          Retry contacts limited by Meta
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Meta limits marketing per person; each limited contact
                          is retried once after 24 hours.
                        </span>
                      </span>
                      <Switch
                        checked={retryOnEngagement}
                        onCheckedChange={setRetryOnEngagement}
                      />
                    </label>
                  )}
                </section>

                <section className="space-y-3 rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold">When</h3>
                  <ScheduleFields
                    value={schedule}
                    onChange={setSchedule}
                    timezone={timezone}
                  />
                </section>

                {submitError && (
                  <p
                    role="alert"
                    className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {submitError}
                  </p>
                )}
              </>
            )}
          </div>

          <aside className="hidden border-l bg-muted/30 p-5 lg:block lg:overflow-y-auto">
            {preview}
          </aside>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-white px-5 py-3">
          <Button
            variant="ghost"
            onClick={step === 0 ? () => onOpenChange(false) : goBack}
          >
            {step === 0 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft className="size-4" />
                Back
              </>
            )}
          </Button>
          <div className="flex items-center gap-2">
            {stepProblem(step) && step < 3 && (
              <span className="hidden text-xs text-muted-foreground sm:block">
                {stepProblem(step)}
              </span>
            )}
            {step < 3 ? (
              <Button
                onClick={goNext}
                disabled={Boolean(stepProblem(step)) && step !== 2}
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={!canSubmit || isSubmitting}
                  onClick={() => {
                    setSubmitError("");
                    submit("draft");
                  }}
                >
                  Save as draft
                </Button>
                <Button
                  disabled={!canSubmit}
                  isLoading={isSubmitting}
                  onClick={() => {
                    setSubmitError("");
                    submit("send");
                  }}
                >
                  {schedule.mode === "schedule" ? "Schedule" : "Send now"}
                </Button>
              </>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
