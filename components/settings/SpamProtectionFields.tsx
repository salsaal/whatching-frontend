import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

const SAVE_DELAY_MS = 600;

export const SPAM_THRESHOLD_RANGE = { min: 3, max: 100 } as const;
export const SPAM_WINDOW_RANGE = { min: 10, max: 3600 } as const;

function DebouncedNumberField({
  label,
  value,
  min,
  max,
  onCommit
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const isFocusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the saved value from the server, but never yank the field out
  // from under someone who is mid-edit.
  useEffect(() => {
    if (!isFocusedRef.current) setDraft(String(value));
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // `fromIdle` commits come from the typing debounce: an out-of-range or
  // empty value there is probably mid-typing ("1" on the way to "15"), so it
  // waits for blur instead of being clamped and saved early.
  const commit = (raw: string, fromIdle = false) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const parsed = Number(raw);
    const isValid = raw.trim() !== "" && Number.isFinite(parsed);
    if (fromIdle && (!isValid || parsed < min || parsed > max)) return;
    if (!isValid) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, Math.round(parsed)));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        min={min}
        max={max}
        step={1}
        className="mt-1"
        value={draft}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => commit(raw, true), SAVE_DELAY_MS);
        }}
        onBlur={(event) => {
          isFocusedRef.current = false;
          commit(event.target.value);
        }}
      />
    </div>
  );
}

export function SpamProtectionFields({
  threshold,
  windowSeconds,
  onSave
}: {
  threshold: number;
  windowSeconds: number;
  onSave: (patch: {
    spamFloodThreshold?: number;
    spamFloodWindowSeconds?: number;
  }) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
      <DebouncedNumberField
        label="Messages"
        value={threshold}
        min={SPAM_THRESHOLD_RANGE.min}
        max={SPAM_THRESHOLD_RANGE.max}
        onCommit={(next) => onSave({ spamFloodThreshold: next })}
      />
      <DebouncedNumberField
        label="Within (seconds)"
        value={windowSeconds}
        min={SPAM_WINDOW_RANGE.min}
        max={SPAM_WINDOW_RANGE.max}
        onCommit={(next) => onSave({ spamFloodWindowSeconds: next })}
      />
    </div>
  );
}
