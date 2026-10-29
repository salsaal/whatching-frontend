import { useState } from "react";

import { SpamProtectionFields } from "@/components/settings/SpamProtectionFields";
import { cn } from "@/lib/utils";

type PresetKey = "strict" | "balanced" | "relaxed" | "custom";

const PRESETS: Array<{
  key: Exclude<PresetKey, "custom">;
  label: string;
  threshold: number;
  windowSeconds: number;
  recommended?: boolean;
}> = [
  { key: "strict", label: "Strict", threshold: 5, windowSeconds: 30 },
  {
    key: "balanced",
    label: "Balanced",
    threshold: 8,
    windowSeconds: 30,
    recommended: true
  },
  { key: "relaxed", label: "Relaxed", threshold: 15, windowSeconds: 60 }
];

export function SpamProtectionPresets({
  threshold,
  windowSeconds,
  disabled,
  onSave
}: {
  threshold: number;
  windowSeconds: number;
  disabled?: boolean;
  onSave: (patch: {
    spamFloodThreshold?: number;
    spamFloodWindowSeconds?: number;
  }) => void;
}) {
  // The highlighted option follows the stored values; "Custom" can also be
  // picked explicitly to tweak numbers that happen to match a preset.
  const [forceCustom, setForceCustom] = useState(false);
  const matched = PRESETS.find(
    (preset) =>
      preset.threshold === threshold && preset.windowSeconds === windowSeconds
  );
  const selected: PresetKey = forceCustom
    ? "custom"
    : (matched?.key ?? "custom");

  const options: Array<{ key: PresetKey; label: string; detail: string }> = [
    ...PRESETS.map((preset) => ({
      key: preset.key,
      label: preset.label,
      detail: `${preset.threshold} in ${preset.windowSeconds}s${
        preset.recommended ? " · Recommended" : ""
      }`
    })),
    { key: "custom", label: "Custom", detail: "Set your own" }
  ];

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Spam protection sensitivity"
        className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:grid-cols-4"
      >
        {options.map((option) => {
          const isSelected = selected === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => {
                if (option.key === "custom") {
                  setForceCustom(true);
                  return;
                }
                setForceCustom(false);
                const preset = PRESETS.find((item) => item.key === option.key);
                if (preset && preset.key !== matched?.key) {
                  onSave({
                    spamFloodThreshold: preset.threshold,
                    spamFloodWindowSeconds: preset.windowSeconds
                  });
                }
              }}
              className={cn(
                "cursor-pointer rounded-sm px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "bg-white shadow-xs"
                  : "text-muted-foreground hover:bg-white/60"
              )}
            >
              <span className="block text-sm font-medium text-foreground">
                {option.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {option.detail}
              </span>
            </button>
          );
        })}
      </div>

      {selected === "custom" && !disabled && (
        <SpamProtectionFields
          threshold={threshold}
          windowSeconds={windowSeconds}
          onSave={onSave}
        />
      )}

      <p className="text-sm text-muted-foreground">
        Review a contact after {threshold} message{threshold === 1 ? "" : "s"}{" "}
        within {windowSeconds} second{windowSeconds === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
