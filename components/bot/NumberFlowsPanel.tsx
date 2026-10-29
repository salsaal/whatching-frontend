import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { AlertTriangle, Radio } from "lucide-react";
import { toast } from "sonner";

import { updateBotCanvasStatus } from "@/client-api/functions/bot";
import { updateWhatsAppPhoneNumber } from "@/client-api/functions/organizations";
import { BotCanvasRecord } from "@/client-api/types/bot.type";
import { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
import { BotOffBanner } from "@/components/bot/BotOffBanner";
import {
  Select,
  SelectContent,
  SelectItem,
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

const numberLabel = (number: WhatsAppPhoneNumber) =>
  number.displayPhoneNumber || number.phoneNumberId;

function FlowSelect({
  value,
  publishedCanvases,
  disabled,
  className,
  onChange
}: {
  value: string;
  publishedCanvases: BotCanvasRecord[];
  disabled?: boolean;
  className?: string;
  onChange: (canvasId: string) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Pick a flow" />
      </SelectTrigger>
      <SelectContent>
        {publishedCanvases.map((canvas) => (
          <SelectItem key={canvas._id} value={canvas._id}>
            {canvas.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumberFlowRow({
  number,
  canvases,
  publishedCanvases,
  effectiveCanvas,
  defaultCanvas,
  canManage,
  isSaving,
  onChange
}: {
  number: WhatsAppPhoneNumber;
  canvases: BotCanvasRecord[];
  publishedCanvases: BotCanvasRecord[];
  effectiveCanvas: BotCanvasRecord | null;
  defaultCanvas: BotCanvasRecord | null;
  canManage: boolean;
  isSaving: boolean;
  onChange: (canvasId: string) => void;
}) {
  const assignedId = number.activeCanvasId || "";
  // Assigned to a draft or deleted flow: the backend runs the default
  // instead, so the dropdown shows that and the note explains why.
  const isStale =
    Boolean(assignedId) &&
    !publishedCanvases.some((canvas) => canvas._id === assignedId);
  const staleName =
    canvases.find((canvas) => canvas._id === assignedId)?.name ||
    "The flow picked for this number";

  const select = (
    <FlowSelect
      value={effectiveCanvas?._id || ""}
      publishedCanvases={publishedCanvases}
      disabled={!canManage || isSaving}
      className="w-full sm:w-72"
      onChange={onChange}
    />
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
          {defaultCanvas
            ? `${staleName} isn't published, so ${defaultCanvas.name} is running instead.`
            : `${staleName} isn't published, so nothing is running.`}
        </p>
      )}
    </div>
  );
}

// One row per number showing the flow that actually runs there (its own
// pick, else the organisation default), plus the default itself for 2+
// numbers, framed as what new numbers start with.
export function NumberFlowsPanel() {
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const { can } = useCurrentMembership();
  const canManageNumbers = can("whatsapp_numbers:manage");
  const canViewNumbers = can("whatsapp_numbers:view");
  const {
    canvases,
    publishedCanvases,
    defaultCanvas,
    numbers,
    effectiveCanvasFor
  } = useLiveFlows();

  const handleError = (error: AxiosError<{ message?: string }>) => {
    toast.error(error.response?.data?.message || "Couldn't change the flow.");
  };

  const { mutate: setDefault, isPending: isSavingDefault } = useMutation({
    mutationFn: updateBotCanvasStatus,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Flow for new numbers updated.");
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
      toast.success("Flow updated.");
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp-phone-numbers", orgId]
      });
    },
    onError: handleError
  });

  return (
    <section className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
      <div>
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <h2 className="font-heading text-base font-semibold">
            Flow on each number
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which flow answers on each of your WhatsApp numbers.
        </p>
      </div>

      <BotOffBanner message="The bot is off, so these flows aren't running." />

      {!publishedCanvases.length && (
        <p className="text-xs text-muted-foreground">
          Publish a flow to pick it here.
        </p>
      )}

      {numbers.length > 0 ? (
        <div className="divide-y">
          {numbers.map((number) => (
            <NumberFlowRow
              key={number.id}
              number={number}
              canvases={canvases}
              publishedCanvases={publishedCanvases}
              effectiveCanvas={effectiveCanvasFor(number)}
              defaultCanvas={defaultCanvas}
              canManage={canManageNumbers}
              isSaving={isAssigning}
              onChange={(activeCanvasId) =>
                assignFlow({ phoneNumberRecordId: number.id, activeCanvasId })
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canViewNumbers
            ? "Connect a WhatsApp number to choose its flow."
            : "You need WhatsApp numbers → View access to see your numbers."}
        </p>
      )}

      {numbers.length >= 2 && (
        <div className="space-y-1 border-t pt-3">
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
            <span className="text-muted-foreground">
              New numbers start with:
            </span>
            <FlowSelect
              value={defaultCanvas?._id || ""}
              publishedCanvases={publishedCanvases}
              disabled={isSavingDefault}
              className="h-8 w-full sm:w-56"
              onChange={(canvasId) =>
                setDefault({ canvasId, status: "active" })
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Used for any number you haven&apos;t picked a flow for, including
            numbers you connect later.
          </p>
        </div>
      )}
    </section>
  );
}
