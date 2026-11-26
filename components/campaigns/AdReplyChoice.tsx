import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import {
  getBotFlowTriggers,
  isNoPublishedFlowError
} from "@/client-api/functions/bot";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AD_REPLY_OPTIONS,
  AD_REPLY_TEXT_MAX,
  AdReplyChoiceMode,
  AdReplyDraft,
  adReplyFlowChoices
} from "@/lib/adReplies";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

/** The bot's live flows an ad can start (not subscribe/unsubscribe). */
export function useAdReplyFlows(enabled: boolean) {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const query = useQuery({
    queryKey: ["ad-reply-flows", orgId],
    queryFn: getBotFlowTriggers,
    enabled: enabled && Boolean(orgId),
    retry: (count, error) => !isNoPublishedFlowError(error) && count < 2
  });
  const flows = useMemo(
    () => adReplyFlowChoices(query.data?.data?.triggers),
    [query.data?.data?.triggers]
  );
  return { flows, isLoading: enabled && query.isLoading };
}

/**
 * The reply choice, shared by the all-ads card and one ad's dialog: normal
 * bot reply, a typed message, or a flow. `withDefault` adds "Same as all
 * ads" first, for one ad.
 */
export function AdReplyChoice({
  value,
  onChange,
  flows,
  flowsLoading,
  withDefault = false,
  disabled = false,
  problem = "",
  idPrefix
}: {
  value: AdReplyDraft;
  onChange: (next: AdReplyDraft) => void;
  flows: ReturnType<typeof useAdReplyFlows>["flows"];
  flowsLoading: boolean;
  withDefault?: boolean;
  disabled?: boolean;
  /** Shown under the text box or flow picker after a save attempt. */
  problem?: string;
  idPrefix: string;
}) {
  const options = AD_REPLY_OPTIONS.filter(
    (option) => withDefault || option.value !== "default"
  );
  const flowIsLive = flows.some((flow) => flow.triggerKey === value.triggerKey);

  return (
    <RadioGroup
      value={value.mode}
      disabled={disabled}
      onValueChange={(mode) =>
        onChange({ ...value, mode: mode as AdReplyChoiceMode })
      }
      className="gap-2"
      aria-label="Reply"
    >
      {options.map((option) => {
        const id = `${idPrefix}-${option.value}`;
        const selected = value.mode === option.value;
        return (
          <div
            key={option.value}
            className={cn(
              "rounded-lg border p-3",
              selected && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-start gap-2.5">
              <RadioGroupItem
                id={id}
                value={option.value}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <Label htmlFor={id} className="cursor-pointer text-sm">
                  {option.label}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {option.help}
                </p>
              </div>
            </div>

            {selected && option.value === "message" && (
              <div className="mt-3 space-y-1.5">
                <Textarea
                  value={value.text}
                  rows={4}
                  maxLength={AD_REPLY_TEXT_MAX}
                  disabled={disabled}
                  aria-label="Message to send"
                  aria-invalid={Boolean(problem)}
                  placeholder="Thanks for your interest! Here's what we offer…"
                  onChange={(event) =>
                    onChange({ ...value, text: event.target.value })
                  }
                />
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-destructive">{problem}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {value.text.length}/{AD_REPLY_TEXT_MAX}
                  </span>
                </div>
              </div>
            )}

            {selected && option.value === "flow" && (
              <div className="mt-3 space-y-1.5">
                {flowsLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Loading your flows…
                  </p>
                ) : flows.length ? (
                  <Select
                    value={flowIsLive ? value.triggerKey : ""}
                    disabled={disabled}
                    onValueChange={(triggerKey) =>
                      onChange({ ...value, triggerKey })
                    }
                  >
                    <SelectTrigger
                      className="w-full bg-white sm:max-w-sm"
                      aria-label="Flow to start"
                      aria-invalid={Boolean(problem)}
                    >
                      <SelectValue placeholder="Choose a flow" />
                    </SelectTrigger>
                    <SelectContent>
                      {flows.map((flow) => (
                        <SelectItem
                          key={flow.triggerKey}
                          value={flow.triggerKey}
                        >
                          {flow.name || "Untitled flow"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You have no live flows yet. Publish one in{" "}
                    <Link
                      href="/bot/flows"
                      className="font-medium text-primary hover:underline"
                    >
                      Bot flows
                    </Link>{" "}
                    first.
                  </p>
                )}
                {!flowsLoading && value.triggerKey && !flowIsLive && (
                  <p className="text-xs text-amber-700">
                    The chosen flow isn&apos;t live any more. Choose another
                    one.
                  </p>
                )}
                {problem && (
                  <p className="text-xs text-destructive">{problem}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </RadioGroup>
  );
}
