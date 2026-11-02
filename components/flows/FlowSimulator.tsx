import { Edge, Node } from "@xyflow/react";
import { RotateCcw } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  BotAction,
  BotBlockType,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import {
  InstagramBlockType,
  InstagramCanvasContent
} from "@/client-api/types/instagram.type";
import {
  InstagramFlowBlockPreview,
  RouteClickContext,
  WhatsAppFlowBlockPreview
} from "@/components/flows/FlowBlockPreview";
import { edgeKey, FlowPlatform } from "@/components/flows/flowGraph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Entry =
  | { kind: "bot"; nodeId: string; key: number }
  | { kind: "user"; label: string; key: number }
  | { kind: "system"; text: string; key: number };

// Keys only need to be unique within a transcript.
let entryKey = 0;
const nextKey = () => ++entryKey;

const instagramMessageTypes = new Set<string>([
  "send_text",
  "send_image",
  "send_video",
  "quick_replies",
  "button_template",
  "generic_template"
]);

const instagramOperationLabels: Record<string, string> = {
  tag_subscriber: "Adds a tag",
  handoff_to_agent: "Hands the chat to a person",
  pause_automation: "Pauses automation",
  end_flow: "Ends the conversation"
};

// An Instagram block's "Then" step is sent straight after it. Capped like
// the backend's, so a loop can't run forever.
const INSTAGRAM_NEXT_HANDLE = "next";
const INSTAGRAM_MAX_CHAIN = 10;

const instagramFollowAnswers = [
  { id: "follows", label: "Follows you" },
  { id: "not_follows", label: "Doesn't follow you" }
];

