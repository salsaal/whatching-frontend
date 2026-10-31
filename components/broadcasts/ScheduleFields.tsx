import { CalendarIcon, Clock, Send } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SendMode = "now" | "schedule";

export interface ScheduleValue {
  mode: SendMode;
  date?: Date;
  time: string;
}

export const DEFAULT_SCHEDULE: ScheduleValue = { mode: "now", time: "09:00" };

const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, "0");
  const minutes = String((index % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});

const timeLabel = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours < 12 ? "am" : "pm";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const dateLabel = (date?: Date) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(date)
    : "Pick a date";

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const combine = (date: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

/** "2026-10-30T11:00", the local wall-clock time the backend schedules by. */
export const buildScheduledLocal = (value: ScheduleValue) => {
  if (value.mode !== "schedule" || !value.date) return undefined;
  const date = value.date;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T${value.time}`;
};

/** Why the schedule can't be used yet, or "" when it's fine. */
export const scheduleProblem = (value: ScheduleValue) => {
  if (value.mode !== "schedule") return "";
  if (!value.date) return "Pick a date to schedule.";
  if (combine(value.date, value.time).getTime() <= Date.now()) {
    return "Pick a time in the future.";
  }
  return "";
};

// Send now / Schedule, with a date and a 15-minute time. Shared by the
// wizard's last step and the Start-or-schedule sheet for existing drafts.
export function ScheduleFields({
  value,
  onChange,
  timezone,
  disabled
}: {
  value: ScheduleValue;
  onChange: (next: ScheduleValue) => void;
  timezone: string;
  disabled?: boolean;
}) {
  const isToday =
    value.date && value.date.toDateString() === new Date().toDateString();
  const now = new Date();
  const problem = scheduleProblem(value);

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="When to send"
        className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1"
      >
        {(
          [
            ["now", "Send now", Send],
            ["schedule", "Schedule", CalendarIcon]
          ] as const
        ).map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value.mode === mode}
            disabled={disabled}
            onClick={() =>
              onChange({
                ...value,
                mode,
                date:
                  mode === "schedule" ? value.date || new Date() : value.date
              })
            }
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-sm py-2 text-sm font-medium transition",
              value.mode === mode
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {value.mode === "schedule" && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-sm border bg-white px-3 text-left text-sm"
                >
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  {dateLabel(value.date)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value.date}
                  onSelect={(date) =>
                    onChange({ ...value, date: date || undefined })
                  }
                  disabled={{ before: startOfToday() }}
                />
              </PopoverContent>
            </Popover>
            <Select
              value={value.time}
              onValueChange={(time) => onChange({ ...value, time })}
              disabled={disabled}
            >
              <SelectTrigger className="h-11 w-full bg-white">
                <Clock className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {QUARTER_HOURS.map((time) => (
                  <SelectItem
                    key={time}
                    value={time}
                    disabled={Boolean(
                      isToday && value.date && combine(value.date, time) <= now
                    )}
                  >
                    {timeLabel(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Times are in {timezone}.
          </p>
          {problem && <p className="text-xs text-destructive">{problem}</p>}
        </div>
      )}
    </div>
  );
}
