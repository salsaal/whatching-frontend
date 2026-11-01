import { Panel } from "@xyflow/react";
import {
  Cable,
  Loader2,
  Map as MapIcon,
  Maximize,
  Redo2,
  Undo2,
  Workflow,
  ZoomIn,
  ZoomOut
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

function ToolButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  pressed,
  spinning
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  spinning?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8", pressed && "bg-primary/10 text-primary")}
      tooltip={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className={cn("size-4", spinning && "animate-spin")} />
    </Button>
  );
}

/** Bottom-left canvas tools; replaces React Flow's default controls. */
export function FlowCanvasToolbar({
  readOnly,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFit,
  onArrange,
  isArranging,
  wiresVisible,
  onToggleWires,
  minimapVisible,
  onToggleMinimap
}: {
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onArrange: () => void;
  isArranging: boolean;
  wiresVisible: boolean;
  onToggleWires: () => void;
  minimapVisible: boolean;
  onToggleMinimap: () => void;
}) {
  return (
    <Panel position="bottom-left">
      <div className="flex flex-col gap-0.5 rounded-lg border bg-white/95 p-1 shadow-sm backdrop-blur">
        <ToolButton
          label={`Undo (${mod}Z)`}
          icon={Undo2}
          disabled={readOnly || !canUndo}
          onClick={onUndo}
        />
        <ToolButton
          label={isMac ? "Redo (⇧⌘Z)" : "Redo (Ctrl+Y)"}
          icon={Redo2}
          disabled={readOnly || !canRedo}
          onClick={onRedo}
        />
        <span className="mx-1 my-0.5 h-px bg-border" />
        <ToolButton label="Zoom in" icon={ZoomIn} onClick={onZoomIn} />
        <ToolButton label="Zoom out" icon={ZoomOut} onClick={onZoomOut} />
        <ToolButton
          label="Fit the whole flow"
          icon={Maximize}
          onClick={onFit}
        />
        <span className="mx-1 my-0.5 h-px bg-border" />
        <ToolButton
          label="Auto-arrange"
          icon={isArranging ? Loader2 : Workflow}
          spinning={isArranging}
          disabled={readOnly || isArranging}
          onClick={onArrange}
        />
        <ToolButton
          label={wiresVisible ? "Hide wires" : "Show wires"}
          icon={Cable}
          pressed={wiresVisible}
          onClick={onToggleWires}
        />
        <ToolButton
          label={minimapVisible ? "Hide map" : "Show map"}
          icon={MapIcon}
          pressed={minimapVisible}
          onClick={onToggleMinimap}
        />
      </div>
    </Panel>
  );
}
