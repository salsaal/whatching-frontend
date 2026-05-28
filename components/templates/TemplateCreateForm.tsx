"use client";

import {
  ArrowLeft,
  FilePlus2,
  LinkIcon,
  Phone,
  Plus,
  Reply,
  Trash2,
  Variable
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createDraftTemplate,
  createTemplate,
  submitDraftTemplate,
  updateDraftTemplate
} from "@/api/functions/templates";
import { MediaAsset } from "@/api/types/media.type";
import {
  CreateTemplatePayload,
  MessageTemplate,
  TemplateButton,
  TemplateButtonType,
  TemplateCategory,
  TemplateCreationType,
  TemplateHeaderFormat
} from "@/api/types/templates.type";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTemplateStore } from "@/stores/templateStore";
import TemplatePreview from "./TemplatePreview";
import {
  applyVariableExamples,
  buildButtonsComponent,
  extractVariables,
  getBodyComponent,
  getButtonsComponent,
  getFooterComponent,
  getHeaderComponent,
  getTemplateType,
  mapDraftToTemplate
} from "./templateUtils";

type HeaderFormatOption = "NONE" | TemplateHeaderFormat;
type ActionMode = "NONE" | "CTA" | "QUICK_REPLY" | "ALL";

const MAX_TOTAL_BUTTONS = 10;
const MAX_URL_BUTTONS = 2;
const MAX_PHONE_BUTTONS = 1;

const categories: TemplateCategory[] = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION"
];

const languages = [
  { label: "English", value: "en" },
  { label: "English (US)", value: "en_US" },
  { label: "Hindi", value: "hi" },
  { label: "Arabic", value: "ar" },
  { label: "Spanish", value: "es" }
];

const templateTypes: Array<{
  label: string;
  value: TemplateCreationType;
  description: string;
}> = [
  {
    label: "Text",
    value: "TEXT",
    description: "Body-only or body with a text header."
  },
  {
    label: "Image",
    value: "IMAGE",
    description: "Marketing template with an image header."
  },
  {
    label: "Video",
    value: "VIDEO",
    description: "Marketing template with a video header."
  },
  {
    label: "Document",
    value: "DOCUMENT",
    description: "Marketing template with a document header."
  },
  {
    label: "Location",
    value: "LOCATION",
    description: "Location header preview for place-based messages."
  },
  {
    label: "Limited-time offer",
    value: "LIMITED_TIME_OFFER",
    description: "Offer banner with optional expiration display."
  },
  {
    label: "Carousel",
    value: "CAROUSEL",
    description: "Media card carousel preview with repeated card structure."
  }
];

const headerFormats: HeaderFormatOption[] = [
  "NONE",
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "LOCATION"
];

const buttonTypeOptions: Array<{
  label: string;
  value: TemplateButtonType;
  icon: React.ElementType;
}> = [
  { label: "Website URL", value: "URL", icon: LinkIcon },
  { label: "Phone number", value: "PHONE_NUMBER", icon: Phone },
  { label: "Quick reply", value: "QUICK_REPLY", icon: Reply }
];

const sanitizeTemplateName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const createEmptyButton = (type: TemplateButtonType): TemplateButton => ({
  type,
  text: "",
  ...(type === "URL" ? { url: "" } : {}),
  ...(type === "PHONE_NUMBER" ? { phone_number: "" } : {})
});

const countButtons = (buttons: TemplateButton[]) => ({
  total: buttons.length,
  urls: buttons.filter((button) => button.type === "URL").length,
  phones: buttons.filter((button) => button.type === "PHONE_NUMBER").length,
  quickReplies: buttons.filter((button) => button.type === "QUICK_REPLY").length
});

const getHeaderFormatForTemplateType = (
  templateType: TemplateCreationType,
  currentHeaderFormat: HeaderFormatOption
): HeaderFormatOption => {
  if (["IMAGE", "VIDEO", "DOCUMENT", "LOCATION"].includes(templateType)) {
    return templateType as TemplateHeaderFormat;
  }

  if (templateType === "TEXT") {
    return currentHeaderFormat === "TEXT" ? "TEXT" : "NONE";
  }

  return "NONE";
};

interface TemplateCreateFormProps {
  initialTemplate?: MessageTemplate | null;
  editKind?: "draft" | "meta";
}

