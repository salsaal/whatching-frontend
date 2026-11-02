import {
  Handle,
  NodeProps,
  Position,
  useUpdateNodeInternals
} from "@xyflow/react";
import { ExternalLink } from "lucide-react";
import { Fragment, memo, useEffect, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { getBlockIcon, getBlockLabel } from "./blockCatalog";
import {
  getOutputs,
  IgFlowNode,
  START_LABELS,
  startOf,
  summarizeBlock
} from "./instagramFlow";

const handleClass = "!size-3.5 !border-2 !border-white !bg-primary !shadow-sm";

/** A block on the canvas: like WhatsApp's, one row per output. */
function InstagramFlowNode({ id, data, selected }: NodeProps<IgFlowNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const Icon = getBlockIcon(data.blockType);
  const start = startOf(data);
  const outputs = useMemo(
    () => getOutputs(data),
    // getOutputs only reads these two.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.blockType, data.content]
  );
  const handleKey = outputs
    .filter((output) => output.kind !== "url")
    .map((output) => output.id)
    .join("|");

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleKey, updateNodeInternals]);

  return (
    <div
      className={cn(
        "relative min-w-72 max-w-80 rounded-xl border bg-white shadow-sm transition",
        start === "default" && "border-2 border-primary shadow-md",
        selected && "border-primary shadow-md ring-2 ring-primary/15",
        data.issueSeverity === "error" &&
          "border-destructive ring-2 ring-destructive/15"
      )}
    >
      {data.issueSeverity && (
        <span
          className={cn(
            "absolute -right-1.5 -top-1.5 z-20 size-3.5 rounded-full border-2 border-white shadow-sm",
            data.issueSeverity === "error" ? "bg-destructive" : "bg-amber-500"
          )}
          title={
            data.issueSeverity === "error"
              ? "Has problems to fix"
              : "Has warnings"
          }
          aria-label={
            data.issueSeverity === "error"
              ? "Has problems to fix"
              : "Has warnings"
          }
        />
      )}
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className={handleClass}
      />

      <div className="flex items-start gap-3 border-b px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {data.label}
            </p>
            {data.changed && (
              <span
                className="size-2 shrink-0 rounded-full bg-sky-500"
                title="Pending change"
                aria-label="Pending change"
              />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {start && (
              <Badge
                className={cn(
                  "text-[10px]",
                  start === "default"
                    ? "bg-primary text-white"
                    : "bg-primary/10 text-primary"
                )}
              >
                {START_LABELS[start]}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {getBlockLabel(data.blockType)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {summarizeBlock(data)}
        </p>
      </div>

      {outputs.length > 0 && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3 pr-6">
          {outputs.map((output, index) => {
            const target = data.targets?.[output.id];
            const showGroup =
              output.group && output.group !== outputs[index - 1]?.group;
            return (
              <Fragment key={output.id}>
                {showGroup && (
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {output.group}
                  </p>
                )}
                <div className="relative flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs shadow-xs">
                  <p
                    className={cn(
                      "min-w-0 truncate font-medium",
                      output.kind === "next"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    )}
                  >
                    {output.label}
                  </p>
                  {output.kind === "url" ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <ExternalLink className="size-3" />
                      Open website
                    </span>
                  ) : target ? (
                    <span className="max-w-32 shrink-0 truncate text-[11px] font-medium text-primary">
                      → {target}
                    </span>
                  ) : output.optional ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {output.id === "unknown"
                        ? "Same as doesn't follow"
                        : "Optional"}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                      Choose next step
                    </span>
                  )}
                  {output.kind !== "url" && (
                    <Handle
                      id={output.id}
                      type="source"
                      position={Position.Right}
                      style={{
                        right: -18,
                        top: "50%",
                        transform: "translate(50%, -50%)"
                      }}
                      className={handleClass}
                    />
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(InstagramFlowNode);
