import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { AlertTriangle, Radio } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { updateBotCanvasStatus } from "@/client-api/functions/bot";
import { updateWhatsAppPhoneNumber } from "@/client-api/functions/organizations";
import { BotCanvasRecord } from "@/client-api/types/bot.type";
import { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
import { BotOffBanner } from "@/components/bot/BotOffBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { useLiveFlows } from "@/hooks/useLiveFlows";
import { useOrganizationStore } from "@/stores/organizationStore";

const NO_DEFAULT = "__none__";
const SAME_AS_DEFAULT = "__default__";
const UNAVAILABLE = "__unavailable__";

const numberLabel = (number: WhatsAppPhoneNumber) =>
  number.displayPhoneNumber || number.phoneNumberId;

function NumberFlowRow({
  number,
  canvases,
  publishedCanvases,
  canManage,
  isSaving,
  onChange
}: {
  number: WhatsAppPhoneNumber;
  canvases: BotCanvasRecord[];
  publishedCanvases: BotCanvasRecord[];
  canManage: boolean;
  isSaving: boolean;
  onChange: (activeCanvasId: string) => void;
}) {
  const assignedId = number.activeCanvasId || "";
  const isAssignedPublished = publishedCanvases.some(
    (canvas) => canvas._id === assignedId
  );
  // An assignment to a draft or deleted flow: the backend falls back to the
  // default, so say so and keep the stale choice visible in the dropdown.
  const isStale = Boolean(assignedId) && !isAssignedPublished;
  const staleName = canvases.find((canvas) => canvas._id === assignedId)?.name;
  const value = !assignedId
    ? SAME_AS_DEFAULT
    : isStale
      ? UNAVAILABLE
      : assignedId;

  const select = (
    <Select
      value={value}
      disabled={!canManage || isSaving}
      onValueChange={(next) => onChange(next === SAME_AS_DEFAULT ? "" : next)}
    >
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SAME_AS_DEFAULT}>Same as default</SelectItem>
        {publishedCanvases.length > 0 && <SelectSeparator />}
        {publishedCanvases.map((canvas) => (
          <SelectItem key={canvas._id} value={canvas._id}>
            {canvas.name}
          </SelectItem>
        ))}
        {isStale && (
          <SelectItem value={UNAVAILABLE} disabled>
            {staleName ? `${staleName} (not published)` : "Unavailable flow"}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{numberLabel(number)}</p>
          {number.verifiedName && (
            <p className="truncate text-xs text-muted-foreground">
              {number.verifiedName}
            </p>
          )}
        </div>
        {canManage ? (
          select
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Disabled controls swallow hover, so the span carries it. */}
              <span tabIndex={0} className="block w-full sm:w-72">
                {select}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              You need WhatsApp numbers → Manage access
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {isStale && (
        <p className="flex gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          This flow isn&apos;t published, so the default is used.
        </p>
      )}
    </div>
  );
}

// Decides which flow answers on each WhatsApp number: one organisation
// default, plus optional per-number overrides when there are 2+ numbers.
export function LiveFlowsPanel() {
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const { can } = useCurrentMembership();
  const canManageNumbers = can("whatsapp_numbers:manage");
  const { canvases, publishedCanvases, defaultCanvas, numbers } =
    useLiveFlows();
  const [isConfirmingNoDefault, setIsConfirmingNoDefault] = useState(false);

  const handleError = (error: AxiosError<{ message?: string }>) => {
    toast.error(error.response?.data?.message || "Couldn't update live flows.");
  };

  const { mutate: setCanvasStatus, isPending: isSavingDefault } = useMutation({
    mutationFn: updateBotCanvasStatus,
    meta: { showToast: false },
    onSuccess: async (_response, variables) => {
      toast.success(
        variables.status === "active"
          ? "Default flow updated."
          : "Default flow removed."
      );
      setIsConfirmingNoDefault(false);
      await queryClient.invalidateQueries({
        queryKey: ["bot-canvases", orgId]
      });
    },
    onError: handleError
  });

  const { mutate: assignFlow, isPending: isAssigning } = useMutation({
    mutationFn: updateWhatsAppPhoneNumber,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Live flow updated.");
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp-phone-numbers", orgId]
      });
    },
    onError: handleError
  });

  const isSingleNumber = numbers.length < 2;
  // With one number only the default matters -- unless that number still
  // carries its own assignment from before, which would override it.
  const numberRows = isSingleNumber
    ? numbers.filter((number) => number.activeCanvasId)
    : numbers;

  return (
    <section className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-primary" />
        <h2 className="font-heading text-base font-semibold">Live flows</h2>
      </div>

      <BotOffBanner message="The bot is off, so live flows aren't running." />

      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          {isSingleNumber ? "Live flow" : "Default flow"}
        </p>
        <Select
          value={defaultCanvas?._id || NO_DEFAULT}
          disabled={isSavingDefault}
          onValueChange={(next) => {
            if (next === NO_DEFAULT) {
              if (defaultCanvas) setIsConfirmingNoDefault(true);
              return;
            }
            setCanvasStatus({ canvasId: next, status: "active" });
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT}>
              {isSingleNumber ? "No live flow" : "No default flow"}
            </SelectItem>
            {publishedCanvases.length > 0 && <SelectSeparator />}
            {publishedCanvases.map((canvas) => (
              <SelectItem key={canvas._id} value={canvas._id}>
                {canvas.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isSingleNumber && (
          <p className="text-xs text-muted-foreground">
            Answers on every number unless you pick another flow below.
          </p>
        )}
        {!publishedCanvases.length && (
          <p className="text-xs text-muted-foreground">
            Publish a flow to make it available here.
          </p>
        )}
      </div>

      {numberRows.length > 0 && (
        <div className="divide-y border-t pt-3">
          {numberRows.map((number) => (
            <NumberFlowRow
              key={number.id}
              number={number}
              canvases={canvases}
              publishedCanvases={publishedCanvases}
              canManage={canManageNumbers}
              isSaving={isAssigning}
              onChange={(activeCanvasId) =>
                assignFlow({ phoneNumberRecordId: number.id, activeCanvasId })
              }
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={isConfirmingNoDefault}
        onOpenChange={setIsConfirmingNoDefault}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSingleNumber
                ? "Remove the live flow?"
                : "Remove the default flow?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Numbers without their own flow won&apos;t get any automated
              replies: no flows and no AI Assistant. Opt-out keywords still
              work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSavingDefault || !defaultCanvas}
              onClick={(event) => {
                event.preventDefault();
                if (defaultCanvas)
                  setCanvasStatus({
                    canvasId: defaultCanvas._id,
                    status: "inactive"
                  });
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
