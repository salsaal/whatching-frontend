import {
  CopyPlus,
  Eye,
  EyeOff,
  ImageIcon,
  Plus,
  Trash2,
  Video,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  InstagramBlockType,
  InstagramCanvasContent,
  InstagramFlowEntryPoint,
  InstagramGenericCard,
  InstagramQuickReply,
  InstagramTemplateButton
} from "@/client-api/types/instagram.type";
import { InstagramFlowBlockPreview } from "@/components/flows/FlowBlockPreview";
import { FlowBlockPicker } from "@/components/flows/FlowBlockPicker";
import { FloatingBlockPreview } from "@/components/flows/FlowPhonePreview";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { countChars } from "@/lib/flowBuilder";
import { cn } from "@/lib/utils";

import {
  flowOrder,
  getBlockIcon,
  getBlockLabel,
  pickerPalette
} from "./blockCatalog";
import {
  describeInstagramEntryPoint,
  getOutputs,
  IG_BUTTONS_MAX,
  IG_BUTTONS_TEXT_MAX,
  IG_CARD_SUBTITLE_MAX,
  IG_CARD_TITLE_MAX,
  IG_CARDS_MAX,
  IG_KEYWORDS_MAX,
  IG_OPTION_LABEL_MAX,
  IG_PAUSE_MAX_MINUTES,
  IG_QUICK_REPLIES_MAX,
  IG_TEXT_MAX,
  IgFlowNode,
  IgNodeData,
  IgOutput,
  IgStart,
  isMainMenu,
  joinWithOr,
  makeCard,
  makeOption,
  matchText,
  nextOptionLabel,
  PAUSE_UNIT_MINUTES,
  PauseUnit,
  pauseMinutesOf,
  pauseParts
} from "./instagramFlow";

export type PanelTab = "content" | "next" | "start";

export type FocusRequest = {
  nodeId: string;
  field?: string;
  actionId?: string;
  /** Opens this tab regardless of field. */
  tab?: PanelTab;
  nonce: number;
};

export type MediaPickerTarget =
  | { kind: "node"; nodeId: string }
  | { kind: "card"; nodeId: string; cardIndex: number };

const PREVIEW_OPEN_KEY = "whatching:ig-flow-preview-open";

const previewTypes = new Set<InstagramBlockType>([
  "send_text",
  "send_image",
  "send_video",
  "quick_replies",
  "button_template",
  "generic_template"
]);

// The tab an issue's field or option lives on.
const tabForFocus = (request: FocusRequest): PanelTab => {
  if (request.tab) return request.tab;
  if (request.field === "keywords") return "start";
  if (request.field) return "content";
  return request.actionId ? "next" : "content";
};

// The panel element an issue is about: its exact field, else the closest
// field above or below it in the path, else the option's own control.
const findIssueTarget = (
  root: HTMLElement,
  request: FocusRequest
): HTMLElement | null => {
  const fields = Array.from(
    root.querySelectorAll<HTMLElement>("[data-issue-field]")
  );
  const field = request.field;
  if (field) {
    const exact = fields.find(
      (element) => element.dataset.issueField === field
    );
    if (exact) return exact;
    const related = fields.find((element) => {
      const candidate = element.dataset.issueField || "";
      return (
        candidate.startsWith(`${field}.`) || field.startsWith(`${candidate}.`)
      );
    });
    if (related) return related;
  }
  if (request.actionId) {
    return (
      Array.from(root.querySelectorAll<HTMLElement>("[data-action-id]")).find(
        (element) => element.dataset.actionId === request.actionId
      ) || null
    );
  }
  return null;
};

