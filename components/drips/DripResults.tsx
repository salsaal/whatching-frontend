import { CheckCircle2, Clock, LogOut, Users } from "lucide-react";

import {
  DripContactStatus,
  DripReport,
  DripStepReport,
  DripWaitingReason
} from "@/client-api/types/drips.type";
import {
  formatCount,
  formatPercent,
  humanizeTemplateName
} from "@/lib/displayFormat";
import { DRIP_WAITING_TEXT } from "@/lib/drips";
import { cn } from "@/lib/utils";

type Column = {
  key: keyof Omit<DripStepReport, "step" | "templateName">;
  label: string;
  /** Shown even when every message has 0. */
  always?: boolean;
  /** As a share of Sent. */
  ofSent?: boolean;
};

const COLUMNS: Column[] = [
  { key: "sent", label: "Sent", always: true },
  { key: "delivered", label: "Delivered", always: true, ofSent: true },
  { key: "read", label: "Read", always: true, ofSent: true },
  { key: "replied", label: "Replied", always: true, ofSent: true },
  { key: "stoppedOffers", label: "Stopped offers" },
  { key: "notDelivered", label: "Not delivered" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
  { key: "retrying", label: "Retrying" }
];

const HELP: Partial<Record<Column["key"], string>> = {
  notDelivered:
    "WhatsApp limits how many offers one person gets from all businesses. We tried once more a day later.",
  retrying:
    "Waiting for that second try, or for your daily sending limit to reset."
};

function Tile({
  label,
  value,
  sub,
  icon: Icon,
  onClick
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "rounded-lg bg-white p-4 text-left shadow-xs transition",
        onClick && "cursor-pointer hover:ring-1 hover:ring-primary/30"
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </span>
      <span className="mt-2 block font-heading text-2xl font-semibold">
        {formatCount(value)}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

/** A started drip's numbers: who's where, how each message did, who left. */
export function DripResults({
  report,
  onShowPeople
}: {
  report: DripReport;
  onShowPeople: (status: DripContactStatus, stopReason?: string) => void;
}) {
  const totals = report.drip.contacts;
  const waiting = (
    Object.entries(report.waiting || {}) as Array<[DripWaitingReason, number]>
  ).filter(([reason, count]) => count > 0 && DRIP_WAITING_TEXT[reason]);
  const columns = COLUMNS.filter(
    (column) =>
      column.always || report.steps.some((step) => step[column.key] > 0)
  );
  const helpShown = columns.filter((column) => HELP[column.key]);
  const stopReasons = [...report.stopReasons]
    .filter((reason) => reason.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Joined"
          value={totals.total}
          sub="Everyone who has joined so far"
          icon={Users}
        />
        <Tile
          label="In progress"
          value={totals.active}
          sub="Still getting messages"
          icon={Clock}
          onClick={() => onShowPeople("active")}
        />
        <Tile
          label="Finished"
          value={totals.completed}
          sub="Got every message"
          icon={CheckCircle2}
          onClick={() => onShowPeople("completed")}
        />
        <Tile
          label="Left early"
          value={totals.stopped}
          sub="Replied, stopped offers or were removed"
          icon={LogOut}
          onClick={() => onShowPeople("stopped")}
        />
      </div>

      {waiting.length > 0 && (
        <section className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-4 text-sm shadow-xs">
          <span className="font-medium">Waiting right now:</span>
          {waiting.map(([reason, count]) => (
            <span
              key={reason}
              className="rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {formatCount(count)} · {DRIP_WAITING_TEXT[reason]}
            </span>
          ))}
        </section>
      )}

      <section className="rounded-lg bg-white shadow-xs">
        <div className="border-b p-4">
          <h2 className="font-heading text-lg font-semibold">
            How each message did
          </h2>
        </div>
        {report.steps.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Message</th>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className="px-3 py-3 text-right font-medium whitespace-nowrap"
                      >
                        {column.label}
                        {HELP[column.key] && (
                          <sup className="ml-0.5 text-[10px]">
                            {helpShown.indexOf(column) + 1}
                          </sup>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.steps.map((step) => (
                    <tr key={step.step} className="border-b last:border-0">
                      <td className="max-w-56 px-4 py-3">
                        <p className="font-medium">Message {step.step}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {humanizeTemplateName(step.templateName)}
                        </p>
                      </td>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className="px-3 py-3 text-right tabular-nums"
                        >
                          {formatCount(step[column.key])}
                          {column.ofSent && step.sent > 0 && (
                            <span className="block text-[11px] text-muted-foreground">
                              {formatPercent(step[column.key], step.sent)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y md:hidden">
              {report.steps.map((step) => (
                <li key={step.step} className="space-y-2 p-4">
                  <p className="text-sm">
                    <span className="font-medium">Message {step.step}</span>{" "}
                    <span className="text-muted-foreground">
                      · {humanizeTemplateName(step.templateName)}
                    </span>
                  </p>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    {columns.map((column) => (
                      <div
                        key={column.key}
                        className="rounded-md bg-muted/40 p-2"
                      >
                        <dt className="text-muted-foreground">
                          {column.label}
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {formatCount(step[column.key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            {helpShown.length > 0 && (
              <div className="space-y-1 border-t p-4 text-xs text-muted-foreground">
                {helpShown.map((column, index) => (
                  <p key={column.key}>
                    <span className="hidden md:inline">{index + 1}. </span>
                    <span className="font-medium text-foreground">
                      {column.label}:
                    </span>{" "}
                    {HELP[column.key]}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {stopReasons.length > 0 && (
        <section className="rounded-lg bg-white shadow-xs">
          <div className="border-b p-4">
            <h2 className="font-heading text-lg font-semibold">
              Why people left early
            </h2>
          </div>
          <ul className="divide-y">
            {stopReasons.map((reason) => (
              <li key={reason.reason}>
                <button
                  type="button"
                  onClick={() => onShowPeople("stopped", reason.reason)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-muted/40"
                >
                  <span>{reason.text || "Other reason"}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatCount(reason.count)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
