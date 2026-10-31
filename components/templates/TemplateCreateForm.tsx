"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  ImageIcon,
  MapPin,
  Moon,
  Sun,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseAsString, useQueryState } from "nuqs";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import {
  createDraftTemplate,
  createTemplate,
  getAllDraftTemplates,
  getAllTemplates,
  submitDraftTemplate,
  updateApprovedTemplate,
  updateDraftTemplate
} from "@/client-api/functions/templates";
import { getMediaById } from "@/client-api/functions/media";
import { MediaAsset } from "@/client-api/types/media.type";
import {
  CreateTemplatePayload,
  MessageTemplate,
  TemplateCategory,
  TemplateCreationType
} from "@/client-api/types/templates.type";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import LocationPickerDialog, {
  PickedLocation
} from "@/components/location/LocationPickerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { WhatsAppPreview } from "@/components/whatsapp/WhatsAppPreview";
import { formatFileSize, formatRelative } from "@/lib/displayFormat";
import { templateCategoryPresentation } from "@/lib/statusPresentation";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";
import { useTemplateStore } from "@/stores/templateStore";
import { BodyEditor } from "./editor/BodyEditor";
import { ButtonsEditor } from "./editor/ButtonsEditor";
import {
  CategoryCards,
  ReadOnlyField,
  Segmented
} from "./editor/EditorControls";
import {
  buildChecklist,
  ButtonDraft,
  buttonsFromTemplate,
  CarouselCardDraft,
  composeTemplateComponents,
  EditorSection,
  HeaderChoice,
  inferTemplateType,
  isValidTemplateName,
  MAX_CAROUSEL_CARD_BUTTONS,
  MAX_FOOTER,
  MAX_HEADER_TEXT,
  MEDIA_HEADERS,
  sanitizeTemplateName,
  variableKeys
} from "./editor/templateDraft";
import {
  getBodyComponent,
  getButtonsComponent,
  getFooterComponent,
  getHeaderComponent,
  groupTemplateButtons,
  mapDraftToTemplate
} from "./templateUtils";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";

const DEFAULT_FOOTER_TEXT = "Reply STOP to opt out";

type Format = "standard" | "carousel" | "lto";

// Meta rejects free-text footers for authentication templates and
// limited-time offers, and location/carousel templates have no footer slot.
const templateSupportsFooter = (
  templateType: TemplateCreationType,
  category: string
) =>
  category !== "AUTHENTICATION" &&
  templateType !== "LOCATION" &&
  templateType !== "CAROUSEL" &&
  templateType !== "LIMITED_TIME_OFFER";

const footerHiddenReason = (
  templateType: TemplateCreationType,
  category: string
) =>
  category === "AUTHENTICATION"
    ? "Meta doesn't allow a custom footer on authentication templates."
    : templateType === "LIMITED_TIME_OFFER"
      ? "Meta doesn't allow a custom footer on limited-time offers."
      : templateType === "CAROUSEL"
        ? "Carousel templates have no footer."
        : "Location templates have no footer.";

// These types are distinct Meta template structures, not just a different
// header -- an edit can't move a submitted template into or out of them.
const STRUCTURAL_TEMPLATE_TYPES: TemplateCreationType[] = [
  "CAROUSEL",
  "LIMITED_TIME_OFFER",
  "LOCATION"
];
const isStructuralTemplateType = (type: TemplateCreationType) =>
  STRUCTURAL_TEMPLATE_TYPES.includes(type);

const formatOf = (type: TemplateCreationType): Format =>
  type === "CAROUSEL"
    ? "carousel"
    : type === "LIMITED_TIME_OFFER"
      ? "lto"
      : "standard";

const typeLabels: Record<string, string> = {
  TEXT: "Text",
  IMAGE: "Image",
  VIDEO: "Video",
  DOCUMENT: "Document",
  LOCATION: "Location",
  LIMITED_TIME_OFFER: "Limited-time offer",
  CAROUSEL: "Carousel"
};

const languages = [
  { label: "English (US)", value: "en_US" },
  { label: "English", value: "en" },
  { label: "English (UK)", value: "en_GB" },
  { label: "Hindi", value: "hi" },
  { label: "Bengali", value: "bn" },
  { label: "Gujarati", value: "gu" },
  { label: "Kannada", value: "kn" },
  { label: "Malayalam", value: "ml" },
  { label: "Marathi", value: "mr" },
  { label: "Punjabi", value: "pa" },
  { label: "Tamil", value: "ta" },
  { label: "Telugu", value: "te" },
  { label: "Urdu", value: "ur" },
  { label: "Arabic", value: "ar" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Indonesian", value: "id" },
  { label: "Portuguese (BR)", value: "pt_BR" }
];
const languageLabel = (value: string) =>
  languages.find((item) => item.value === value)?.label || value;

const SECTIONS: Array<{ id: EditorSection; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "content", label: "Content" },
  { id: "buttons", label: "Buttons" },
  { id: "review", label: "Review" }
];