function Field({
  label,
  children,
  className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** "12/20 characters", red once over the limit. Nothing is blocked. */
function CharCounter({ value, max }: { value: unknown; max: number }) {
  const count = countChars(value);
  return (
    <p
      className={cn(
        "text-[11px]",
        count > max ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {count}/{max} characters
    </p>
  );
}

/** Words as chips: Enter or a comma adds one, × removes it. */
function ChipsInput({
  value,
  onChange,
  max,
  placeholder,
  disabled,
  issueField
}: {
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  placeholder: string;
  disabled?: boolean;
  issueField: string;
}) {
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const commit = () => {
    const words = typed
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
    if (!words.length) return;
    const next = [...value];
    for (const word of words) {
      if (next.some((item) => matchText(item) === matchText(word))) {
        setNote(`"${word}" is already in the list.`);
        continue;
      }
      if (next.length >= max) {
        setNote(`Use at most ${max}.`);
        break;
      }
      next.push(word);
    }
    setTyped("");
    if (next.length !== value.length) {
      setNote("");
      onChange(next);
    }
  };

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          disabled && "opacity-50"
        )}
      >
        {value.map((word) => (
          <span
            key={word}
            className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary"
          >
            {word}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${word}`}
                className="cursor-pointer rounded-full p-0.5 hover:bg-primary/15"
                onClick={() => onChange(value.filter((item) => item !== word))}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        <input
          value={typed}
          disabled={disabled}
          data-issue-field={issueField}
          placeholder={value.length ? "" : placeholder}
          aria-label={placeholder}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setNote("");
            setTyped(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            } else if (event.key === "Backspace" && !typed && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>
      {note && <p className="text-[11px] text-amber-800">{note}</p>}
    </div>
  );
}

function MediaPickerField({
  label,
  content,
  kind,
  disabled,
  issueField,
  onPick
}: {
  label: string;
  content: {
    mediaId?: string;
    mediaName?: string;
    mediaUrl?: unknown;
    imageUrl?: string;
  };
  kind: "image" | "video";
  disabled: boolean;
  issueField: string;
  onPick: () => void;
}) {
  const url = String(content.mediaUrl || content.imageUrl || "");
  const Icon = kind === "video" ? Video : ImageIcon;
  return (
    <Field label={label}>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
          {url && kind === "image" ? (
            // Library media is already on our CDN.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <Icon className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {content.mediaName ||
              (content.mediaId
                ? `${kind === "video" ? "Video" : "Image"} chosen`
                : `No ${kind} chosen`)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1 h-7"
            disabled={disabled}
            data-issue-field={issueField}
            onClick={onPick}
          >
            {content.mediaId ? `Change ${kind}` : `Choose ${kind}`}
          </Button>
        </div>
      </div>
    </Field>
  );
}

/** Repeated labels in this block, as people read them. */
const repeatedLabels = (labels: string[]) => {
  const counts = new Map<string, number>();
  labels.forEach((label) => {
    const key = matchText(label);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
  );
};

const DuplicateNote = () => (
  <p className="text-[11px] text-destructive">
    Another answer in this block has this label. Give each one a different
    label.
  </p>
);

function ButtonRows({
  buttons,
  fieldPrefix,
  readOnly,
  repeated,
  allowNone,
  onChange
}: {
  buttons: InstagramTemplateButton[];
  /** e.g. "content.buttons" or "content.cards.1.buttons". */
  fieldPrefix: string;
  readOnly: boolean;
  repeated: Set<string>;
  /** Carousel cards may have no buttons. */
  allowNone: boolean;
  onChange: (buttons: InstagramTemplateButton[]) => void;
}) {
  const update = (index: number, patch: Partial<InstagramTemplateButton>) =>
    onChange(
      buttons.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, ...patch } : button
      )
    );
  return (
    <div className="space-y-2">
      {buttons.map((button, index) => {
        const isUrl = (button.type || "postback") === "web_url";
        const label = button.label || button.title || "";
        return (
          <div
            key={button.actionId || index}
            className="space-y-2 rounded-lg border bg-white p-2.5"
            data-action-id={button.actionId}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  value={label}
                  disabled={readOnly}
                  placeholder="Button label"
                  aria-label={`Button ${index + 1} label`}
                  data-issue-field={`${fieldPrefix}.${index}.label`}
                  onChange={(event) =>
                    update(index, {
                      label: event.target.value,
                      title: undefined
                    })
                  }
                />
                <CharCounter value={label} max={IG_OPTION_LABEL_MAX} />
                {!isUrl && repeated.has(matchText(label)) && <DuplicateNote />}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground"
                disabled={readOnly || (!allowNone && buttons.length <= 1)}
                aria-label={`Remove button ${index + 1}`}
                tooltip="Remove button"
                onClick={() =>
                  onChange(
                    buttons.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Select
              value={isUrl ? "web_url" : "postback"}
              disabled={readOnly}
              onValueChange={(value) =>
                update(
                  index,
                  value === "web_url"
                    ? { type: "web_url", url: button.url || "" }
                    : {
                        type: "postback",
                        url: undefined,
                        replyId: button.replyId || button.actionId
                      }
                )
              }
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postback">
                  Answer: leads to a block
                </SelectItem>
                <SelectItem value="web_url">Open website</SelectItem>
              </SelectContent>
            </Select>
            {isUrl && (
              <Input
                value={button.url || ""}
                disabled={readOnly}
                placeholder="https://example.com"
                aria-label={`Button ${index + 1} website`}
                data-issue-field={`${fieldPrefix}.${index}.url`}
                onChange={(event) => update(index, { url: event.target.value })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContentTab({
  node,
  readOnly,
  updateContent,
  openMediaPicker
}: {
  node: IgFlowNode;
  readOnly: boolean;
  updateContent: (patch: Partial<InstagramCanvasContent>) => void;
  openMediaPicker: (target: MediaPickerTarget) => void;
}) {
  const { blockType, content } = node.data;
  const replies = (content.quickReplies || []) as InstagramQuickReply[];
  const buttons = (content.buttons || []) as InstagramTemplateButton[];
  const cards = (content.cards || []) as InstagramGenericCard[];
  const optionLabels =
    blockType === "quick_replies"
      ? replies.map((reply) => reply.label || reply.title || "")
      : blockType === "button_template"
        ? buttons
            .filter((button) => button.type !== "web_url")
            .map((button) => button.label || button.title || "")
        : cards.flatMap((card) =>
            (card.buttons || [])
              .filter((button) => button.type !== "web_url")
              .map((button) => button.label || button.title || "")
          );
  const repeated = repeatedLabels(optionLabels);
  const usedIds = () =>
    getOutputs(node.data)
      .map((output) => output.id)
      .concat(
        [...replies, ...buttons, ...cards.flatMap((card) => card.buttons || [])]
          .map((option) => option.replyId || "")
          .filter(Boolean)
      );

  const textField = (max: number, label = "Message") => (
    <Field label={label}>
      <Textarea
        className="min-h-28"
        value={String(content.text || "")}
        disabled={readOnly}
        data-issue-field="content.text"
        onChange={(event) => updateContent({ text: event.target.value })}
      />
      <CharCounter value={content.text} max={max} />
    </Field>
  );

  switch (blockType) {
    case "send_text":
      return textField(IG_TEXT_MAX);

    case "send_image":
    case "send_video":
      return (
        <MediaPickerField
          label={blockType === "send_image" ? "Image" : "Video"}
          content={content}
          kind={blockType === "send_image" ? "image" : "video"}
          disabled={readOnly}
          issueField="content.mediaId"
          onPick={() => openMediaPicker({ kind: "node", nodeId: node.id })}
        />
      );

    case "quick_replies":
      return (
        <div className="space-y-4">
          {textField(IG_TEXT_MAX)}
          <Field label={`Answers (${replies.length}/${IG_QUICK_REPLIES_MAX})`}>
            <div className="space-y-2" data-issue-field="content.quickReplies">
              {replies.map((reply, index) => {
                const label = reply.label || reply.title || "";
                return (
                  <div
                    key={reply.actionId || index}
                    className="flex items-start gap-2"
                    data-action-id={reply.actionId}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        value={label}
                        disabled={readOnly}
                        placeholder="Answer"
                        aria-label={`Answer ${index + 1}`}
                        data-issue-field={`content.quickReplies.${index}.label`}
                        onChange={(event) =>
                          updateContent({
                            quickReplies: replies.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    label: event.target.value,
                                    title: undefined
                                  }
                                : item
                            )
                          })
                        }
                      />
                      <CharCounter value={label} max={IG_OPTION_LABEL_MAX} />
                      {repeated.has(matchText(label)) && <DuplicateNote />}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground"
                      disabled={readOnly || replies.length <= 1}
                      aria-label={`Remove answer ${index + 1}`}
                      tooltip="Remove answer"
                      onClick={() =>
                        updateContent({
                          quickReplies: replies.filter(
                            (_, itemIndex) => itemIndex !== index
                          )
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || replies.length >= IG_QUICK_REPLIES_MAX}
              onClick={() =>
                updateContent({
                  quickReplies: [
                    ...replies,
                    makeOption(
                      "quick_replies",
                      nextOptionLabel(optionLabels),
                      usedIds()
                    ) as InstagramQuickReply
                  ]
                })
              }
            >
              <Plus className="size-4" />
              Add answer
            </Button>
          </Field>
        </div>
      );

    case "button_template":
      return (
        <div className="space-y-4">
          {textField(IG_BUTTONS_TEXT_MAX)}
          <Field label={`Buttons (${buttons.length}/${IG_BUTTONS_MAX})`}>
            <div data-issue-field="content.buttons">
              <ButtonRows
                buttons={buttons}
                fieldPrefix="content.buttons"
                readOnly={readOnly}
                repeated={repeated}
                allowNone={false}
                onChange={(next) => updateContent({ buttons: next })}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || buttons.length >= IG_BUTTONS_MAX}
              onClick={() =>
                updateContent({
                  buttons: [
                    ...buttons,
                    makeOption(
                      "button_template",
                      nextOptionLabel(optionLabels),
                      usedIds()
                    ) as InstagramTemplateButton
                  ]
                })
              }
            >
              <Plus className="size-4" />
              Add button
            </Button>
          </Field>
        </div>
      );

    case "generic_template": {
      const updateCard = (
        index: number,
        patch: Partial<InstagramGenericCard>
      ) =>
        updateContent({
          cards: cards.map((card, cardIndex) =>
            cardIndex === index ? { ...card, ...patch } : card
          )
        });
      return (
        <div className="space-y-3" data-issue-field="content.cards">
          {cards.map((card, cardIndex) => {
            const cardButtons = card.buttons || [];
            return (
              <div
                key={cardIndex}
                className="space-y-3 rounded-lg border bg-muted/20 p-3"
                data-issue-field={`content.cards.${cardIndex}`}
                tabIndex={-1}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Card {cardIndex + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    disabled={readOnly || cards.length <= 1}
                    aria-label={`Remove card ${cardIndex + 1}`}
                    tooltip="Remove card"
                    onClick={() =>
                      updateContent({
                        cards: cards.filter((_, index) => index !== cardIndex)
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Field label="Title">
                  <Input
                    value={card.title || ""}
                    disabled={readOnly}
                    data-issue-field={`content.cards.${cardIndex}.title`}
                    onChange={(event) =>
                      updateCard(cardIndex, { title: event.target.value })
                    }
                  />
                  <CharCounter value={card.title} max={IG_CARD_TITLE_MAX} />
                </Field>
                <Field label="Description (optional)">
                  <Input
                    value={card.subtitle || ""}
                    disabled={readOnly}
                    data-issue-field={`content.cards.${cardIndex}.subtitle`}
                    onChange={(event) =>
                      updateCard(cardIndex, { subtitle: event.target.value })
                    }
                  />
                  <CharCounter
                    value={card.subtitle}
                    max={IG_CARD_SUBTITLE_MAX}
                  />
                </Field>
                <MediaPickerField
                  label="Image (optional)"
                  content={card}
                  kind="image"
                  disabled={readOnly}
                  issueField={`content.cards.${cardIndex}.mediaId`}
                  onPick={() =>
                    openMediaPicker({
                      kind: "card",
                      nodeId: node.id,
                      cardIndex
                    })
                  }
                />
                <Field
                  label={`Buttons (${cardButtons.length}/${IG_BUTTONS_MAX})`}
                >
                  <ButtonRows
                    buttons={cardButtons}
                    fieldPrefix={`content.cards.${cardIndex}.buttons`}
                    readOnly={readOnly}
                    repeated={repeated}
                    allowNone
                    onChange={(next) =>
                      updateCard(cardIndex, { buttons: next })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={readOnly || cardButtons.length >= IG_BUTTONS_MAX}
                    onClick={() =>
                      updateCard(cardIndex, {
                        buttons: [
                          ...cardButtons,
                          makeOption(
                            "generic_template",
                            nextOptionLabel(optionLabels),
                            usedIds()
                          ) as InstagramTemplateButton
                        ]
                      })
                    }
                  >
                    <Plus className="size-4" />
                    Add button
                  </Button>
                </Field>
                <p className="text-[11px] text-muted-foreground">
                  Besides its title, a card needs an image, a description or a
                  button.
                </p>
              </div>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || cards.length >= IG_CARDS_MAX}
            onClick={() =>
              updateContent({
                cards: [...cards, makeCard(cards.length, usedIds())]
              })
            }
          >
            <Plus className="size-4" />
            Add card ({cards.length}/{IG_CARDS_MAX})
          </Button>
        </div>
      );
    }

    case "tag_subscriber":
      return (
        <Field label="Tags">
          <ChipsInput
            value={(content.tags || []).filter(Boolean)}
            onChange={(tags) => updateContent({ tags })}
            max={50}
            placeholder="Type a tag, e.g. lead, and press Enter"
            disabled={readOnly}
            issueField="content.tags"
          />
          <p className="text-[11px] text-muted-foreground">
            The person gets these tags. Use them to filter contacts later.
          </p>
        </Field>
      );

    case "pause_automation":
      return (
        <PauseField
          node={node}
          readOnly={readOnly}
          updateContent={updateContent}
        />
      );

    case "handoff_to_agent":
      return (
        <Field label="Note for your team (optional)">
          <Textarea
            className="min-h-20"
            value={String(content.reason || "")}
            disabled={readOnly}
            placeholder="e.g. Wants a custom order"
            data-issue-field="content.reason"
            onChange={(event) => updateContent({ reason: event.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            Automation stops for this chat and your team is alerted in the
            inbox.
          </p>
        </Field>
      );

    case "end_flow":
      return (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Marks the chat as resolved. Nothing is sent to the person.
        </p>
      );

    case "follow_condition":
      return (
        <div className="space-y-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <p>
            Checks whether the person follows your Instagram account, then sends
            them down one of three paths:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Follows you</span>
            </li>
            <li>
              <span className="font-medium text-foreground">
                Doesn&apos;t follow you
              </span>
            </li>
            <li>
              <span className="font-medium text-foreground">
                Couldn&apos;t check
              </span>{" "}
              (optional): if you leave it empty, these people get the
              &ldquo;Doesn&apos;t follow you&rdquo; path.
            </li>
          </ul>
          <p>Choose where each path goes on the Next steps tab.</p>
        </div>
      );

    default:
      return null;
  }
}

function PauseField({
  node,
  readOnly,
  updateContent
}: {
  node: IgFlowNode;
  readOnly: boolean;
  updateContent: (patch: Partial<InstagramCanvasContent>) => void;
}) {
  const minutes = pauseMinutesOf(node.data.content);
  const savedUnit = node.data.content.pauseUnit;
  const { value, unit } = pauseParts(minutes, savedUnit);
  const [typed, setTyped] = useState(String(value));
  useEffect(() => {
    setTyped((current) =>
      Number(current) === Number(value) ? current : String(value)
    );
  }, [value]);
  const outOfRange = minutes < 1 || minutes > IG_PAUSE_MAX_MINUTES;

  return (
    <Field label="Pause for">
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Input
          type="number"
          min={1}
          value={typed}
          disabled={readOnly}
          data-issue-field="content.minutes"
          aria-invalid={outOfRange || undefined}
          className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(event) => {
            setTyped(event.target.value);
            const next = Number(event.target.value);
            if (!event.target.value || !Number.isFinite(next) || next <= 0) {
              return;
            }
            updateContent({
              minutes: Math.max(1, Math.round(next * PAUSE_UNIT_MINUTES[unit])),
              pauseMinutes: undefined
            });
          }}
        />
        <Select
          value={unit}
          disabled={readOnly}
          onValueChange={(next) =>
            updateContent({
              pauseUnit: next,
              minutes: Math.max(
                1,
                Math.round(
                  Number(typed || value) * PAUSE_UNIT_MINUTES[next as PauseUnit]
                )
              ),
              pauseMinutes: undefined
            })
          }
        >
          <SelectTrigger className="bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="days">Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p
        className={cn(
          "text-[11px]",
          outOfRange ? "text-destructive" : "text-muted-foreground"
        )}
      >
        From 1 minute to 7 days. Automated replies stop for this person for that
        long.
      </p>
    </Field>
  );
}

function NextStepsTab({
  node,
  readOnly,
  blockChoices,
  targets,
  connectOutput,
  createConnectedBlock
}: {
  node: IgFlowNode;
  readOnly: boolean;
  blockChoices: IgFlowNode[];
  targets: Record<string, string>;
  connectOutput: (handle: string, targetId: string | null) => void;
  createConnectedBlock: (handle: string, type: InstagramBlockType) => void;
}) {
  const outputs = getOutputs(node.data);
  if (!outputs.length) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {node.data.blockType === "handoff_to_agent"
          ? "The chat goes to your team after this block."
          : node.data.blockType === "pause_automation"
            ? "Automated replies stop here for the time you set."
            : node.data.blockType === "end_flow"
              ? "The conversation ends here."
              : "This block doesn't lead anywhere by itself."}
      </p>
    );
  }

  const hint = (output: IgOutput) =>
    output.kind === "next"
      ? "Sent straight after this block, without waiting for a reply."
      : output.id === "unknown"
        ? "Optional. If you leave it, these people get the “Doesn't follow you” step."
        : "";

  const row = (output: IgOutput) => (
    <div key={output.id} className="space-y-2 rounded-lg border p-3">
      <p className="truncate text-sm font-medium">
        {output.kind === "next" ? "Then" : <>&ldquo;{output.label}&rdquo;</>}
      </p>
      {output.kind === "url" ? (
        <p className="truncate text-xs text-muted-foreground">
          Opens {output.url || "a website (add its link on the Content tab)"}
        </p>
      ) : (
        <FlowBlockPicker<InstagramBlockType, IgFlowNode>
          value={targets[output.id]}
          blocks={blockChoices}
          currentBlockId={node.id}
          disabled={readOnly}
          actionId={output.id}
          palette={pickerPalette}
          getIcon={getBlockIcon}
          getLabel={getBlockLabel}
          order={(blocks) => flowOrder(blocks)}
          onSelect={(targetId) => connectOutput(output.id, targetId)}
          onClear={() => connectOutput(output.id, null)}
          onCreate={(type) => createConnectedBlock(output.id, type)}
        />
      )}
      {hint(output) && (
        <p className="text-[11px] text-muted-foreground">{hint(output)}</p>
      )}
    </div>
  );

  if (node.data.blockType === "generic_template") {
    const groups = new Map<number, IgOutput[]>();
    outputs.forEach((output) =>
      groups.set(output.cardIndex ?? 0, [
        ...(groups.get(output.cardIndex ?? 0) || []),
        output
      ])
    );
    return (
      <div className="space-y-4">
        {[...groups.entries()].map(([cardIndex, cardOutputs]) => (
          <div key={cardIndex} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cardOutputs[0].group || `Card ${cardIndex + 1}`}
            </p>
            {cardOutputs.map(row)}
          </div>
        ))}
      </div>
    );
  }
  return <div className="space-y-2">{outputs.map(row)}</div>;
}

const startOptions: Array<{ value: IgStart | "none"; label: string }> = [
  { value: "none", label: "Only from other blocks" },
  { value: "default", label: "Main menu" },
  { value: "first_dm", label: "Welcome message" },
  { value: "keyword", label: "Keyword" },
  { value: "story_reply", label: "Story reply" }
];

function StartTab({
  node,
  readOnly,
  greetings,
  setStart,
  setKeywords,
  entryPoints,
  unreachableMessage
}: {
  node: IgFlowNode;
  readOnly: boolean;
  greetings: string[];
  setStart: (start: IgStart | undefined) => void;
  setKeywords: (keywords: string[]) => void;
  entryPoints?: InstagramFlowEntryPoint[];
  unreachableMessage?: string;
}) {
  const current = (node.data.triggerType as IgStart | undefined) || "none";
  const mainMenu = isMainMenu(node.data);
  const describe = (value: IgStart | "none") => {
    switch (value) {
      case "default":
        return (
          <>
            When someone says {joinWithOr(greetings)}.{" "}
            <Link
              href="/instagram?tab=settings"
              className="font-medium text-primary hover:underline"
            >
              Change these words in Settings
            </Link>
          </>
        );
      case "first_dm":
        return "The first time someone messages you.";
      case "keyword":
        return "Starts when a message contains one of these words.";
      case "story_reply":
        return "When someone replies to one of your stories.";
      default:
        return "Only sent when another block leads here.";
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">How does this block start?</p>
        <RadioGroup
          value={current}
          disabled={readOnly}
          onValueChange={(value) =>
            setStart(value === "none" ? undefined : (value as IgStart))
          }
          className="gap-2"
        >
          {startOptions.map((option) => {
            const id = `start-${node.id}-${option.value}`;
            const selected = current === option.value;
            // The main menu moves by picking it on another block.
            const disabled = mainMenu && option.value !== "default";
            return (
              <div
                key={option.value}
                className={cn(
                  "rounded-lg border p-3",
                  selected && "border-primary bg-primary/5",
                  disabled && "opacity-60"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <RadioGroupItem
                    id={id}
                    value={option.value}
                    disabled={readOnly || disabled}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={id} className="cursor-pointer text-sm">
                      {option.label}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {describe(option.value)}
                    </p>
                  </div>
                </div>
                {selected && option.value === "keyword" && (
                  <div className="mt-3">
                    <ChipsInput
                      value={node.data.keywords}
                      onChange={setKeywords}
                      max={IG_KEYWORDS_MAX}
                      placeholder="Type a word or phrase and press Enter"
                      disabled={readOnly}
                      issueField="keywords"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Up to {IG_KEYWORDS_MAX}. Whole words only: “price” matches
                      “what&apos;s the price?” but not “priceless”.
                    </p>
                  </div>
                )}
                {selected && option.value === "story_reply" && (
                  <div className="mt-3 space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Only replies containing… (optional)
                    </Label>
                    <ChipsInput
                      value={node.data.keywords}
                      onChange={setKeywords}
                      max={IG_KEYWORDS_MAX}
                      placeholder="Leave empty to answer every story reply"
                      disabled={readOnly}
                      issueField="keywords"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </RadioGroup>
        {mainMenu && !readOnly && (
          <p className="text-[11px] text-muted-foreground">
            Every flow has one main menu. To move it, open another block and
            pick Main menu there.
          </p>
        )}
      </div>

      {!readOnly && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Reached from
          </Label>
          {entryPoints === undefined ? (
            <p className="text-sm text-muted-foreground">
              Shown after the next save.
            </p>
          ) : entryPoints.length === 0 ? (
            <p className="text-sm text-amber-800">
              {unreachableMessage || "Nothing leads here yet."}
            </p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {entryPoints.map((entry, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    {describeInstagramEntryPoint(entry)}
                  </li>
                ))}
              </ul>
              {unreachableMessage && (
                <p className="text-sm text-amber-800">{unreachableMessage}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The right panel: one scroll for the whole panel, preview beside it. */
export function InstagramBlockInspector({
  node,
  readOnly,
  updateNode,
  blockChoices,
  targets,
  connectOutput,
  createConnectedBlock,
  setStart,
  openMediaPicker,
  greetings,
  entryPoints,
  unreachableMessage,
  focusRequest,
  onDuplicate,
  onDelete
}: {
  node: IgFlowNode | null;
  readOnly: boolean;
  updateNode: (
    nodeId: string,
    updater: (data: IgNodeData) => IgNodeData
  ) => void;
  /** Blocks an output can go to. */
  blockChoices: IgFlowNode[];
  /** Where each of this block's outputs is wired, by handle. */
  targets: Record<string, string>;
  connectOutput: (handle: string, targetId: string | null) => void;
  createConnectedBlock: (handle: string, type: InstagramBlockType) => void;
  setStart: (nodeId: string, start: IgStart | undefined) => void;
  openMediaPicker: (target: MediaPickerTarget) => void;
  /** The words that open the main menu, from Settings. */
  greetings: string[];
  /** From the last check; undefined until the block has been checked. */
  entryPoints?: InstagramFlowEntryPoint[];
  unreachableMessage?: string;
  focusRequest: FocusRequest | null;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const handledFocusRef = useRef<number | null>(null);
  const [tab, setTab] = useState<PanelTab>("content");
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    try {
      setPreviewOpen(localStorage.getItem(PREVIEW_OPEN_KEY) === "1");
    } catch {
      // Storage unavailable: the preview starts closed.
    }
  }, []);
  const togglePreview = () => {
    setPreviewOpen((current) => {
      try {
        localStorage.setItem(PREVIEW_OPEN_KEY, current ? "0" : "1");
      } catch {
        // Not remembered; it still toggles.
      }
      return !current;
    });
  };
  const nodeId = node?.id;

  // Clicking an issue selects its block; this opens the tab holding the
  // field (or option) it is about, scrolls to it and focuses it.
  useEffect(() => {
    if (
      !focusRequest ||
      focusRequest.nodeId !== nodeId ||
      handledFocusRef.current === focusRequest.nonce
    ) {
      return;
    }
    const wanted = tabForFocus(focusRequest);
    if (tab !== wanted) {
      setTab(wanted);
      return;
    }
    handledFocusRef.current = focusRequest.nonce;
    const frame = window.requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const target = findIssueTarget(root, focusRequest);
      if (!target) {
        root.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRequest, nodeId, tab]);

  if (!node) {
    return (
      <aside className="overflow-y-auto border-l bg-white p-4">
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {readOnly
            ? "You're viewing the version customers get. Click a block to see its details."
            : "Select a block to edit what it sends and where it leads."}
        </div>
      </aside>
    );
  }

  const updateContent = (patch: Partial<InstagramCanvasContent>) =>
    updateNode(node.id, (data) => ({
      ...data,
      content: { ...data.content, ...patch }
    }));
  const canPreview = previewTypes.has(node.data.blockType);
  const mainMenu = isMainMenu(node.data);

  return (
    // The preview floats outside the panel, so it sits next to (not in)
    // the panel's only scroll area.
    <div className="relative z-30 min-h-0 border-l bg-white">
      {canPreview && (
        <FloatingBlockPreview
          open={previewOpen}
          onClose={togglePreview}
          title={node.data.label}
        >
          <InstagramFlowBlockPreview
            blockType={node.data.blockType}
            content={node.data.content}
            showClose={false}
          />
        </FloatingBlockPreview>
      )}
      <aside
        ref={panelRef}
        className="h-full overflow-y-auto [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]"
      >
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as PanelTab)}
          className="gap-0"
        >
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-2">
            <div className="flex items-center gap-2">
              <TabsList className="min-w-0 flex-1">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="next">Next steps</TabsTrigger>
                <TabsTrigger value="start">Start</TabsTrigger>
              </TabsList>
              {canPreview && (
                <Button
                  type="button"
                  variant={previewOpen ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8 shrink-0"
                  aria-pressed={previewOpen}
                  aria-label={previewOpen ? "Hide preview" : "Show preview"}
                  tooltip={previewOpen ? "Hide preview" : "Show preview"}
                  onClick={togglePreview}
                >
                  {previewOpen ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              )}
            </div>
            {readOnly && (
              <p className="mt-2 text-xs text-muted-foreground">
                The current version is read-only.
              </p>
            )}
          </div>

          <TabsContent value="content" className="space-y-4 p-4">
            <Field label="Block name">
              <Input
                value={node.data.label}
                disabled={readOnly}
                data-issue-field="name"
                onChange={(event) =>
                  updateNode(node.id, (data) => ({
                    ...data,
                    label: event.target.value
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {getBlockLabel(node.data.blockType)} · only your team sees this
                name.
              </p>
            </Field>
            <ContentTab
              node={node}
              readOnly={readOnly}
              updateContent={updateContent}
              openMediaPicker={openMediaPicker}
            />
            {!readOnly && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={onDuplicate}>
                    <CopyPlus className="size-4" />
                    Duplicate block
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive"
                    disabled={mainMenu}
                    onClick={onDelete}
                  >
                    <Trash2 className="size-4" />
                    Delete block
                  </Button>
                </div>
                {mainMenu && (
                  <p className="text-xs text-muted-foreground">
                    Make another block the main menu to delete this one.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="next" className="space-y-4 p-4">
            <NextStepsTab
              node={node}
              readOnly={readOnly}
              blockChoices={blockChoices}
              targets={targets}
              connectOutput={connectOutput}
              createConnectedBlock={createConnectedBlock}
            />
          </TabsContent>

          <TabsContent value="start" className="space-y-4 p-4">
            <StartTab
              node={node}
              readOnly={readOnly}
              greetings={greetings}
              setStart={(start) => setStart(node.id, start)}
              setKeywords={(keywords) =>
                updateNode(node.id, (data) => ({ ...data, keywords }))
              }
              entryPoints={entryPoints}
              unreachableMessage={unreachableMessage}
            />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
