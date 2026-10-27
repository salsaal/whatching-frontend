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

type CooldownUnit = "seconds" | "minutes" | "hours" | "days";

const COOLDOWN_UNIT_SECONDS: Record<CooldownUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400
};

// Backend accepts whole seconds in [0, 30 days].
const MAX_COOLDOWN_SECONDS = 30 * COOLDOWN_UNIT_SECONDS.days;
const DEFAULT_COOLDOWN_SECONDS = 3600;

// Picks the largest unit that divides the saved value exactly, so a stored
// value always round-trips unchanged (90 shows as "90 seconds", never "2
// minutes").
const secondsToCooldownDuration = (
  totalSeconds: number
): { value: number; unit: CooldownUnit } => {
  for (const unit of ["days", "hours", "minutes"] as const) {
    const size = COOLDOWN_UNIT_SECONDS[unit];
    if (totalSeconds > 0 && totalSeconds % size === 0) {
      return { value: totalSeconds / size, unit };
    }
  }
  return { value: totalSeconds, unit: "seconds" };
};

const cooldownDurationToSeconds = (value: number, unit: CooldownUnit) =>
  Math.min(
    MAX_COOLDOWN_SECONDS,
    Math.max(0, Math.round(value * COOLDOWN_UNIT_SECONDS[unit]))
  );

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
  const [cooldownValue, setCooldownValue] = useState(1);
  const [cooldownUnit, setCooldownUnit] = useState<CooldownUnit>("hours");
  const [initialCooldownSeconds, setInitialCooldownSeconds] = useState(
    DEFAULT_COOLDOWN_SECONDS
  );
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
    const savedCooldown = tag?.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
    const cooldown = secondsToCooldownDuration(savedCooldown);
    setInitialCooldownSeconds(savedCooldown);
    setCooldownValue(cooldown.value);
    setCooldownUnit(cooldown.unit);
    setTrigger(tag?.automation?.trigger || "keyword");
    setAddKeywords((tag?.automation?.addKeywords || []).join(", "));
    setRemoveKeywords((tag?.automation?.removeKeywords || []).join(", "));
    setConfidenceThreshold(tag?.automation?.confidenceThreshold ?? 0.7);
    setInactiveAfterDays(tag?.automation?.inactiveAfterDays ?? 30);
    setReactivateOnReply(tag?.automation?.reactivateOnReply ?? true);
  }, [tag, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cooldownSeconds = cooldownDurationToSeconds(
      cooldownValue,
      cooldownUnit
    );
    // The cooldown only matters for bot_decides tags (it's only shown for
    // them), and only goes out when it actually changed -- otherwise editing
    // e.g. a manual tag's description would silently overwrite it.
    const shouldSendCooldown =
      mode === "bot_decides" &&
      (!tag || cooldownSeconds !== initialCooldownSeconds);

    const payload: CreateTagPayload | UpdateTagPayload = {
      ...(tag ? {} : { name: name.trim() }),
      description: description.trim() || undefined,
      mode,
      channelScope,
      ...(shouldSendCooldown ? { cooldownSeconds } : {}),
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

              <div>
                <Label>Wait before re-applying automatically</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={
                      MAX_COOLDOWN_SECONDS / COOLDOWN_UNIT_SECONDS[cooldownUnit]
                    }
                    value={cooldownValue}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      const unitMax =
                        MAX_COOLDOWN_SECONDS /
                        COOLDOWN_UNIT_SECONDS[cooldownUnit];
                      setCooldownValue(
                        Number.isFinite(next)
                          ? Math.min(unitMax, Math.max(0, next))
                          : 0
                      );
                    }}
                    className="w-24"
                  />
                  <Select
                    value={cooldownUnit}
                    onValueChange={(value) => {
                      const unit = value as CooldownUnit;
                      const unitMax =
                        MAX_COOLDOWN_SECONDS / COOLDOWN_UNIT_SECONDS[unit];
                      setCooldownUnit(unit);
                      setCooldownValue((current) => Math.min(unitMax, current));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Seconds</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  After the bot adds or removes this tag, it won&apos;t
                  re-evaluate the same subscriber for this trigger again until
                  this much time has passed. Use 0 for no cooldown; the maximum
                  is 30 days.
                </p>
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
