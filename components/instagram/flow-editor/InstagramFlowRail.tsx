import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { InstagramBlockType } from "@/client-api/types/instagram.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { blockCatalog, flowOrder, getBlockIcon } from "./blockCatalog";
import { IgFlowNode, START_LABELS, startOf } from "./instagramFlow";

export const BLOCK_DRAG_TYPE = "application/whatching-instagram-block";

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.trim().toLowerCase());

const dragBlock = (event: React.DragEvent, type: InstagramBlockType) => {
  event.dataTransfer.setData(BLOCK_DRAG_TYPE, type);
  event.dataTransfer.effectAllowed = "move";
};

function AddTab({
  readOnly,
  onAdd
}: {
  readOnly: boolean;
  onAdd: (type: InstagramBlockType) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = blockCatalog
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !query.trim() ||
          matches(item.label, query) ||
          matches(item.description, query)
      )
    }))
    .filter((group) => group.items.length);

  return (
    <div className="space-y-3">
      {readOnly && (
        <p className="text-xs text-muted-foreground">
          Go back to editing to add blocks.
        </p>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="h-8 bg-white pl-8 text-sm"
          disabled={readOnly}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {groups.map((group) => (
        <div key={group.group} className="space-y-0.5">
          <p className="px-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.group}
          </p>
          {group.items.map((item) => (
            <button
              key={item.type}
              type="button"
              draggable={!readOnly}
              disabled={readOnly}
              onDragStart={(event) => dragBlock(event, item.type)}
              onClick={() => onAdd(item.type)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-white hover:shadow-xs",
                readOnly ? "cursor-not-allowed opacity-50" : "cursor-grab"
              )}
            >
              <item.icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{item.label}</span>
                <span className="block text-[11px] leading-4 text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      ))}
      {!groups.length && (
        <p className="text-xs text-muted-foreground">No block matches.</p>
      )}
    </div>
  );
}

function OutlineTab({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode
}: {
  nodes: IgFlowNode[];
  edges: Array<{ source: string; target: string }>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const ordered = useMemo(
    () =>
      flowOrder(nodes, edges).filter(
        (node) => !query.trim() || matches(node.data.label, query)
      ),
    [edges, nodes, query]
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Find a block"
          aria-label="Find a block"
          className="h-8 bg-white pl-8 text-sm"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ul className="space-y-0.5">
        {ordered.map((node) => {
          const Icon = getBlockIcon(node.data.blockType);
          const start = startOf(node.data);
          return (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelectNode(node.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white",
                  selectedNodeId === node.id && "bg-white font-medium shadow-xs"
                )}
              >
                <Icon className="size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">
                  {node.data.label}
                </span>
                {start && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-primary">
                    {START_LABELS[start]}
                  </span>
                )}
                {node.data.changed && (
                  <span
                    className="size-2 shrink-0 rounded-full bg-sky-500"
                    title="Pending change"
                    aria-label="Pending change"
                  />
                )}
                {node.data.issueSeverity && (
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      node.data.issueSeverity === "error"
                        ? "bg-destructive"
                        : "bg-amber-500"
                    )}
                    aria-label={
                      node.data.issueSeverity === "error"
                        ? "Has problems to fix"
                        : "Has warnings"
                    }
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {!ordered.length && (
        <p className="px-2 text-xs text-muted-foreground">No block matches.</p>
      )}
    </div>
  );
}

/** The left rail: find a block in the flow, or add one. */
export function InstagramFlowRail({
  readOnly,
  nodes,
  edges,
  selectedNodeId,
  issueCounts,
  collapsed,
  onCollapsedChange,
  onAdd,
  onSelectNode
}: {
  readOnly: boolean;
  nodes: IgFlowNode[];
  edges: Array<{ source: string; target: string }>;
  selectedNodeId: string | null;
  issueCounts: { errors: number; warnings: number };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onAdd: (type: InstagramBlockType) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const [tab, setTab] = useState<"outline" | "add">("outline");

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          tooltip="Show the block list"
          aria-label="Show the block list"
          onClick={() => onCollapsedChange(false)}
        >
          <PanelLeftOpen className="size-4" />
        </Button>
        <span className="my-1 h-px w-6 bg-border" />
        {blockCatalog.flatMap((group) =>
          group.items.map((item) => (
            <Button
              key={item.type}
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              draggable={!readOnly}
              disabled={readOnly}
              tooltip={`Add ${item.label}`}
              aria-label={`Add ${item.label}`}
              onDragStart={(event) => dragBlock(event, item.type)}
              onClick={() => onAdd(item.type)}
            >
              <item.icon className="size-4 text-primary" />
            </Button>
          ))
        )}
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as "outline" | "add")}
      className="gap-3"
    >
      <div className="flex items-center gap-1">
        <TabsList className="min-w-0 flex-1">
          <TabsTrigger value="outline" className="gap-1.5">
            Outline · {nodes.length}
            {issueCounts.errors > 0 && (
              <span
                className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-4 text-white"
                aria-label={`${issueCounts.errors} to fix`}
              >
                {issueCounts.errors}
              </span>
            )}
            {issueCounts.warnings > 0 && (
              <span
                className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white"
                aria-label={`${issueCounts.warnings} warnings`}
              >
                {issueCounts.warnings}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="add">Add</TabsTrigger>
        </TabsList>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          tooltip="Hide the block list"
          aria-label="Hide the block list"
          onClick={() => onCollapsedChange(true)}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>
      <TabsContent value="outline">
        <OutlineTab
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      </TabsContent>
      <TabsContent value="add">
        <AddTab readOnly={readOnly} onAdd={onAdd} />
      </TabsContent>
    </Tabs>
  );
}
