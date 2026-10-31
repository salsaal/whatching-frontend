import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import {
  getBotCanvasTriggers,
  isNoPublishedFlowError
} from "@/client-api/functions/bot";
import { TemplateButton } from "@/client-api/types/templates.type";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";

export const MAIN_MENU_ROUTE = "__main_menu__";
const GROUP_TRIGGERS_AFTER = 8;

const blockTypeLabel = (type: string) =>
  type.replace(/[_-]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

export interface QuickReplyButtonEntry {
  button: TemplateButton;
  index: number;
}

/**
 * The live flow's blocks for a sender. "Main menu" is what the backend runs
 * when no block is picked, so every quick reply always gets a route.
 */
export function useQuickReplyTriggers(
  senderPhoneNumberId: string,
  enabled: boolean
) {
  const { can } = useCurrentMembership();
  const query = useQuery({
    queryKey: ["bot-canvas-triggers", senderPhoneNumberId],
    queryFn: () => getBotCanvasTriggers(senderPhoneNumberId),
    enabled:
      enabled && Boolean(senderPhoneNumberId) && can("broadcasts:manage"),
    refetchOnMount: "always",
    retry: (count, error) => !isNoPublishedFlowError(error) && count < 2
  });
  const defaultTriggerKey = query.data?.data?.defaultTriggerKey || "DEFAULT";
  const blockTriggers = useMemo(
    () =>
      (query.data?.data?.triggers || []).filter(
        (trigger) => trigger.triggerKey !== defaultTriggerKey
      ),
    [defaultTriggerKey, query.data?.data?.triggers]
  );
  const triggerKeys = useMemo(
    () => new Set(query.data?.data?.triggerKeys || []),
    [query.data?.data?.triggerKeys]
  );
  return {
    defaultTriggerKey,
    blockTriggers,
    triggerKeys,
    hasNoLiveFlow: isNoPublishedFlowError(query.error),
    isLoading:
      enabled && Boolean(senderPhoneNumberId) && !query.data && !query.error
  };
}

/** Every quick reply with a route: the picked block, else the main menu. */
export const resolveQuickReplyRoutes = (
  buttons: QuickReplyButtonEntry[],
  picks: Record<number, string>,
  triggerKeys: Set<string>,
  defaultTriggerKey: string
) =>
  buttons.map(({ button, index }) => {
    const picked = picks[index];
    return {
      index,
      label: button.text || `Quick reply ${index + 1}`,
      triggerKey: picked && triggerKeys.has(picked) ? picked : defaultTriggerKey
    };
  });

export function NoLiveFlowCallout() {
  return (
    <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="space-y-1">
        <p>
          Quick replies need a live flow on this number. Without one, Meta
          delivers the buttons but nothing happens when customers tap them.
        </p>
        <Link
          href="/bot/flows"
          className="font-medium text-amber-900 underline-offset-2 hover:underline"
        >
          Set a flow →
        </Link>
      </div>
    </div>
  );
}

export function QuickReplyRouting({
  buttons,
  picks,
  onChange,
  triggers,
  senderLabel,
  flowName,
  disabled
}: {
  buttons: QuickReplyButtonEntry[];
  picks: Record<number, string>;
  onChange: (index: number, triggerKey: string) => void;
  triggers: ReturnType<typeof useQuickReplyTriggers>;
  senderLabel?: string;
  flowName?: string;
  disabled?: boolean;
}) {
  if (!buttons.length) return null;
  if (triggers.hasNoLiveFlow) return <NoLiveFlowCallout />;

  const groups = triggers.blockTriggers.reduce<
    Record<string, typeof triggers.blockTriggers>
  >((acc, trigger) => {
    const type = String(trigger.blockType || "other");
    (acc[type] ||= []).push(trigger);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-muted-foreground">
        When someone taps a button, the bot starts the flow block you choose.
        {senderLabel && (
          <>
            {" "}
            Taps start blocks in the flow live on {senderLabel}
            {flowName ? (
              <>
                :{" "}
                <span className="font-semibold text-foreground">
                  {flowName}
                </span>
              </>
            ) : null}
            .
          </>
        )}
      </p>
      {buttons.map(({ button, index }) => {
        const picked = picks[index];
        const value =
          picked && triggers.triggerKeys.has(picked) ? picked : MAIN_MENU_ROUTE;
        return (
          <div
            key={`${button.text}-${index}`}
            className="grid gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)] sm:items-center"
          >
            <p className="truncate text-sm font-medium">
              ↩ {button.text || `Quick reply ${index + 1}`}
            </p>
            <Select
              value={value}
              disabled={disabled || triggers.isLoading}
              onValueChange={(next) =>
                onChange(index, next === MAIN_MENU_ROUTE ? "" : next)
              }
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MAIN_MENU_ROUTE}>
                  Main menu (default)
                </SelectItem>
                {triggers.blockTriggers.length > 0 && <SelectSeparator />}
                {triggers.blockTriggers.length > GROUP_TRIGGERS_AFTER
                  ? Object.entries(groups).map(([type, items]) => (
                      <SelectGroup key={type}>
                        <SelectLabel>{blockTypeLabel(type)}</SelectLabel>
                        {items.map((trigger) => (
                          <SelectItem
                            key={trigger.triggerKey}
                            value={trigger.triggerKey}
                          >
                            {trigger.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  : triggers.blockTriggers.map((trigger) => (
                      <SelectItem
                        key={trigger.triggerKey}
                        value={trigger.triggerKey}
                      >
                        {trigger.name}
                        <span className="ml-2 rounded-sm bg-muted px-1.5 text-[11px] text-muted-foreground">
                          {blockTypeLabel(String(trigger.blockType || ""))}
                        </span>
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