function FieldBlock({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-xs">
      <div className="mb-4">
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function TemplateCreateForm({
  initialTemplate,
  editKind
}: TemplateCreateFormProps) {
  const router = useRouter();
  const { addTemplate, upsertTemplate } = useTemplateStore();
  const [category, setCategory] = useQueryState(
    "category",
    parseAsString.withDefault("MARKETING")
  );
  const [language, setLanguage] = useQueryState(
    "language",
    parseAsString.withDefault("en_US")
  );
  const [name, setName] = useState("");
  const [templateType, setTemplateType] =
    useState<TemplateCreationType>("TEXT");
  const [headerFormat, setHeaderFormat] = useState<HeaderFormatOption>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerExampleUrl, setHeaderExampleUrl] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedMediaName, setSelectedMediaName] = useState("");
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [offerText, setOfferText] = useState("Limited-time offer");
  const [carouselCardCount, setCarouselCardCount] = useState(2);
  const [bodyText, setBodyText] = useState(
    "Hi {{1}}, thanks for connecting with us. We have an update for you."
  );
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({
    "1": "John"
  });
  const [footerText, setFooterText] = useState("");
  const [actionMode, setActionMode] = useState<ActionMode>("NONE");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  const variables = useMemo(() => extractVariables(bodyText), [bodyText]);
  const previewBody = useMemo(
    () => applyVariableExamples(bodyText, bodyExamples),
    [bodyExamples, bodyText]
  );

  const visibleButtons = useMemo(() => {
    if (actionMode === "NONE") return [];
    if (actionMode === "CTA") {
      return buttons.filter(
        (button) => button.type === "URL" || button.type === "PHONE_NUMBER"
      );
    }
    if (actionMode === "QUICK_REPLY") {
      return buttons.filter((button) => button.type === "QUICK_REPLY");
    }
    return buttons;
  }, [actionMode, buttons]);
  const visibleButtonEntries = useMemo(
    () =>
      buttons
        .map((button, index) => ({ button, index }))
        .filter(({ button }) => visibleButtons.includes(button)),
    [buttons, visibleButtons]
  );
  const buttonCounts = useMemo(() => countButtons(buttons), [buttons]);
  const totalButtonsLeft = MAX_TOTAL_BUTTONS - buttonCounts.total;
  const urlButtonsLeft = MAX_URL_BUTTONS - buttonCounts.urls;
  const phoneButtonsLeft = MAX_PHONE_BUTTONS - buttonCounts.phones;
  const quickReplyButtonsLeft = totalButtonsLeft;
  const supportsFooter =
    templateType !== "LOCATION" && templateType !== "CAROUSEL";
  const supportsHeaderSelector =
    templateType === "TEXT" || templateType === "LIMITED_TIME_OFFER";
  const isEditing = Boolean(initialTemplate);
  const isDraftEdit = editKind === "draft";
  const isPendingEdit =
    initialTemplate?.status?.toUpperCase() === "PENDING" ||
    initialTemplate?.status?.toLowerCase() === "pending_review";
  const canEditFields = !isPendingEdit;
  const pageTitle = isEditing ? "Edit template" : "Create template";

  useEffect(() => {
    if (!initialTemplate) return;

    const header = getHeaderComponent(initialTemplate.components);
    const body = getBodyComponent(initialTemplate.components);
    const footer = getFooterComponent(initialTemplate.components);
    const buttonsComponent = getButtonsComponent(initialTemplate.components);
    const inferredType = getTemplateType(
      initialTemplate
    ) as TemplateCreationType;
    const bodyTextValue = body?.text || "";

    setName(initialTemplate.name);
    setCategory(initialTemplate.category);
    setLanguage(initialTemplate.language);
    setTemplateType(inferredType);
    setHeaderFormat(header?.format || "NONE");
    setHeaderText(header?.text || "");
    setHeaderExampleUrl(header?.example?.header_handle?.[0] || "");
    setSelectedMediaId(header?.mediaId || initialTemplate.defaultMediaId || "");
    setSelectedMediaName(
      header?.mediaId || initialTemplate.defaultMediaId ? "Linked media" : ""
    );
    setBodyText(bodyTextValue);
    setFooterText(footer?.text || "");
    setButtons(buttonsComponent?.buttons || []);
    setActionMode(buttonsComponent?.buttons?.length ? "ALL" : "NONE");

    const examples = body?.example?.body_text;
    const sampleValues = Array.isArray(examples?.[0])
      ? examples?.[0]
      : examples;
    const nextExamples: Record<string, string> = {};
    extractVariables(bodyTextValue).forEach((variable, index) => {
      nextExamples[variable] = String(sampleValues?.[index] || "");
    });
    setBodyExamples(nextExamples);
  }, [initialTemplate, setCategory, setLanguage]);

  const { mutate, isPending } = useMutation({
    mutationFn: createTemplate,
    onSuccess: (data) => {
      addTemplate(data.data.template);
      toast.success("Template submitted for review");
      router.push("/templates");
    }
  });

  const { mutate: saveDraft, isPending: isSavingDraft } = useMutation({
    mutationFn: createDraftTemplate,
    onSuccess: (data) => {
      upsertTemplate(mapDraftToTemplate(data.data.draft));
      toast.success("Template saved as draft");
      router.push("/templates");
    }
  });

  const { mutate: patchDraft, isPending: isPatchingDraft } = useMutation({
    mutationFn: updateDraftTemplate,
    onSuccess: (data) => {
      upsertTemplate(mapDraftToTemplate(data.data.draft));
      toast.success("Draft saved");
    }
  });

  const { mutate: submitDraft, isPending: isSubmittingDraft } = useMutation({
    mutationFn: submitDraftTemplate,
    onSuccess: (data) => {
      if (data.data.template) {
        upsertTemplate(data.data.template);
      }
      upsertTemplate(mapDraftToTemplate(data.data.draft));
      toast.success("Draft submitted for review");
      router.push("/templates");
    }
  });

  const addVariable = () => {
    const next = variables.length + 1;
    const key = String(next);

    setBodyText((value) => `${value} {{${key}}}`);
    setBodyExamples((value) => ({ ...value, [key]: "" }));
  };

  const addButton = (type: TemplateButtonType) => {
    const counts = countButtons(buttons);

    // Meta allows up to 10 total template buttons. If more than 3 are used,
    // WhatsApp collapses the extra buttons behind "See all options".
    if (counts.total >= MAX_TOTAL_BUTTONS) {
      toast.error("You can add up to 10 buttons in total");
      return;
    }

    // Meta button type limits: max 2 URL buttons and max 1 phone button.
    if (type === "URL" && counts.urls >= MAX_URL_BUTTONS) {
      toast.error("You can add up to 2 website buttons");
      return;
    }

    if (type === "PHONE_NUMBER" && counts.phones >= MAX_PHONE_BUTTONS) {
      toast.error("You can add only 1 phone number button");
      return;
    }

    setButtons((value) => [...value, createEmptyButton(type)]);
  };

  const updateButton = (
    index: number,
    field: keyof TemplateButton,
    value: string
  ) => {
    setButtons((current) =>
      current.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, [field]: value } : button
      )
    );
  };

  const updateButtonType = (index: number, type: TemplateButtonType) => {
    const nextButtons = buttons.map((button, buttonIndex) =>
      buttonIndex === index ? createEmptyButton(type) : button
    );
    const nextCounts = countButtons(nextButtons);

    if (nextCounts.total > MAX_TOTAL_BUTTONS) {
      toast.error("You can add up to 10 buttons in total");
      return;
    }

    if (nextCounts.urls > MAX_URL_BUTTONS) {
      toast.error("You can add up to 2 website buttons");
      return;
    }

    if (nextCounts.phones > MAX_PHONE_BUTTONS) {
      toast.error("You can add only 1 phone number button");
      return;
    }

    setButtons(nextButtons);
  };

  const removeButton = (index: number) => {
    setButtons((current) =>
      current.filter((_button, buttonIndex) => buttonIndex !== index)
    );
  };

  const buildPayload = (): CreateTemplatePayload | null => {
    const cleanName = sanitizeTemplateName(name);

    if (!cleanName) {
      toast.error("Template name is required");
      return null;
    }

    if (!bodyText.trim()) {
      toast.error("Template body is required");
      return null;
    }

    const buttonLabels = visibleButtons
      .map((button) => button.text.trim().toLowerCase())
      .filter(Boolean);
    const hasDuplicateLabels =
      new Set(buttonLabels).size !== buttonLabels.length;

    if (hasDuplicateLabels) {
      toast.error("Button labels must be unique");
      return null;
    }

    if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) &&
      !selectedMediaId
    ) {
      toast.error("Select media for this template header");
      return null;
    }

    const components = [];

    if (templateType === "LIMITED_TIME_OFFER") {
      components.push({
        type: "LIMITED_TIME_OFFER" as const,
        limited_time_offer: {
          text: offerText.trim() || "Limited-time offer",
          has_expiration: true
        }
      });
    }

    if (templateType === "CAROUSEL") {
      // The backend receives a simplified carousel component. Each card follows
      // Meta's carousel model: consistent media card format and repeated buttons.
      components.push({
        type: "CAROUSEL" as const,
        cards: Array.from({ length: carouselCardCount }).map(() => ({
          components: [
            {
              type: "HEADER" as const,
              format: "IMAGE" as const
            },
            {
              type: "BODY" as const,
              text: "Carousel card body"
            }
          ]
        }))
      });
    }

    if (headerFormat !== "NONE" && templateType !== "CAROUSEL") {
      components.push({
        type: "HEADER" as const,
        format: headerFormat,
        ...(headerFormat === "TEXT"
          ? { text: headerText.trim() }
          : ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)
            ? { mediaId: selectedMediaId }
            : headerExampleUrl.trim()
              ? { example: { header_handle: [headerExampleUrl.trim()] } }
              : {})
      });
    }

    components.push({
      type: "BODY" as const,
      text: bodyText.trim(),
      ...(variables.length
        ? {
            example: {
              body_text: [variables.map((key) => bodyExamples[key] || "Sample")]
            }
          }
        : {})
    });

    if (supportsFooter && footerText.trim()) {
      components.push({
        type: "FOOTER" as const,
        text: footerText.trim()
      });
    }

    const buttonsComponent = buildButtonsComponent(
      visibleButtons
        .filter((button) => button.text.trim())
        .map((button) => ({
          ...button,
          text: button.text.trim(),
          ...(button.type === "URL" ? { url: button.url?.trim() } : {}),
          ...(button.type === "PHONE_NUMBER"
            ? { phone_number: button.phone_number?.trim() }
            : {})
        }))
    );

    if (buttonsComponent) {
      components.push(buttonsComponent);
    }

    return {
      name: cleanName,
      language,
      category: category as TemplateCategory,
      allowCategoryChange: true,
      components
    };
  };

  const handleSaveDraft = () => {
    const payload = buildPayload();
    if (!payload) return;

    if (isDraftEdit && initialTemplate?.draftId) {
      patchDraft({
        draftId: initialTemplate.draftId,
        payload: {
          name: payload.name,
          components: payload.components
        }
      });
      return;
    }

    saveDraft(payload);
  };

  const handleSubmitForReview = () => {
    if (isEditing && !isDraftEdit) {
      toast.info("Template update API is not connected yet");
      return;
    }

    const payload = buildPayload();
    if (!payload) return;

    if (isDraftEdit && initialTemplate?.draftId) {
      patchDraft(
        {
          draftId: initialTemplate.draftId,
          payload: {
            name: payload.name,
            components: payload.components
          }
        },
        {
          onSuccess: () => submitDraft(initialTemplate.draftId as string)
        }
      );
      return;
    }

    mutate(payload);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmitForReview();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 xl:grid-cols-[1fr_380px]"
    >
      <div className="space-y-5">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Button variant="ghost" asChild className="-ml-3 mb-2">
                <Link href="/templates">
                  <ArrowLeft className="size-4" />
                  Back
                </Link>
              </Button>
              <p className="text-sm font-medium text-primary">Templates</p>
              <h1 className="mt-1 font-heading text-3xl font-semibold">
                {pageTitle}
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {!isEditing || isDraftEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  isLoading={isSavingDraft || isPatchingDraft}
                  disabled={!canEditFields}
                  onClick={handleSaveDraft}
                >
                  Save as draft
                </Button>
              ) : null}
              <Button
                type="submit"
                isLoading={isPending || isSubmittingDraft || isPatchingDraft}
                disabled={!canEditFields}
              >
                <FilePlus2 className="size-4" />
                {isEditing && !isDraftEdit ? "Save changes" : "Send for review"}
              </Button>
            </div>
          </div>
        </section>

        {isPendingEdit && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 shadow-xs">
            Pending templates cannot be edited while Meta is reviewing them.
          </div>
        )}

        <FieldBlock
          title="Template Basics"
          description="Name, category, and language are submitted to Meta for review."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label>Template category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value)}
                disabled={isEditing}
              >
                <SelectTrigger className="mt-2 h-11 w-full border-0 bg-muted/70 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Template language</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value)}
                disabled={!canEditFields}
              >
                <SelectTrigger className="mt-2 h-11 w-full border-0 bg-muted/70 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label>Template name</Label>
            <Input
              value={name}
              onChange={(event) =>
                setName(sanitizeTemplateName(event.target.value))
              }
              disabled={!canEditFields}
              placeholder="seasonal_promo_blast"
              className="mt-2 h-11 border-0 bg-muted/70 shadow-none"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Use lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div className="mt-4">
            <Label>Template type</Label>
            <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templateTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    if (isEditing) return;
                    setTemplateType(item.value);
                    setHeaderFormat(
                      getHeaderFormatForTemplateType(item.value, headerFormat)
                    );
                    if (
                      item.value === "LOCATION" ||
                      item.value === "CAROUSEL"
                    ) {
                      setFooterText("");
                    }
                    if (!["IMAGE", "VIDEO", "DOCUMENT"].includes(item.value)) {
                      setSelectedMediaId("");
                      setSelectedMediaName("");
                    }
                  }}
                  className={cn(
                    "rounded-sm bg-muted/60 p-3 text-left transition hover:bg-accent",
                    templateType === item.value &&
                      "bg-primary/10 text-primary shadow-xs",
                    isEditing && "cursor-not-allowed opacity-70"
                  )}
                >
                  <span className="font-heading text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 rounded-sm bg-muted/60 p-3 text-xs text-muted-foreground">
            Category changes are allowed automatically when submitting so Meta
            can classify the template correctly during review.
          </p>
        </FieldBlock>

        <FieldBlock
          title="Template Header"
          description="Add an optional text or media header."
        >
          {supportsHeaderSelector ? (
            <Select
              value={headerFormat}
              onValueChange={(value) =>
                setHeaderFormat(value as HeaderFormatOption)
              }
              disabled={!canEditFields}
            >
              <SelectTrigger className="h-11 w-full border-0 bg-muted/70 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {headerFormats
                  .filter((format) =>
                    templateType === "TEXT"
                      ? format === "NONE" || format === "TEXT"
                      : format !== "LOCATION"
                  )
                  .map((format) => (
                    <SelectItem key={format} value={format}>
                      {format === "NONE" ? "No header" : format}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-sm bg-muted/60 p-3 text-sm text-muted-foreground">
              Header format is controlled by the selected template type:{" "}
              <span className="font-semibold text-foreground">
                {templateType}
              </span>
              .
            </div>
          )}

          {headerFormat === "TEXT" && (
            <Input
              value={headerText}
              onChange={(event) => setHeaderText(event.target.value)}
              disabled={!canEditFields}
              placeholder="Mega Sale!"
              maxLength={60}
              className="mt-4 h-11 border-0 bg-muted/70 shadow-none"
            />
          )}

          {headerFormat !== "NONE" && headerFormat !== "TEXT" && (
            <div className="mt-4 rounded-sm border p-3">
              {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedMediaName || "No media selected"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select media from your organisation media library.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canEditFields}
                    onClick={() => setIsMediaPickerOpen(true)}
                  >
                    Select media
                  </Button>
                </div>
              ) : (
                <Input
                  value={headerExampleUrl}
                  onChange={(event) => setHeaderExampleUrl(event.target.value)}
                  disabled={!canEditFields}
                  placeholder="Paste sample media URL for review"
                  className="h-11 border-0 bg-muted/70 shadow-none"
                />
              )}
            </div>
          )}

          {templateType === "LIMITED_TIME_OFFER" && (
            <div className="mt-4">
              <div>
                <Label>Offer title</Label>
                <Input
                  value={offerText}
                  onChange={(event) => setOfferText(event.target.value)}
                  disabled={!canEditFields}
                  maxLength={60}
                  placeholder="Limited-time offer"
                  className="mt-2 h-11 border-0 bg-muted/70 shadow-none"
                />
              </div>
            </div>
          )}

          {templateType === "CAROUSEL" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="rounded-sm bg-muted/60 p-3 text-sm text-muted-foreground">
                Carousel cards use a consistent media card format. This builder
                previews the card count and submits a simplified carousel
                component for your API.
              </div>
              <div>
                <Label>Cards</Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={carouselCardCount}
                  onChange={(event) =>
                    setCarouselCardCount(
                      Math.max(2, Math.min(10, Number(event.target.value) || 2))
                    )
                  }
                  className="mt-2 h-11 border-0 bg-muted/70 shadow-none"
                />
              </div>
            </div>
          )}
        </FieldBlock>

        <FieldBlock
          title="Template Body"
          description="Use variables like {{1}} and provide sample values for review."
        >
          <Textarea
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            disabled={!canEditFields}
            maxLength={1024}
            className="min-h-40 resize-none border-0 bg-muted/70 shadow-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!canEditFields}
              onClick={addVariable}
            >
              <Variable className="size-4" />
              Add variable
            </Button>
            <span className="text-xs text-muted-foreground">
              {bodyText.length}/1024
            </span>
          </div>

          {variables.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {variables.map((key) => (
                <div key={key}>
                  <Label>Sample for {`{{${key}}}`}</Label>
                  <Input
                    value={bodyExamples[key] || ""}
                    onChange={(event) =>
                      setBodyExamples((value) => ({
                        ...value,
                        [key]: event.target.value
                      }))
                    }
                    disabled={!canEditFields}
                    placeholder="John"
                    className="mt-2 h-10 border-0 bg-muted/70 shadow-none"
                  />
                </div>
              ))}
            </div>
          )}
        </FieldBlock>

        {supportsFooter ? (
          <FieldBlock
            title="Template Footer"
            description="Optional footer text."
          >
            <Input
              value={footerText}
              onChange={(event) => setFooterText(event.target.value)}
              disabled={!canEditFields}
              maxLength={60}
              placeholder="Reply STOP to opt out"
              className="h-11 border-0 bg-muted/70 shadow-none"
            />
            <p className="mt-2 text-right text-xs text-muted-foreground">
              {footerText.length}/60
            </p>
          </FieldBlock>
        ) : (
          <FieldBlock
            title="Template Footer"
            description="Footer is disabled for this template type."
          >
            <div className="rounded-sm bg-muted/60 p-3 text-sm text-muted-foreground">
              {templateType} templates use a constrained Meta structure, so the
              footer is not shown for this type.
            </div>
          </FieldBlock>
        )}

        <FieldBlock
          title="Interactive Actions"
          description="Add call-to-actions and quick replies users can tap."
        >
          <RadioGroup
            value={actionMode}
            onValueChange={(value) => setActionMode(value as ActionMode)}
            disabled={isEditing || !canEditFields}
            className="grid gap-3 sm:grid-cols-4"
          >
            {[
              ["NONE", "None"],
              ["CTA", "Call to Actions"],
              ["QUICK_REPLY", "Quick Replies"],
              ["ALL", "All"]
            ].map(([value, label]) => (
              <Label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm bg-muted/60 p-3 text-sm",
                  actionMode === value && "bg-primary/10 text-primary"
                )}
              >
                <RadioGroupItem value={value} />
                {label}
              </Label>
            ))}
          </RadioGroup>

          {actionMode !== "NONE" && (
            <>
              <div className="mt-4 rounded-sm bg-primary/5 p-3 text-sm text-muted-foreground">
                Click a button type below to add it. You can add{" "}
                <span className="font-semibold text-foreground">
                  {totalButtonsLeft}
                </span>{" "}
                more button{totalButtonsLeft === 1 ? "" : "s"} total. Website
                left: {urlButtonsLeft}; phone left: {phoneButtonsLeft}; quick
                replies can use the remaining total slots. Button labels must be
                unique.
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {buttonTypeOptions
                  .filter((option) =>
                    actionMode === "CTA"
                      ? option.value !== "QUICK_REPLY"
                      : actionMode === "QUICK_REPLY"
                        ? option.value === "QUICK_REPLY"
                        : true
                  )
                  .map((option) => {
                    const Icon = option.icon;

                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant="outline"
                        disabled={
                          isEditing ||
                          !canEditFields ||
                          totalButtonsLeft <= 0 ||
                          (option.value === "URL" && urlButtonsLeft <= 0) ||
                          (option.value === "PHONE_NUMBER" &&
                            phoneButtonsLeft <= 0)
                        }
                        className="h-auto justify-start whitespace-normal py-3"
                        onClick={() => addButton(option.value)}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex flex-col items-start text-left">
                          <span>{option.label}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {option.value === "URL"
                              ? `${Math.max(urlButtonsLeft, 0)} left`
                              : option.value === "PHONE_NUMBER"
                                ? `${Math.max(phoneButtonsLeft, 0)} left`
                                : `${Math.max(quickReplyButtonsLeft, 0)} left`}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
              </div>

              <div className="mt-4 space-y-3">
                {visibleButtonEntries.map(({ button, index }) => (
                  <div
                    key={`${button.type}-${index}`}
                    className="grid gap-3 rounded-sm bg-muted/40 p-3 lg:grid-cols-[180px_1fr_1fr_auto]"
                  >
                    <Select
                      value={button.type}
                      onValueChange={(value) =>
                        updateButtonType(index, value as TemplateButtonType)
                      }
                      disabled={isEditing || !canEditFields}
                    >
                      <SelectTrigger className="h-10 w-full border-0 bg-white shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {buttonTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={button.text}
                      onChange={(event) =>
                        updateButton(index, "text", event.target.value)
                      }
                      disabled={isEditing || !canEditFields}
                      maxLength={25}
                      placeholder="Button title"
                      className={cn(
                        "h-10 border-0 bg-white shadow-none",
                        button.text &&
                          buttons.some(
                            (item, itemIndex) =>
                              itemIndex !== index &&
                              item.text.trim().toLowerCase() ===
                                button.text.trim().toLowerCase()
                          ) &&
                          "ring-2 ring-destructive/30"
                      )}
                    />

                    {button.type === "URL" && (
                      <Input
                        value={button.url || ""}
                        onChange={(event) =>
                          updateButton(index, "url", event.target.value)
                        }
                        disabled={isEditing || !canEditFields}
                        placeholder="https://whatching.com/sale"
                        className="h-10 border-0 bg-white shadow-none"
                      />
                    )}
                    {button.type === "PHONE_NUMBER" && (
                      <Input
                        value={button.phone_number || ""}
                        onChange={(event) =>
                          updateButton(
                            index,
                            "phone_number",
                            event.target.value
                          )
                        }
                        disabled={isEditing || !canEditFields}
                        placeholder="+918777019999"
                        className="h-10 border-0 bg-white shadow-none"
                      />
                    )}
                    {button.type === "QUICK_REPLY" && (
                      <div className="hidden lg:block" />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 text-muted-foreground hover:text-destructive"
                      onClick={() => removeButton(index)}
                      disabled={isEditing || !canEditFields}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </FieldBlock>
      </div>

      <aside>
        <div className="sticky top-24 space-y-5">
          <TemplatePreview
            templateType={templateType}
            headerFormat={headerFormat}
            headerText={headerText}
            bodyText={previewBody}
            footerText={supportsFooter ? footerText : ""}
            buttons={visibleButtons}
            offerText={offerText}
            carouselCardCount={carouselCardCount}
          />

          <div className="rounded-lg bg-white p-4 shadow-xs">
            <p className="font-heading text-sm font-semibold">Review payload</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Submit creates a Meta template with your selected type, variables,
              footer when supported, and buttons. Status will show as pending
              until Meta approves it.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-sm bg-muted/60 p-2">
                <p className="font-semibold">{buttonCounts.total}/10</p>
                <p className="text-muted-foreground">Buttons</p>
              </div>
              <div className="rounded-sm bg-muted/60 p-2">
                <p className="font-semibold">{buttonCounts.urls}/2</p>
                <p className="text-muted-foreground">URLs</p>
              </div>
              <div className="rounded-sm bg-muted/60 p-2">
                <p className="font-semibold">{buttonCounts.phones}/1</p>
                <p className="text-muted-foreground">Phone</p>
              </div>
            </div>
            {!isEditing || isDraftEdit ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                isLoading={isSavingDraft || isPatchingDraft}
                disabled={!canEditFields}
                onClick={handleSaveDraft}
              >
                Save as draft
              </Button>
            ) : null}
            <Button
              type="submit"
              className="mt-3 w-full"
              isLoading={isPending || isSubmittingDraft || isPatchingDraft}
              disabled={!canEditFields}
            >
              <Plus className="size-4" />
              {isEditing && !isDraftEdit ? "Save changes" : "Send for review"}
            </Button>
          </div>
        </div>
      </aside>

      <MediaPickerDialog
        open={isMediaPickerOpen}
        selectedMediaId={selectedMediaId}
        requiredType={headerFormat}
        onOpenChange={setIsMediaPickerOpen}
        onSelect={(media: MediaAsset) => {
          setSelectedMediaId(media._id);
          setSelectedMediaName(media.name);
          setIsMediaPickerOpen(false);
        }}
      />
    </form>
  );
}
