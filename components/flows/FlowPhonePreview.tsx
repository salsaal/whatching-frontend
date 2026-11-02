import { X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BotAction,
  BotBlockType,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import { WhatsAppFlowBlockPreview } from "@/components/flows/FlowBlockPreview";
import { Button } from "@/components/ui/button";

const WIDE_QUERY = "(min-width: 1024px)";

const useIsWide = () => {
  const [isWide, setIsWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setIsWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isWide;
};

/**
 * A message preview beside the block editor. On wide screens it floats over
 * the canvas, docked to the left edge of the editor, so the editor keeps its
 * own single scroll; below lg it opens as a full-screen sheet.
 */
export function FloatingBlockPreview({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const isWide = useIsWide();
  if (!open) return null;

  const header = (
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-xs font-medium text-muted-foreground">
        Preview · {title}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label="Close preview"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
    </div>
  );

  if (isWide) {
    return (
      <div
        role="complementary"
        aria-label="Message preview"
        className="absolute right-full top-3 mr-3 max-h-[calc(100%-1.5rem)] w-[300px] space-y-1 overflow-y-auto rounded-xl border bg-white p-2 shadow-lg"
      >
        {header}
        {children}
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Message preview"
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <div className="border-b px-4 py-2">{header}</div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
        <div className="mx-auto max-w-sm">{children}</div>
      </div>
    </div>
  );
}

/** The selected WhatsApp block as the customer sees it. */
export function FlowPhonePreview({
  open,
  onClose,
  title,
  blockType,
  content,
  actions
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  blockType: BotBlockType;
  content: BotCanvasNodeContent;
  actions: BotAction[];
}) {
  return (
    <FloatingBlockPreview open={open} onClose={onClose} title={title}>
      <WhatsAppFlowBlockPreview
        blockType={blockType}
        content={content}
        actions={actions}
        showClose={false}
      />
    </FloatingBlockPreview>
  );
}
