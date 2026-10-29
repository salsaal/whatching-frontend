import { useEffect, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const HANDOFF_MESSAGE_MAX = 1024;
export const DEFAULT_HANDOFF_MESSAGE =
  "🙋 Thanks! I've passed you to our team — someone will reply right here shortly.";

// The customer-facing line sent when a chat moves to the team. Saves on
// blur, and never sends an empty value (the backend requires 1+ chars).
export function HandoffMessageField({
  value,
  platform,
  disabled,
  onSave
}: {
  value?: string;
  platform: "WhatsApp" | "Instagram";
  disabled?: boolean;
  onSave: (next: string) => void;
}) {
  const saved = value || DEFAULT_HANDOFF_MESSAGE;
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(saved);
    setError("");
  }, [saved]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("The handoff message can't be empty.");
      return;
    }
    setError("");
    if (trimmed !== saved) onSave(trimmed);
  };

  const preview = draft.trim() || saved;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Textarea
          value={draft}
          rows={3}
          maxLength={HANDOFF_MESSAGE_MAX}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-label="Handoff message"
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError("");
          }}
          onBlur={commit}
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-destructive">{error}</span>
          <span className="shrink-0 text-muted-foreground">
            {draft.length}/{HANDOFF_MESSAGE_MAX}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg p-3",
          platform === "WhatsApp"
            ? "bg-[#efeae2] bg-[radial-gradient(circle_at_15%_25%,rgba(17,111,91,0.08)_0_1px,transparent_1.5px)] [background-size:18px_18px]"
            : "border bg-white"
        )}
      >
        <p className="mb-1.5 text-[11px] font-medium text-slate-500">Preview</p>
        <div
          className={cn(
            "w-fit max-w-[85%] px-3 py-2 text-[13px] leading-5 whitespace-pre-wrap break-words shadow-xs",
            platform === "WhatsApp"
              ? "rounded-lg rounded-tl-sm bg-white text-slate-900"
              : "rounded-2xl rounded-tl-sm bg-[#efefef] text-slate-900"
          )}
        >
          {preview}
          {platform === "WhatsApp" && (
            <span className="mt-0.5 block text-right text-[10px] text-slate-400">
              12:00
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