// Backend errors land next to the section they're about, as well as on top.
const sectionForError = (message: string): EditorSection | null => {
  if (/header|image|video|document|media|carousel/i.test(message))
    return "content";
  if (/button|url|phone|link/i.test(message)) return "buttons";
  if (/name|language|category/i.test(message)) return "basics";
  if (/body|variable|footer/i.test(message)) return "content";
  return null;
};

function Section({
  id,
  number,
  title,
  complete,
  error,
  children
}: {
  id: EditorSection;
  number: number;
  title: string;
  complete: boolean;
  error?: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <section
      id={`section-${id}`}
      className="scroll-mt-24 rounded-lg bg-white shadow-xs"
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center gap-3 p-5 text-left md:pointer-events-none"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            complete
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {complete ? <Check className="size-4" /> : number}
        </span>
        <h2 className="flex-1 font-heading text-lg font-semibold">{title}</h2>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition md:hidden",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div className={cn("space-y-5 px-5 pb-5", !isOpen && "hidden md:block")}>
        {error && (
          <p
            role="alert"
            className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

interface TemplateCreateFormProps {
  initialTemplate?: MessageTemplate | null;
  editKind?: "draft" | "meta";
  /** Prefill a new template from this one (Duplicate). */
  duplicateOf?: MessageTemplate | null;
}

export default function TemplateCreateForm({
  initialTemplate,
  editKind,
  duplicateOf
}: TemplateCreateFormProps) {
  const { can } = useCurrentMembership();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addTemplate, upsertTemplate, removeTemplate } = useTemplateStore();
  const activeOrgId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
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
  const [headerFormat, setHeaderFormat] = useState<HeaderChoice>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerSample, setHeaderSample] = useState("");
  const [headerExampleUrl, setHeaderExampleUrl] = useState("");
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(
    null
  );
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedMediaName, setSelectedMediaName] = useState("");
  const [selectedMediaUrl, setSelectedMediaUrl] = useState("");
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [carouselMediaIndex, setCarouselMediaIndex] = useState<number | null>(
    null
  );
  const [offerText, setOfferText] = useState("Limited-time offer");
  const [carouselCardCount, setCarouselCardCount] = useState(2);
  const [carouselCards, setCarouselCards] = useState<CarouselCardDraft[]>([
    { mediaId: "", mediaName: "", mediaUrl: "" },
    { mediaId: "", mediaName: "", mediaUrl: "" }
  ]);
  const [bodyText, setBodyText] = useState(
    "Hi {{1}}, thanks for connecting with us. We have an update for you."
  );
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({
    "1": "Priya"
  });
  const [footerText, setFooterText] = useState(DEFAULT_FOOTER_TEXT);
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [isTypeChangeConfirmOpen, setIsTypeChangeConfirmOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [wallpaper, setWallpaper] = useState<"light" | "dark">("light");
  const [formError, setFormError] = useState<{
    message: string;
    section: EditorSection | null;
  } | null>(null);
  const [submitted, setSubmitted] = useState<null | "review" | "edit">(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(
    editKind === "draft" ? initialTemplate?.updatedAt || null : null
  );

  const { data: selectedMediaData } = useQuery({
    queryKey: ["media", selectedMediaId],
    queryFn: () => getMediaById(selectedMediaId),
    enabled: Boolean(selectedMediaId) && can("media:view")
  });

  const supportsFooter = templateSupportsFooter(templateType, category);
  const format = formatOf(templateType);
  const isEditing = Boolean(initialTemplate);
  // What the template was when the page opened, to catch accidental type
  // changes (and keep its stored header when no new file is picked).
  const loadedTemplateType = initialTemplate
    ? inferTemplateType(initialTemplate)
    : null;
  // Only reusable while the type is unchanged: an image handle can't serve
  // as a video example.
  const existingHeaderHandle =
    loadedTemplateType &&
    loadedTemplateType === templateType &&
    MEDIA_HEADERS.includes(loadedTemplateType as HeaderChoice)
      ? headerExampleUrl.trim()
      : "";
  const isDraftEdit = editKind === "draft";
  // A draft was never submitted to Meta, so it's still freely editable in
  // every way. Only an already-submitted template is subject to Meta's
  // edit restrictions (name, language, category, structure).
  const isMetaTemplateEdit = isEditing && !isDraftEdit;
  // Meta only lets a submitted template change category once it's been
  // rejected or paused -- never while approved.
  const isCategoryEditableStatus = ["REJECTED", "PAUSED"].includes(
    (initialTemplate?.status || "").toUpperCase()
  );
  const isCategoryLocked = isMetaTemplateEdit && !isCategoryEditableStatus;
  const isPendingEdit =
    initialTemplate?.status?.toUpperCase() === "PENDING" ||
    initialTemplate?.status?.toLowerCase() === "pending_review";
  const canEditFields = !isPendingEdit;
  const templatesQueryKey = useMemo(
    () => ["templates", activeOrgId] as const,
    [activeOrgId]
  );
  const templateDraftsQueryKey = useMemo(
    () => ["template-drafts", activeOrgId] as const,
    [activeOrgId]
  );
  const refreshTemplateListCaches = useCallback(async () => {
    if (!activeOrgId) return;
    await Promise.all([
      queryClient.fetchQuery({
        queryKey: templatesQueryKey,
        queryFn: getAllTemplates
      }),
      queryClient.fetchQuery({
        queryKey: templateDraftsQueryKey,
        queryFn: getAllDraftTemplates
      })
    ]);
  }, [activeOrgId, queryClient, templateDraftsQueryKey, templatesQueryKey]);

  // Load an existing template (edit) or a source to copy (duplicate).
  const source = initialTemplate || duplicateOf || null;
  useEffect(() => {
    if (!source) return;
    const header = getHeaderComponent(source.components);
    const body = getBodyComponent(source.components);
    const footer = getFooterComponent(source.components);
    const carousel = source.components.find(
      (component) => component.type === "CAROUSEL"
    );
    const offer = source.components.find(
      (component) => component.type === "LIMITED_TIME_OFFER"
    );
    const inferredType = inferTemplateType(source);
    const bodyTextValue = body?.text || "";
    // Carousel buttons live on each card; take them from the first.
    const sourceButtons = carousel?.cards?.[0]
      ? getButtonsComponent(carousel.cards[0].components)?.buttons
      : getButtonsComponent(source.components)?.buttons;

    setName(
      duplicateOf && !initialTemplate ? `${source.name}_copy` : source.name
    );
    setCategory(source.category);
    setLanguage(source.language);
    setTemplateType(inferredType);
    setHeaderFormat(header?.format || "NONE");
    setHeaderText(header?.text || "");
    const headerTextSample = (
      header?.example as { header_text?: unknown } | undefined
    )?.header_text;
    setHeaderSample(
      Array.isArray(headerTextSample) ? String(headerTextSample[0] ?? "") : ""
    );
    setHeaderExampleUrl(header?.example?.header_handle?.[0] || "");
    setSelectedMediaId(header?.mediaId || source.defaultMediaId || "");
    setSelectedMediaName(
      header?.mediaId || source.defaultMediaId ? "Linked media" : ""
    );
    const headerHandle = header?.example?.header_handle?.[0] || "";
    setSelectedMediaUrl(/^https?:\/\//i.test(headerHandle) ? headerHandle : "");
    setBodyText(bodyTextValue);
    // Prefill the default footer when the type allows one, the same as a new
    // template. The user can still clear it before saving.
    setFooterText(
      footer?.text ||
        (templateSupportsFooter(inferredType, source.category)
          ? DEFAULT_FOOTER_TEXT
          : "")
    );
    setButtons(groupTemplateButtons(buttonsFromTemplate(sourceButtons || [])));
    if (offer?.limited_time_offer?.text)
      setOfferText(offer.limited_time_offer.text);
    if (carousel?.cards?.length) {
      setCarouselCardCount(carousel.cards.length);
      setCarouselCards(
        carousel.cards.map((card) => {
          const cardHeader = getHeaderComponent(card.components);
          return {
            mediaId: cardHeader?.mediaId || "",
            mediaName: cardHeader?.mediaId ? "Linked image" : "",
            mediaUrl: cardHeader?.example?.header_handle?.[0] || ""
          };
        })
      );
    }
    const examples = body?.example?.body_text;
    const sampleValues = Array.isArray(examples?.[0])
      ? examples?.[0]
      : examples;
    const nextExamples: Record<string, string> = {};
    variableKeys(bodyTextValue).forEach((variable, index) => {
      nextExamples[variable] = String(
        (sampleValues as unknown[] | undefined)?.[Number(variable) - 1] ??
          (sampleValues as unknown[] | undefined)?.[index] ??
          ""
      );
    });
    setBodyExamples(nextExamples);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    const media = selectedMediaData?.data.media;
    if (!media || media._id !== selectedMediaId) return;
    setSelectedMediaName(media.name);
    setSelectedMediaUrl(media.cloudinaryUrl);
  }, [selectedMediaData?.data.media, selectedMediaId]);

  useEffect(() => {
    setCarouselCards((current) =>
      Array.from({ length: carouselCardCount }).map(
        (_item, index) =>
          current[index] || { mediaId: "", mediaName: "", mediaUrl: "" }
      )
    );
  }, [carouselCardCount]);

  const handleMutationError = (
    error: AxiosError<{ message?: string }>,
    fallback: string
  ) => {
    const message = error.response?.data?.message || fallback;
    setFormError({ message, section: sectionForError(message) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { mutate, isPending } = useMutation({
    mutationFn: createTemplate,
    meta: { showToast: false },
    onSuccess: async (data) => {
      addTemplate(data.data.template);
      setSubmitted("review");
      await refreshTemplateListCaches();
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      handleMutationError(error, "Template could not be submitted.")
  });

  const { mutate: saveDraft, isPending: isSavingDraft } = useMutation({
    mutationFn: createDraftTemplate,
    meta: { showToast: false },
    onSuccess: async (data) => {
      upsertTemplate(mapDraftToTemplate(data.data.draft));
      toast.success("Draft saved.");
      await refreshTemplateListCaches();
      // Continue on the saved draft so later saves update it.
      router.replace({
        pathname: `/templates/${data.data.draft._id}`,
        query: { source: "draft" }
      });
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      handleMutationError(error, "Draft could not be saved.")
  });

  const { mutate: patchDraft, isPending: isPatchingDraft } = useMutation({
    mutationFn: updateDraftTemplate,
    meta: { showToast: false },
    onSuccess: (data) => {
      upsertTemplate(mapDraftToTemplate(data.data.draft));
      setDraftSavedAt(new Date().toISOString());
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      handleMutationError(error, "Draft could not be saved.")
  });

  const { mutate: submitDraft, isPending: isSubmittingDraft } = useMutation({
    mutationFn: submitDraftTemplate,
    meta: { showToast: false },
    onSuccess: async (data) => {
      if (data.data.template) {
        removeTemplate(data.data.draft._id);
        upsertTemplate({ ...data.data.template, source: "meta" as const });
      } else {
        upsertTemplate(mapDraftToTemplate(data.data.draft));
      }
      setSubmitted("review");
      await refreshTemplateListCaches();
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      handleMutationError(error, "Draft could not be submitted for review.")
  });

  const { mutate: patchApproved, isPending: isPatchingApproved } = useMutation({
    mutationFn: updateApprovedTemplate,
    meta: { showToast: false },
    onSuccess: async (data) => {
      upsertTemplate(data.data.template);
      setSubmitted("edit");
      await refreshTemplateListCaches();
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      handleMutationError(error, "Template edit could not be submitted.")
  });

  const editorState = {
    name: sanitizeTemplateName(name),
    templateType,
    headerFormat,
    headerText,
    headerSample,
    headerExampleUrl,
    selectedMediaId,
    existingHeaderHandle,
    offerText,
    carouselCards,
    bodyText,
    bodyExamples,
    footerText,
    supportsFooter,
    buttons
  };
  const checklist = buildChecklist(editorState);
  const missing = checklist.filter((item) => !item.ok);
  const sectionComplete = (section: EditorSection) =>
    section === "review"
      ? missing.length === 0
      : checklist
          .filter((item) => item.section === section)
          .every((item) => item.ok);
  const previewComponents = composeTemplateComponents(editorState, {
    forPreview: true
  });
  const previewValues: Record<string, string> = headerSample
    ? { "header:1": headerSample }
    : {};

  const buildPayload = (): CreateTemplatePayload | null => {
    if (missing.length) {
      setFormError({
        message: missing[0].problem || missing[0].label,
        section: missing[0].section
      });
      return null;
    }
    return {
      name: sanitizeTemplateName(name),
      language,
      category: category as TemplateCategory,
      allowCategoryChange: true,
      components: composeTemplateComponents(editorState)
    };
  };

  const handleSaveDraft = () => {
    setFormError(null);
    const payload = {
      name: sanitizeTemplateName(name),
      language,
      category: category as TemplateCategory,
      allowCategoryChange: true,
      components: composeTemplateComponents(editorState)
    };
    if (!payload.name) {
      setFormError({
        message: "Give the template a name before saving.",
        section: "basics"
      });
      return;
    }
    if (isDraftEdit && initialTemplate?.draftId) {
      patchDraft({
        draftId: initialTemplate.draftId,
        payload: { name: payload.name, components: payload.components }
      });
      return;
    }
    saveDraft(payload);
  };

  const handleSubmitForReview = (confirmedTypeChange = false) => {
    setFormError(null);
    const payload = buildPayload();
    if (!payload) return;

    if (
      isEditing &&
      !confirmedTypeChange &&
      loadedTemplateType &&
      loadedTemplateType !== templateType
    ) {
      setIsTypeChangeConfirmOpen(true);
      return;
    }

    if (isEditing && !isDraftEdit && initialTemplate?.templateId) {
      patchApproved({
        templateId: initialTemplate.templateId,
        payload: {
          components: payload.components,
          ...(category.toUpperCase() !==
          (initialTemplate.category || "").toUpperCase()
            ? { category: category as TemplateCategory }
            : {})
        }
      });
      return;
    }

    if (isDraftEdit && initialTemplate?.draftId) {
      patchDraft(
        {
          draftId: initialTemplate.draftId,
          payload: { name: payload.name, components: payload.components }
        },
        {
          onSuccess: () =>
            submitDraft({ draftId: initialTemplate.draftId as string })
        }
      );
      return;
    }

    mutate(payload);
  };

  // ---------- header / format changes ----------
  const clearMedia = () => {
    setSelectedMediaId("");
    setSelectedMediaName("");
    setSelectedMediaUrl("");
  };
  const restoreFooterIfAllowed = (nextType: TemplateCreationType) => {
    // Switching back to a type that allows a footer restores the default
    // for new templates rather than leaving a blank footer behind.
    if (
      !isEditing &&
      templateSupportsFooter(nextType, category) &&
      !footerText.trim()
    ) {
      setFooterText(DEFAULT_FOOTER_TEXT);
    }
  };
  const changeFormat = (next: Format) => {
    if (isMetaTemplateEdit) return;
    if (next === "carousel") {
      setTemplateType("CAROUSEL");
      setHeaderFormat("NONE");
      clearMedia();
      if (buttons.length > MAX_CAROUSEL_CARD_BUTTONS) {
        setButtons((current) => current.slice(0, MAX_CAROUSEL_CARD_BUTTONS));
        toast.info(
          "Carousel cards support up to 2 buttons, so the extra buttons were removed."
        );
      }
      setButtons((current) =>
        current.filter((button) => button.type !== "COPY_CODE")
      );
    } else if (next === "lto") {
      setTemplateType("LIMITED_TIME_OFFER");
      if (headerFormat === "LOCATION") setHeaderFormat("NONE");
    } else {
      const nextType: TemplateCreationType = [
        "IMAGE",
        "VIDEO",
        "DOCUMENT"
      ].includes(headerFormat)
        ? (headerFormat as TemplateCreationType)
        : "TEXT";
      setTemplateType(nextType);
      restoreFooterIfAllowed(nextType);
    }
  };
  const changeHeader = (next: HeaderChoice) => {
    if (format === "standard") {
      const nextType: TemplateCreationType =
        next === "NONE" || next === "TEXT"
          ? "TEXT"
          : (next as TemplateCreationType);
      // A submitted template can switch between Text/Image/Video/Document
      // headers, never into or out of Location.
      if (
        isMetaTemplateEdit &&
        (isStructuralTemplateType(templateType) ||
          isStructuralTemplateType(nextType))
      ) {
        return;
      }
      setTemplateType(nextType);
      restoreFooterIfAllowed(nextType);
    }
    setHeaderFormat(next);
    if (!MEDIA_HEADERS.includes(next)) clearMedia();
  };

  const baseHeaderOptions: Array<{
    value: HeaderChoice;
    label: string;
    disabled?: boolean;
  }> = [
    { value: "NONE", label: "None" },
    { value: "TEXT", label: "Text" },
    { value: "IMAGE", label: "Image" },
    { value: "VIDEO", label: "Video" },
    { value: "DOCUMENT", label: "Document" },
    ...(format === "standard"
      ? [
          {
            value: "LOCATION" as HeaderChoice,
            label: "Location",
            disabled: isMetaTemplateEdit && templateType !== "LOCATION"
          }
        ]
      : [])
  ];
  const headerOptions = baseHeaderOptions.map((option) =>
    isMetaTemplateEdit &&
    templateType === "LOCATION" &&
    option.value !== "LOCATION"
      ? { ...option, disabled: true }
      : option
  );

  const categoryOptions =
    category.toUpperCase() === "AUTHENTICATION"
      ? ["MARKETING", "UTILITY", "AUTHENTICATION"]
      : ["MARKETING", "UTILITY"];
  const nameIsValid = isValidTemplateName(sanitizeTemplateName(name));
  const isBusy =
    isPending || isSubmittingDraft || isPatchingDraft || isPatchingApproved;
  const sectionError = (section: EditorSection) =>
    formError?.section === section ? formError.message : undefined;

  const preview = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        <Segmented
          ariaLabel="Preview wallpaper"
          value={wallpaper}
          onChange={setWallpaper}
          options={[
            { value: "light", label: "", icon: Sun },
            { value: "dark", label: "", icon: Moon }
          ]}
          className="p-0.5 [&_button]:px-2 [&_button]:py-1"
        />
      </div>
      <WhatsAppPreview
        components={previewComponents}
        variableValues={previewValues}
        mediaUrl={selectedMediaUrl}
        mediaName={selectedMediaName}
        cardMediaUrls={carouselCards.map((card) => card.mediaUrl)}
        wallpaper={wallpaper}
      />
    </div>
  );

  const checklistCard = (
    <div className="rounded-lg bg-white p-4 shadow-xs">
      <p className="text-sm font-semibold">Before you send</p>
      <ul className="mt-2 space-y-1.5">
        {checklist.map((item) => (
          <li key={item.id}>
            <a
              href={`#section-${item.section}`}
              className="flex items-start gap-2 text-sm hover:underline"
            >
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <X className="mt-0.5 size-4 shrink-0 text-red-500" />
              )}
              <span className={cn(!item.ok && "text-foreground")}>
                {item.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-lg bg-white p-8 text-center shadow-xs">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </span>
        <h1 className="mt-4 font-heading text-2xl font-semibold">
          {submitted === "edit"
            ? "Changes sent to Meta"
            : "Sent to Meta for review"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Usually minutes to a few hours. It shows as In review on your
          templates list until Meta decides.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/templates">Back to templates</Link>
          </Button>
          <Button
            onClick={() =>
              router.push({
                pathname: "/templates/create",
                query: { fresh: Date.now() }
              })
            }
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  const submitLabel = isMetaTemplateEdit ? "Save changes" : "Send for review";
  const submitButton = (
    <Button
      type="submit"
      isLoading={isBusy}
      disabled={!canEditFields || missing.length > 0}
    >
      {submitLabel}
    </Button>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmitForReview();
      }}
      className="pb-24"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/templates"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Templates
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-semibold">
            {isEditing
              ? "Edit template"
              : duplicateOf
                ? "Duplicate template"
                : "Create template"}
          </h1>
        </div>
        <ol className="flex gap-1.5 overflow-x-auto">
          {SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#section-${section.id}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap",
                  sectionComplete(section.id)
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {sectionComplete(section.id) ? (
                  <Check className="size-3" />
                ) : (
                  `${index + 1}`
                )}
                {section.label}
              </a>
            </li>
          ))}
        </ol>
      </div>

      {formError && (
        <div
          role="alert"
          className="mb-4 flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">{formError.message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setFormError(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {isPendingEdit && (
        <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 shadow-xs">
          Templates can&apos;t be edited while Meta is reviewing them.
        </div>
      )}
      {isMetaTemplateEdit && !isPendingEdit && (
        <div className="mb-4 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground shadow-xs">
          {isCategoryEditableStatus
            ? "Name and language can't change after submission. Category, buttons, header, body and footer can be edited."
            : "Name, language and category can't change after submission. Buttons, header, body and footer can be edited."}{" "}
          Meta re-reviews every edit. Approved templates can be edited once
          every 24 hours.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,720px)_360px] lg:justify-center">
        <div className="min-w-0 space-y-4">
          <Section
            id="basics"
            number={1}
            title="Basics"
            complete={sectionComplete("basics")}
            error={sectionError("basics")}
          >
            {isCategoryLocked ? (
              <ReadOnlyField
                label="Category"
                value={templateCategoryPresentation(category).label}
              />
            ) : (
              <Field
                label="Category"
                hint="Meta may change the category during review."
              >
                <CategoryCards
                  value={category}
                  options={categoryOptions}
                  onChange={(value) => setCategory(value)}
                  disabled={!canEditFields}
                />
              </Field>
            )}

            {isMetaTemplateEdit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Template name"
                  value={<span className="font-mono">{name}</span>}
                />
                <ReadOnlyField
                  label="Language"
                  value={languageLabel(language)}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Template name"
                  hint={
                    <span className="flex items-center gap-1">
                      {nameIsValid && (
                        <Check className="size-3.5 text-emerald-600" />
                      )}
                      Lowercase letters, numbers and underscores.
                    </span>
                  }
                >
                  <Input
                    value={name}
                    onChange={(event) =>
                      setName(sanitizeTemplateName(event.target.value))
                    }
                    disabled={!canEditFields}
                    placeholder="summer_sale_2026"
                    aria-label="Template name"
                  />
                </Field>
                <Field label="Language">
                  <Combobox
                    value={language}
                    onChange={(value) => value && setLanguage(value)}
                    options={languages.map((item) => ({
                      ...item,
                      searchText: `${item.label} ${item.value}`
                    }))}
                    placeholder="Choose a language"
                    disabled={!canEditFields}
                    className="h-10"
                  />
                </Field>
              </div>
            )}

            <Field
              label="Format"
              hint={
                isMetaTemplateEdit
                  ? "The format can't change after submission."
                  : format === "carousel"
                    ? "Scrollable cards, each with an image and up to 2 buttons."
                    : format === "lto"
                      ? "Highlights an offer with an optional countdown."
                      : undefined
              }
            >
              <Segmented
                ariaLabel="Format"
                value={format}
                onChange={changeFormat}
                disabled={!canEditFields || isMetaTemplateEdit}
                options={[
                  { value: "standard", label: "Standard" },
                  { value: "carousel", label: "Carousel" },
                  { value: "lto", label: "Limited-time offer" }
                ]}
              />
            </Field>
          </Section>

          <Section
            id="content"
            number={2}
            title="Content"
            complete={sectionComplete("content")}
            error={sectionError("content")}
          >
            {format === "lto" && (
              <Field label="Offer title">
                <Input
                  value={offerText}
                  onChange={(event) => setOfferText(event.target.value)}
                  disabled={!canEditFields}
                  maxLength={16}
                  placeholder="Limited-time offer"
                />
              </Field>
            )}

            {format === "carousel" ? (
              <Field
                label="Cards"
                hint="Every card uses the body below and the same buttons."
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={carouselCardCount}
                    onChange={(event) =>
                      setCarouselCardCount(
                        Math.max(
                          2,
                          Math.min(10, Number(event.target.value) || 2)
                        )
                      )
                    }
                    className="w-24"
                    aria-label="Number of cards"
                  />
                  <span className="text-sm text-muted-foreground">cards</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {carouselCards.map((card, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border p-2"
                    >
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                        {card.mediaUrl ? (
                          <img
                            src={card.mediaUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Card {index + 1}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {card.mediaName || "No image yet"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canEditFields}
                        onClick={() => {
                          setCarouselMediaIndex(index);
                          setIsMediaPickerOpen(true);
                        }}
                      >
                        {card.mediaId ? "Change" : "Choose"}
                      </Button>
                    </div>
                  ))}
                </div>
              </Field>
            ) : (
              <Field label="Header">
                <Segmented
                  ariaLabel="Header"
                  value={headerFormat}
                  onChange={changeHeader}
                  options={headerOptions}
                  disabled={!canEditFields}
                />
                {headerFormat === "TEXT" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        value={headerText}
                        onChange={(event) => setHeaderText(event.target.value)}
                        disabled={!canEditFields}
                        maxLength={MAX_HEADER_TEXT}
                        placeholder="Your order is on its way"
                        aria-label="Header text"
                        className="pr-28"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-20 -translate-y-1/2 text-[11px] text-muted-foreground">
                        {headerText.length}/{MAX_HEADER_TEXT}
                      </span>
                      {!/{{\s*1\s*}}/.test(headerText) && (
                        <button
                          type="button"
                          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                          onClick={() =>
                            setHeaderText((current) =>
                              `${current}{{1}}`.slice(0, MAX_HEADER_TEXT)
                            )
                          }
                          disabled={!canEditFields}
                        >
                          + {"{{1}}"}
                        </button>
                      )}
                    </div>
                    {/{{\s*1\s*}}/.test(headerText) && (
                      <Input
                        value={headerSample}
                        onChange={(event) =>
                          setHeaderSample(event.target.value)
                        }
                        disabled={!canEditFields}
                        placeholder="Sample for {{1}}: Priya"
                        aria-label="Header sample"
                      />
                    )}
                  </div>
                )}
                {MEDIA_HEADERS.includes(headerFormat) && (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {selectedMediaUrl && headerFormat === "IMAGE" ? (
                        <img
                          src={selectedMediaUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {selectedMediaName ||
                          (existingHeaderHandle
                            ? "Current header"
                            : "Nothing chosen yet")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedMediaData?.data.media?.fileSize
                          ? formatFileSize(
                              selectedMediaData.data.media.fileSize
                            )
                          : headerFormat === "IMAGE"
                            ? "JPG or PNG"
                            : headerFormat === "VIDEO"
                              ? "MP4"
                              : "PDF"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canEditFields}
                        onClick={() => {
                          setCarouselMediaIndex(null);
                          setIsMediaPickerOpen(true);
                        }}
                      >
                        {selectedMediaId ? "Change" : "Choose"}
                      </Button>
                      {selectedMediaId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canEditFields}
                          onClick={clearMedia}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {headerFormat === "LOCATION" && (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <MapPin className="size-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {pickedLocation?.name ||
                          (headerExampleUrl
                            ? "Sample location set"
                            : "No location yet")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pickedLocation?.address ||
                          "The sample location Meta sees during review."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canEditFields}
                      onClick={() => setIsLocationPickerOpen(true)}
                    >
                      Choose on map
                    </Button>
                  </div>
                )}
              </Field>
            )}

            <Field label="Body">
              <BodyEditor
                value={bodyText}
                onChange={setBodyText}
                examples={bodyExamples}
                onExamplesChange={setBodyExamples}
                disabled={!canEditFields}
              />
            </Field>

            {supportsFooter ? (
              <Field label="Footer">
                <div className="relative">
                  <Input
                    value={footerText}
                    onChange={(event) => setFooterText(event.target.value)}
                    disabled={!canEditFields}
                    maxLength={MAX_FOOTER}
                    placeholder="Reply STOP to opt out"
                    aria-label="Footer"
                    className="pr-14"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-muted-foreground">
                    {footerText.length}/{MAX_FOOTER}
                  </span>
                </div>
              </Field>
            ) : (
              <Field label="Footer">
                <p className="text-sm text-muted-foreground">
                  {footerHiddenReason(templateType, category)}
                </p>
              </Field>
            )}
          </Section>

          <Section
            id="buttons"
            number={3}
            title="Buttons"
            complete={sectionComplete("buttons")}
            error={sectionError("buttons")}
          >
            <ButtonsEditor
              buttons={buttons}
              onChange={setButtons}
              isCarousel={format === "carousel"}
              disabled={!canEditFields}
            />
          </Section>

          <div className="space-y-4 lg:hidden" id="section-review">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm",
                  sectionComplete("review")
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {sectionComplete("review") ? <Check className="size-4" /> : 4}
              </span>
              Review
            </h2>
            {checklistCard}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-lg bg-white p-3 shadow-xs">{preview}</div>
            {checklistCard}
          </div>
        </aside>
      </div>

      {/* Mobile: preview in a bottom sheet. */}
      <Button
        type="button"
        variant="outline"
        className="fixed right-4 bottom-20 z-30 rounded-full shadow-lg lg:hidden"
        onClick={() => setIsPreviewOpen(true)}
      >
        <Eye className="size-4" />
        Preview
      </Button>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {preview}
        </DialogContent>
      </Dialog>

      {/* One sticky action bar for the whole form. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur lg:left-20">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {(!isEditing || isDraftEdit) && (
              <Button
                type="button"
                variant="outline"
                isLoading={isSavingDraft || isPatchingDraft}
                disabled={!canEditFields}
                onClick={handleSaveDraft}
              >
                Save draft
              </Button>
            )}
            {draftSavedAt && (
              <span className="hidden text-xs text-muted-foreground sm:block">
                Saved draft{" "}
                {formatRelative(draftSavedAt) === "Just now"
                  ? "just now"
                  : formatRelative(draftSavedAt)}
              </span>
            )}
          </div>
          {missing.length > 0 && canEditFields ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex">
                  {submitButton}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="space-y-0.5">
                  {missing.map((item) => (
                    <li key={item.id}>• {item.problem || item.label}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          ) : (
            submitButton
          )}
        </div>
      </div>

      <AlertDialog
        open={isTypeChangeConfirmOpen}
        onOpenChange={setIsTypeChangeConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the template type?</AlertDialogTitle>
            <AlertDialogDescription>
              This changes the template from{" "}
              {typeLabels[loadedTemplateType || ""] || loadedTemplateType} to{" "}
              {typeLabels[templateType] || templateType}. Meta will re-review it
              {loadedTemplateType &&
              MEDIA_HEADERS.includes(loadedTemplateType as HeaderChoice)
                ? ` and the ${(typeLabels[loadedTemplateType] || "").toLowerCase()} will be removed`
                : ""}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Keep {typeLabels[loadedTemplateType || ""] || loadedTemplateType}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsTypeChangeConfirmOpen(false);
                handleSubmitForReview(true);
              }}
            >
              Change and submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPickerDialog
        open={isMediaPickerOpen}
        selectedMediaId={
          carouselMediaIndex === null
            ? selectedMediaId
            : carouselCards[carouselMediaIndex]?.mediaId
        }
        requiredType={carouselMediaIndex === null ? headerFormat : "IMAGE"}
        incompatibleHint="Image templates support JPG or PNG"
        onOpenChange={(open) => {
          setIsMediaPickerOpen(open);
          if (!open) setCarouselMediaIndex(null);
        }}
        onSelect={(media: MediaAsset) => {
          if (carouselMediaIndex !== null) {
            setCarouselCards((current) =>
              current.map((card, index) =>
                index === carouselMediaIndex
                  ? {
                      mediaId: media._id,
                      mediaName: media.name,
                      mediaUrl: media.cloudinaryUrl
                    }
                  : card
              )
            );
          } else {
            setSelectedMediaId(media._id);
            setSelectedMediaName(media.name);
            setSelectedMediaUrl(media.cloudinaryUrl);
          }
          setIsMediaPickerOpen(false);
          setCarouselMediaIndex(null);
        }}
      />
      <LocationPickerDialog
        open={isLocationPickerOpen}
        onOpenChange={setIsLocationPickerOpen}
        value={pickedLocation || undefined}
        onSelect={(location) => {
          setPickedLocation(location);
          setHeaderExampleUrl(
            `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
          );
        }}
      />
    </form>
  );
}
