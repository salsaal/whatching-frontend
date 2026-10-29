import { AlertTriangle, CheckCircle2, Lock, X } from "lucide-react";
import { KeyboardEvent, useMemo, useState } from "react";

import { PausedNote } from "@/components/bot/SettingRow";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_KEYWORDS = 50;

// Mirrors the backend's normalizeKeyword, so what you see is exactly what
// gets compared: trimmed, whitespace collapsed, case-insensitive.
export const normalizeKeyword = (value: string) =>
  value.trim().replace(/\s+/g, " ").toUpperCase();

export const BUILT_IN_OPT_OUT_KEYWORDS = [
  "STOP",
  "UNSUBSCRIBE",
  "OPT OUT",
  "OPTOUT",
  "CANCEL"
];
export const BUILT_IN_OPT_IN_KEYWORDS = [
  "START",
  "SUBSCRIBE",
  "OPT IN",
  "OPTIN",
  "RESUBSCRIBE"
];

export interface KeywordListProps {
  /** The stored list. Built-ins in it (from older defaults) are ignored. */
  value: string[];
  /** Words the backend always matches; shown locked, never sent. */
  builtIns?: string[];
  /** Receives the extras only, already normalized and de-duplicated. */
  onSave: (next: string[]) => void;
}

// Stored lists only ever need the extras: the backend adds the built-ins
// itself, and older orgs have them saved as their default list.
export const toExtraKeywords = (value: string[], builtIns: string[] = []) => {
  const locked = new Set(builtIns.map(normalizeKeyword));
  const seen = new Set<string>();
  return value.map(normalizeKeyword).filter((word) => {
    if (!word || locked.has(word) || seen.has(word)) return false;
    seen.add(word);
    return true;
  });
};

