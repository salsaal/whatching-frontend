import { useEffect, useState } from "react";

import {
  CreateTagPayload,
  MetaConversionEventName,
  Tag,
  TagAutomationTrigger,
  TagChannelScope,
  TagMode,
  UpdateTagPayload
} from "@/client-api/types/tags.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";

interface TagFormDialogProps {
  open: boolean;
  tag?: Tag | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CreateTagPayload | UpdateTagPayload) => void;
}

const parseKeywords = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const NO_CONVERSION_EVENT = "none";

const conversionEventOptions: Array<{
  value: MetaConversionEventName;
  label: string;
}> = [
  { value: "Purchase", label: "Purchase" },
  { value: "LeadSubmitted", label: "Lead submitted" },
  { value: "InitiateCheckout", label: "Initiate checkout" },
  { value: "AddToCart", label: "Add to cart" },
  { value: "ViewContent", label: "View content" },
  { value: "OrderCreated", label: "Order created" },
  { value: "OrderShipped", label: "Order shipped" },
  { value: "OrderDelivered", label: "Order delivered" },
  { value: "OrderCanceled", label: "Order canceled" },
  { value: "OrderReturned", label: "Order returned" },
  { value: "CartAbandoned", label: "Cart abandoned" },
  { value: "QualifiedLead", label: "Qualified lead" },
  { value: "RatingProvided", label: "Rating provided" },
  { value: "ReviewProvided", label: "Review provided" }
];

export default function TagFormDialog({
  open,
  tag,
  isSaving,
  onOpenChange,
  onSave
}: TagFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<TagMode>("manual");
  const [channelScope, setChannelScope] = useState<TagChannelScope>("all");
  const [cooldownSeconds, setCooldownSeconds] = useState(3600);
  const [trigger, setTrigger] = useState<TagAutomationTrigger>("keyword");
  const [addKeywords, setAddKeywords] = useState("");
  const [removeKeywords, setRemoveKeywords] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [inactiveAfterDays, setInactiveAfterDays] = useState(30);
  const [reactivateOnReply, setReactivateOnReply] = useState(true);
  const [conversionEventName, setConversionEventName] = useState<
    MetaConversionEventName | typeof NO_CONVERSION_EVENT
  >(NO_CONVERSION_EVENT);

  useEffect(() => {
    if (!open) return;
    setName(tag?.name || "");
    setDescription(tag?.description || "");
    setMode(tag?.mode || "manual");
    setChannelScope(tag?.channelScope || "all");
    setCooldownSeconds(tag?.cooldownSeconds ?? 3600);
    setTrigger(tag?.automation?.trigger || "keyword");
    setAddKeywords((tag?.automation?.addKeywords || []).join(", "));
    setRemoveKeywords((tag?.automation?.removeKeywords || []).join(", "));
    setConfidenceThreshold(tag?.automation?.confidenceThreshold ?? 0.7);
    setInactiveAfterDays(tag?.automation?.inactiveAfterDays ?? 30);
    setReactivateOnReply(tag?.automation?.reactivateOnReply ?? true);
    setConversionEventName(tag?.conversionEventName || NO_CONVERSION_EVENT);
  }, [tag, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedConversionEvent =
      conversionEventName === NO_CONVERSION_EVENT ? null : conversionEventName;

    const payload: CreateTagPayload | UpdateTagPayload = {
      ...(tag ? {} : { name: name.trim() }),
      description: description.trim() || undefined,
      mode,
      channelScope,
      cooldownSeconds,
      automation:
        mode === "bot_decides"
          ? {
              trigger,
              ...(trigger === "keyword"
                ? {
                    addKeywords: parseKeywords(addKeywords),
                    removeKeywords: parseKeywords(removeKeywords)
                  }
                : {}),
              ...(trigger === "ai" ? { confidenceThreshold } : {}),
              ...(trigger === "inactivity"
                ? { inactiveAfterDays, reactivateOnReply }
                : {})
            }
          : undefined,
      // Create's schema rejects an explicit null (only update accepts it
      // to clear a previously-set value), so a fresh tag with "None"
      // picked must omit the field entirely rather than send null.
      ...(tag
        ? { conversionEventName: selectedConversionEvent }
        : selectedConversionEvent
          ? { conversionEventName: selectedConversionEvent }
          : {})
    };

    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tag ? "Edit tag" : "Add tag"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tag name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VIP"
              disabled={Boolean(tag)}
              required={!tag}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional note about when this tag applies"
              className="mt-2 max-h-32"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Applies to</Label>
              <Select
                value={channelScope}
                onValueChange={(value) =>
                  setChannelScope(value as TagChannelScope)
                }
              >
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp only</SelectItem>
                  <SelectItem value="instagram">Instagram only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cooldown (seconds)</Label>
              <Input
                type="number"
                min={0}
                max={30 * 24 * 60 * 60}
                value={cooldownSeconds}
                onChange={(event) =>
                  setCooldownSeconds(Number(event.target.value) || 0)
                }
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Report as conversion to Meta (optional)</Label>
            <Select
              value={conversionEventName}
              onValueChange={(value) =>
                setConversionEventName(
                  value as MetaConversionEventName | typeof NO_CONVERSION_EVENT
                )
              }
            >
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONVERSION_EVENT}>None</SelectItem>
                {conversionEventOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              When a subscriber who arrived via a Click-to-WhatsApp ad reaches
              this tag, it&apos;s reported back to Meta under this event so ad
              delivery can optimize for real outcomes.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-sm border p-3">
            <div>
              <p className="text-sm font-medium">Automatic assignment</p>
              <p className="text-xs text-muted-foreground">
                Let the bot add or remove this tag on its own.
              </p>
            </div>
            <Switch
              checked={mode === "bot_decides"}
              onCheckedChange={(checked) =>
                setMode(checked ? "bot_decides" : "manual")
              }
            />
          </div>

          {mode === "bot_decides" && (
            <div className="space-y-4 rounded-sm border p-3">
              <div>
                <Label>Trigger</Label>
                <Select
                  value={trigger}
                  onValueChange={(value) =>
                    setTrigger(value as TagAutomationTrigger)
                  }
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyword">Keyword match</SelectItem>
                    <SelectItem value="ai">AI decides</SelectItem>
                    <SelectItem value="inactivity">Inactivity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {trigger === "keyword" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Add on keywords</Label>
                    <Input
                      value={addKeywords}
                      onChange={(event) => setAddKeywords(event.target.value)}
                      placeholder="vip, premium"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Remove on keywords</Label>
                    <Input
                      value={removeKeywords}
                      onChange={(event) =>
                        setRemoveKeywords(event.target.value)
                      }
                      placeholder="unsubscribe"
                      className="mt-2"
                    />
                  </div>
                </div>
              )}

              {trigger === "ai" && (
                <div>
                  <Label>Confidence threshold (0-1)</Label>
                  <Input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={confidenceThreshold}
                    onChange={(event) =>
                      setConfidenceThreshold(Number(event.target.value) || 0)
                    }
                    className="mt-2"
                  />
                </div>
              )}

              {trigger === "inactivity" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Inactive after (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={inactiveAfterDays}
                      onChange={(event) =>
                        setInactiveAfterDays(Number(event.target.value) || 1)
                      }
                      className="mt-2"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Reactivate on reply</Label>
                    <Switch
                      checked={reactivateOnReply}
                      onCheckedChange={setReactivateOnReply}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {tag ? "Update tag" : "Create tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