// The tester plays the customer: pick whether they follow the account.
function FollowCheckChooser() {
  const onRoute = useContext(RouteClickContext);
  return (
    <div className="mx-auto w-fit space-y-1.5 rounded-md bg-slate-100 px-2.5 py-2 text-center text-[11px] text-slate-600">
      <p>Checks if they follow you. In this test, they:</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {instagramFollowAnswers.map((answer) => (
          <button
            key={answer.id}
            type="button"
            className="cursor-pointer rounded-full border border-[#3797f0] bg-white px-2.5 py-1 font-semibold text-[#3797f0] hover:bg-sky-50"
            onClick={() => onRoute?.(answer.id, answer.label)}
          >
            {answer.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// A phone-sized, fully client-side walk through the flow: tapping an option
// follows the same edges as the diagram. Nothing is sent anywhere.
export function FlowSimulator({
  platform,
  nodes,
  edges,
  startNodeId
}: {
  platform: FlowPlatform;
  nodes: Node[];
  edges: Edge[];
  startNodeId: string | null;
}) {
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const targetByRoute = useMemo(
    () =>
      new Map(
        edges.map((edge) => [
          edgeKey(edge.source, edge.sourceHandle),
          edge.target
        ])
      ),
    [edges]
  );
  // The block, then (Instagram) each "Then" step after it.
  const botEntries = useCallback(
    (nodeId: string): Entry[] => {
      const entries: Entry[] = [{ kind: "bot", nodeId, key: nextKey() }];
      if (platform !== "Instagram") return entries;
      let current = nodeId;
      for (let step = 0; step < INSTAGRAM_MAX_CHAIN; step += 1) {
        const next = targetByRoute.get(edgeKey(current, INSTAGRAM_NEXT_HANDLE));
        if (!next || !nodeById.has(next)) return entries;
        entries.push({ kind: "bot", nodeId: next, key: nextKey() });
        current = next;
      }
      entries.push({
        kind: "system",
        text: "These blocks lead into each other, so the test stopped here.",
        key: nextKey()
      });
      return entries;
    },
    [nodeById, platform, targetByRoute]
  );
  const initialEntries = useCallback(
    (): Entry[] =>
      startNodeId
        ? botEntries(startNodeId)
        : [
            {
              kind: "system",
              text:
                platform === "Instagram"
                  ? "This flow has no main menu."
                  : "This flow has no start block.",
              key: nextKey()
            }
          ],
    [botEntries, platform, startNodeId]
  );
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEntries(initialEntries());
  }, [initialEntries]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element)
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const handleRoute =
    (sourceNodeId: string) => (routeId: string | undefined, label: string) => {
      const target = routeId
        ? targetByRoute.get(edgeKey(sourceNodeId, routeId))
        : undefined;
      setEntries((current) => [
        ...current,
        { kind: "user", label, key: nextKey() },
        ...(target && nodeById.has(target)
          ? botEntries(target)
          : [
              {
                kind: "system" as const,
                text: "This button has no next step.",
                key: nextKey()
              }
            ])
      ]);
    };

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex h-full max-h-[720px] w-full max-w-[380px] flex-col overflow-hidden rounded-[28px] border-8 border-slate-900 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between bg-white px-4 py-2.5">
          <div>
            <p className="text-sm font-semibold">Test chat</p>
            <p className="text-[11px] text-muted-foreground">
              Nothing is sent. Tap a button to follow the flow.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEntries(initialEntries())}
          >
            <RotateCcw className="size-3.5" />
            Restart
          </Button>
        </div>
        <div
          ref={scrollRef}
          className={cn(
            "min-h-0 flex-1 space-y-2 overflow-y-auto p-3",
            platform === "WhatsApp"
              ? "bg-[#efeae2] bg-[radial-gradient(circle_at_15%_25%,rgba(17,111,91,0.08)_0_1px,transparent_1.5px)] [background-size:18px_18px]"
              : "bg-white"
          )}
        >
          {entries.map((entry) => {
            if (entry.kind === "user") {
              return (
                <div key={entry.key} className="flex justify-end">
                  <span
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-1.5 text-xs shadow-xs",
                      platform === "WhatsApp"
                        ? "rounded-tr-sm bg-[#d9fdd3] text-slate-900"
                        : "rounded-2xl bg-[#3797f0] text-white"
                    )}
                  >
                    {entry.label}
                  </span>
                </div>
              );
            }
            if (entry.kind === "system") {
              return (
                <p
                  key={entry.key}
                  className="mx-auto w-fit rounded-md bg-amber-50 px-2.5 py-1 text-center text-[11px] font-medium text-amber-800 shadow-xs"
                >
                  {entry.text}
                </p>
              );
            }
            const node = nodeById.get(entry.nodeId);
            if (!node) return null;
            const data = node.data as Record<string, unknown>;
            const blockType = String(data.blockType || "");
            return (
              <RouteClickContext.Provider
                key={entry.key}
                value={handleRoute(node.id)}
              >
                {platform === "WhatsApp" ? (
                  <div className="[&>div]:!bg-none [&>div]:!bg-transparent [&>div]:!p-0">
                    <WhatsAppFlowBlockPreview
                      blockType={blockType as BotBlockType}
                      content={(data.content || {}) as BotCanvasNodeContent}
                      actions={(data.actions as BotAction[]) || []}
                      showClose={false}
                      chrome={false}
                    />
                  </div>
                ) : instagramMessageTypes.has(blockType) ? (
                  <div className="[&>div]:!p-0 [&>div>div:first-child]:hidden">
                    <InstagramFlowBlockPreview
                      blockType={blockType as InstagramBlockType}
                      content={(data.content || {}) as InstagramCanvasContent}
                      showClose={false}
                      chrome={false}
                    />
                  </div>
                ) : blockType === "follow_condition" ? (
                  <FollowCheckChooser />
                ) : (
                  <p className="mx-auto w-fit rounded-md bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                    {instagramOperationLabels[blockType] || "Automation step"}
                  </p>
                )}
              </RouteClickContext.Provider>
            );
          })}
        </div>
      </div>
    </div>
  );
}
