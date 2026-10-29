import { useQuery } from "@tanstack/react-query";

import { listBotCanvases } from "@/client-api/functions/bot";
import { BotCanvasRecord } from "@/client-api/types/bot.type";
import {
  isUsableWhatsAppNumber,
  useWhatsAppNumberContext
} from "@/components/whatsapp/WhatsAppNumberSwitcher";
import { useOrganizationStore } from "@/stores/organizationStore";

export const isPublishedCanvas = (canvas: BotCanvasRecord) =>
  Boolean(canvas.latestPublishedVersionId || canvas.publishedState);

// Mirrors how the backend picks a flow for an incoming WhatsApp message: the
// number's own activeCanvasId when that flow is published, otherwise the
// organisation default (the one canvas with status "active").
export function useLiveFlows() {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const { numbers: allNumbers, isLoading: isNumbersLoading } =
    useWhatsAppNumberContext();

  const canvasesQuery = useQuery({
    queryKey: ["bot-canvases", orgId],
    queryFn: listBotCanvases,
    enabled: Boolean(orgId),
    refetchOnMount: "always"
  });

  const canvases = [...(canvasesQuery.data?.data?.canvases || [])]
    .filter((canvas) => canvas.status !== "archived")
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  const publishedCanvases = canvases.filter(isPublishedCanvas);
  const publishedById = new Map(
    publishedCanvases.map((canvas) => [canvas._id, canvas])
  );
  const defaultCanvas =
    publishedCanvases.find((canvas) => canvas.status === "active") || null;
  const numbers = allNumbers.filter(isUsableWhatsAppNumber);

  // The flow a number has picked for itself, if it's still usable.
  const assignedCanvasFor = (number: (typeof numbers)[number]) =>
    number.activeCanvasId
      ? publishedById.get(number.activeCanvasId) || null
      : null;

  // What actually runs on a number: its own flow, else the default.
  const effectiveCanvasFor = (number: (typeof numbers)[number]) =>
    assignedCanvasFor(number) || defaultCanvas;

  const isNothingLive =
    !defaultCanvas && !numbers.some((number) => assignedCanvasFor(number));

  return {
    ...canvasesQuery,
    isLoading: canvasesQuery.isLoading || isNumbersLoading,
    canvases,
    publishedCanvases,
    defaultCanvas,
    numbers,
    assignedCanvasFor,
    effectiveCanvasFor,
    isNothingLive
  };
}
