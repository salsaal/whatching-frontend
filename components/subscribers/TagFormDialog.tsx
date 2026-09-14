import { useEffect, useState } from "react";

import {
  CreateTagPayload,
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
  }, [tag, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
          : undefined
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