function Chip({
  word,
  locked,
  tone,
  onRemove
}: {
  word: string;
  locked?: boolean;
  tone?: "warning";
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        locked ? "bg-muted text-muted-foreground" : "bg-white",
        tone === "warning" && "border-amber-300 bg-amber-50 text-amber-900"
      )}
    >
      {locked && <Lock className="size-3" />}
      {word}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${word}`}
          className="-mr-1 rounded-full p-0.5 hover:bg-muted"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function KeywordList({
  title,
  description,
  example,
  extrasLabel,
  list,
  readOnly,
  conflictsWith,
  emptyWarning,
  isAlwaysActive,
  pausedLabel
}: {
  title: string;
  description: string;
  example: string;
  extrasLabel?: string;
  list: KeywordListProps;
  readOnly?: boolean;
  /** Keeps working even when the bot/automation switch is off. */
  isAlwaysActive?: boolean;
  /** Shown (and the list muted) while this list isn't running. */
  pausedLabel?: string;
  /** Words that will win over this list; matching chips are flagged. */
  conflictsWith?: { words: Set<string>; message: (word: string) => string };
  emptyWarning?: string;
}) {
  const extras = useMemo(
    () => toExtraKeywords(list.value, list.builtIns),
    [list.value, list.builtIns]
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const locked = list.builtIns || [];
  const isFull = extras.length >= MAX_KEYWORDS;

  const add = () => {
    const word = normalizeKeyword(draft);
    if (!word) return;
    if (locked.map(normalizeKeyword).includes(word)) {
      setError(`${word} is always active already.`);
      return;
    }
    if (extras.includes(word)) {
      setError(`${word} is already in the list.`);
      return;
    }
    if (isFull) {
      setError(`You can add up to ${MAX_KEYWORDS} words.`);
      return;
    }
    setDraft("");
    setError("");
    list.onSave([...extras, word]);
  };

  const remove = (word: string) =>
    list.onSave(extras.filter((item) => item !== word));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    }
  };

  const conflicts = conflictsWith
    ? extras.filter((word) => conflictsWith.words.has(word))
    : [];

  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            {isAlwaysActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3" />
                Always active
              </span>
            )}
            {pausedLabel && <PausedNote label={pausedLabel} />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">e.g. {example}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {extras.length}/{MAX_KEYWORDS}
        </span>
      </div>

      {locked.length > 0 && (
        <div className={cn(pausedLabel && "opacity-60")}>
          <p className="mb-1.5 text-xs text-muted-foreground">Built in</p>
          <div className="flex flex-wrap gap-1.5">
            {locked.map((word) => (
              <Chip key={word} word={word} locked />
            ))}
          </div>
        </div>
      )}

      <div className={cn(pausedLabel && "opacity-60")}>
        {extrasLabel && (
          <p className="mb-1.5 text-xs text-muted-foreground">{extrasLabel}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {extras.map((word) => (
            <Chip
              key={word}
              word={word}
              tone={conflicts.includes(word) ? "warning" : undefined}
              onRemove={readOnly ? undefined : () => remove(word)}
            />
          ))}
          {!extras.length && (
            <span className="text-xs text-muted-foreground">None yet.</span>
          )}
        </div>
      </div>

      {!readOnly && (
        <div>
          <Input
            value={draft}
            disabled={isFull}
            placeholder={
              isFull
                ? `Maximum ${MAX_KEYWORDS} words`
                : "Type a word and press Enter"
            }
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError("");
            }}
            onKeyDown={handleKeyDown}
            onBlur={add}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      )}

      {conflicts.map((word) => (
        <p key={word} className="flex gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {conflictsWith?.message(word)}
        </p>
      ))}

      {emptyWarning && !extras.length && (
        <p className="flex gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {emptyWarning}
        </p>
      )}
    </div>
  );
}

// Each list is optional so channels with fewer keyword lists (Instagram has
// no opt-in list) can reuse this.
export function KeywordsSection({
  greeting,
  optIn,
  optOut,
  readOnly,
  greetingPausedLabel
}: {
  greeting?: KeywordListProps;
  optIn?: KeywordListProps;
  optOut?: KeywordListProps;
  readOnly?: boolean;
  /** Set while the bot/automation switch is off: menu keywords stop then,
   * but opt-in/opt-out keep working for compliance. */
  greetingPausedLabel?: string;
}) {
  // Opt-in/opt-out words are checked before greetings, so a greeting that
  // is also one of those can never start the menu.
  const optInWords = useMemo(
    () =>
      new Set(
        [...(optIn?.builtIns || []), ...(optIn?.value || [])].map(
          normalizeKeyword
        )
      ),
    [optIn?.builtIns, optIn?.value]
  );
  const optOutWords = useMemo(
    () =>
      new Set(
        [...(optOut?.builtIns || []), ...(optOut?.value || [])].map(
          normalizeKeyword
        )
      ),
    [optOut?.builtIns, optOut?.value]
  );
  const consentWords = useMemo(
    () => new Set([...optInWords, ...optOutWords]),
    [optInWords, optOutWords]
  );

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">
        A message must be exactly this word (case doesn&apos;t matter).
      </p>
      <div className="divide-y">
        {greeting && (
          <KeywordList
            title="Menu keywords"
            description="Start your main menu flow. This list replaces the defaults."
            example="HI, HELLO, MENU"
            list={greeting}
            readOnly={readOnly}
            pausedLabel={greetingPausedLabel}
            emptyWarning="Nothing will start the main menu flow from a keyword."
            conflictsWith={{
              words: consentWords,
              message: (word) =>
                `${word} is also an ${optOutWords.has(word) ? "opt-out" : "opt-in"} word. Those are checked first, so it will never start the menu.`
            }}
          />
        )}
        {optOut && (
          <KeywordList
            title="Opt-out keywords"
            description="Stop broadcasts to the contact who sends one."
            example="BAND KARO, NAHI CHAHIYE"
            extrasLabel="Additional opt-out words"
            list={optOut}
            readOnly={readOnly}
            isAlwaysActive
            conflictsWith={
              optIn
                ? {
                    words: optInWords,
                    message: (word) =>
                      `${word} is also an opt-in word. A word should only be in one list.`
                  }
                : undefined
            }
          />
        )}
        {optIn && (
          <KeywordList
            title="Opt-in keywords"
            description="Resume broadcasts for a contact who opted out."
            example="HAAN, CHALU KARO"
            extrasLabel="Additional opt-in words"
            list={optIn}
            readOnly={readOnly}
            isAlwaysActive
          />
        )}
      </div>
    </div>
  );
}
