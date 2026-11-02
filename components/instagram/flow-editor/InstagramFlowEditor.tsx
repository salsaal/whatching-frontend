import {
  addEdge,
  Background,
  Connection,
  ConnectionLineType,
  Edge,
  MiniMap,
  NodeChange,
  ReactFlow,
  ReactFlowInstance,
  Viewport,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Eye,
  History,
  Instagram,
  Loader2,
  MoreHorizontal,
  Play,
  Power,
  PowerOff,
  Send,
  Trash2,
  Undo2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getApiErrorMessage,
  getDraftConflict,
  getFlowInvalid
} from "@/client-api/functions/bot";
import {
  discardInstagramCanvasDraftById,
  getInstagramAutomationSettings,
  getInstagramCanvas,
  getInstagramCanvases,
  getInstagramStatus,
  listInstagramCanvasVersions,
  publishInstagramCanvasById,
  restoreInstagramCanvasVersionById,
  saveInstagramCanvasDraftById,
  updateInstagramCanvas,
  updateInstagramCanvasStatus,
  validateInstagramCanvasById
} from "@/client-api/functions/instagram";
import { BotDraftConflictDetails } from "@/client-api/types/bot.type";
import {
  InstagramBlockType,
  InstagramCanvasDetailResponse,
  InstagramCanvasState,
  InstagramCanvasValidation,
  InstagramDraftChanges,
  InstagramFlowIssue
} from "@/client-api/types/instagram.type";
import { MediaAsset } from "@/client-api/types/media.type";
import { FlowCanvasToolbar } from "@/components/flows/FlowCanvasToolbar";
import FlowDiagramPreviewDialog from "@/components/flows/FlowDiagramPreviewDialog";
import { FlowStatusPill } from "@/components/flows/FlowStatusPill";
import { FlowVersionHistoryDialog } from "@/components/flows/FlowVersionHistoryDialog";
import { layoutFlow } from "@/components/flows/flowGraph";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { InlineEditableTitle } from "@/components/shared/InlineEditableTitle";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { CanvasLoadingSkeleton } from "@/components/ui/loading-skeletons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import AppLayout from "@/layouts/AppLayout";
import { getPrimaryAction, readOnlyNodeChanges } from "@/lib/flowBuilder";
import {
  emptyHistory,
  FlowHistory,
  recordHistory,
  redoHistory,
  undoHistory
} from "@/lib/flowHistory";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

import {
  FocusRequest,
  InstagramBlockInspector,
  MediaPickerTarget
} from "./InstagramBlockInspector";
import InstagramFlowNode from "./InstagramFlowNode";
import { BLOCK_DRAG_TYPE, InstagramFlowRail } from "./InstagramFlowRail";
import {
  buildDraftState,
  cloneContent,
  defaultContent,
  deriveActions,
  describeInstagramEntryPoint,
  draftSignature,
  getEditorFlowStatus,
  getOutputs,
  IgFlowNode,
  IgNodeData,
  IgStart,
  isMainMenu,
  loadFlow,
  newEdgeId,
  newNodeId,
  newTriggerKey,
  nextBlockName,
  assignOptionIds,
  wireHandles
} from "./instagramFlow";

const nodeTypes = { instagramBlock: InstagramFlowNode };
// Wires are faint until their block is selected, as in the WhatsApp editor.
const edgeStyle = {
  strokeWidth: 1.25,
  strokeDasharray: "4 5",
  opacity: 0.45
};
const selectedEdgeStyle = {
  stroke: "#16a34a",
  strokeWidth: 2,
  strokeDasharray: "4 5",
  opacity: 1
};

const RAIL_COLLAPSED_KEY = "whatching:ig-flow-rail-collapsed";
const AUTOSAVE_DELAY_MS = 1500;
// Changes this close together (typing, nudging) share one undo step.
const HISTORY_COALESCE_MS = 1000;
const ARRANGE_DURATION_MS = 350;
const DEFAULT_GREETINGS = ["hi", "hello", "menu", "start"];

type SaveState = "idle" | "saving" | "saved" | "error";
type Snapshot = { nodes: IgFlowNode[]; edges: Edge[]; signature: string };
type CanvasMode = "draft" | "current";
/** What to do once the owner agrees to switch the other flow off. */
type SwitchConfirm = { kind: "activate" } | { kind: "switch-on" };

type ServerDraft = {
  draftState?: InstagramCanvasState;
  draftRevision?: number;
  draftChanges?: InstagramDraftChanges;
};

const formatTime = (value: string | number | Date = Date.now()) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

const issueKey = (issue: InstagramFlowIssue, index: number) =>
  `${issue.code}-${issue.nodeId}-${issue.actionId}-${issue.field}-${index}`;

function IssuesButton({
  issues,
  open,
  onOpenChange,
  onSelect,
  blockedApply
}: {
  issues: InstagramFlowIssue[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (issue: InstagramFlowIssue) => void;
  /** Activate / Apply changes was stopped by these errors. */
  blockedApply: boolean;
}) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity !== "error");
  const summary = [
    errors.length ? `${errors.length} to fix` : "",
    warnings.length
      ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
      : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(errors.length > 0 && "border-destructive/40")}
        >
          {errors.length > 0 && (
            <span className="size-2 rounded-full bg-destructive" />
          )}
          {warnings.length > 0 && (
            <span className="size-2 rounded-full bg-amber-500" />
          )}
          {summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(420px,90vw)] p-0">
        {blockedApply && errors.length > 0 && (
          <p className="border-b bg-red-50 px-3 py-2 text-sm font-medium text-destructive">
            Fix these before applying changes.
          </p>
        )}
        <ul className="max-h-80 overflow-y-auto py-1 text-sm">
          {[...errors, ...warnings].map((issue, index) => (
            <li key={issueKey(issue, index)}>
              <button
                type="button"
                disabled={!issue.nodeId}
                className="flex w-full cursor-pointer items-start gap-2 px-3 py-1.5 text-left hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
                onClick={() => onSelect(issue)}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    issue.severity === "error"
                      ? "bg-destructive"
                      : "bg-amber-500"
                  )}
                />
                <span>{issue.message}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** The Instagram flow editor, at /instagram/[canvasId]. */
export function InstagramFlowEditor({ canvasId }: { canvasId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const [nodes, setNodes, onNodesChange] = useNodesState<IgFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<
    IgFlowNode,
    Edge
  > | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("draft");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [issues, setIssues] = useState<InstagramFlowIssue[]>([]);
  const [analysis, setAnalysis] =
    useState<InstagramCanvasValidation["analysis"]>();
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [applyBlocked, setApplyBlocked] = useState(false);
  useEffect(() => {
    if (!issues.some((issue) => issue.severity === "error")) {
      setApplyBlocked(false);
    }
  }, [issues]);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [conflict, setConflict] = useState<BotDraftConflictDetails | null>(
    null
  );
  const [isApplying, setIsApplying] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState<SwitchConfirm | null>(
    null
  );
  const [discardOpen, setDiscardOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [deletion, setDeletion] = useState<{
    ids: string[];
    label: string;
    reachedFrom?: string[];
  } | null>(null);
  const [mediaPicker, setMediaPicker] = useState<MediaPickerTarget | null>(
    null
  );
  const [wiresVisible, setWiresVisible] = useState(true);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false
  });
  // Bumped whenever there are edits the server doesn't have; restarts the
  // autosave timer.
  const [pendingVersion, setPendingVersion] = useState(0);

  const hydratedRef = useRef(false);
  const nodesRef = useRef<IgFlowNode[]>([]);
  const latestDraftRef = useRef<InstagramCanvasState | null>(null);
  // Signature of the draft the server has. Null until the first pass after
  // loading records it, so opening a flow never saves it back.
  const savedSignatureRef = useRef<string | null>(null);
  const hasPendingEditsRef = useRef(false);
  // The server's draftRevision our edits build on; sent as baseRevision.
  const draftRevisionRef = useRef<number | undefined>(undefined);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const saveFailedRef = useRef(false);
  const conflictRef = useRef(false);
  const validateTimerRef = useRef<number | undefined>(undefined);
  const validateRequestRef = useRef(0);
  const historyRef = useRef<FlowHistory<Snapshot>>(emptyHistory());
  const snapshotRef = useRef<Snapshot | null>(null);
  const lastRecordAtRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isArrangingRef = useRef(false);
  // Where the editor was looking before "View current version".
  const editViewportRef = useRef<Viewport | null>(null);
  const pendingCurrentFitRef = useRef(false);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    try {
      setRailCollapsed(localStorage.getItem(RAIL_COLLAPSED_KEY) === "1");
    } catch {
      // Storage unavailable: the rail starts open.
    }
  }, []);
  const collapseRail = (collapsed: boolean) => {
    setRailCollapsed(collapsed);
    try {
      localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Not remembered; it still collapses.
    }
  };

  const canvasQueryKey = useMemo(
    () => ["instagram-canvas", orgId, canvasId],
    [canvasId, orgId]
  );
  // isPending, not isLoading: until the organisation is known the queries
  // are disabled, and that isn't "not connected".
  const { data: statusData, isPending: isStatusPending } = useQuery({
    queryKey: ["instagram-status", orgId],
    queryFn: getInstagramStatus,
    enabled: Boolean(orgId)
  });
  const isReady = statusData?.data.instagram?.status === "ready";
  const enabledForPlan = statusData?.data.enabledForPlan !== false;
  const {
    data: canvasData,
    isPending: isCanvasPending,
    isError: isCanvasError,
    refetch: refetchCanvas
  } = useQuery({
    queryKey: canvasQueryKey,
    queryFn: () => getInstagramCanvas(canvasId),
    enabled: Boolean(orgId && canvasId && isReady),
    refetchOnMount: "always"
  });
  const { data: settingsData } = useQuery({
    queryKey: ["instagram-automation-settings", orgId],
    queryFn: getInstagramAutomationSettings,
    enabled: Boolean(orgId && isReady)
  });
  const { data: canvasesData } = useQuery({
    queryKey: ["instagram-canvases", orgId],
    queryFn: getInstagramCanvases,
    enabled: Boolean(orgId && isReady)
  });

  const detail = canvasData?.data;
  const canvasName = detail?.canvas?.name || "";
  const draftChanges = detail?.draftChanges;
  const live = detail?.live;
  const hasLiveVersion =
    live?.hasLiveVersion ?? Boolean(detail?.canvas?.publishedState);
  const neverApplied = draftChanges?.neverPublished ?? !hasLiveVersion;
  const isActive = live?.isActive ?? detail?.canvas?.status === "active";
  const username =
    live?.account?.username || statusData?.data.instagram?.username || "";
  const greetings = (
    settingsData?.data.settings.greetingKeywords?.length
      ? settingsData.data.settings.greetingKeywords
      : DEFAULT_GREETINGS
  ).map((word) => word.toLowerCase());
  const otherActiveFlow = (canvasesData?.data.canvases || []).find(
    (canvas) => canvas.status === "active" && canvas._id !== canvasId
  );

  const { mutate: renameFlow } = useMutation({
    mutationFn: updateInstagramCanvas,
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Flow renamed.");
      void refetchCanvas();
      queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't rename this flow."))
  });

  // ---- The version customers get, read-only.
  const isCurrentView = canvasMode === "current";
  const currentState =
    detail?.latestPublishedVersion?.state || detail?.canvas?.publishedState;
  const currentFlow = useMemo(() => loadFlow(currentState), [currentState]);
  // React Flow measures blocks through onNodesChange, so this view needs
  // its own node state; without it every block stays hidden. Only
  // measuring and selecting get through.
  const [currentNodes, setCurrentNodes, onCurrentNodesChange] =
    useNodesState<IgFlowNode>([]);
  useEffect(
    () => setCurrentNodes(currentFlow.nodes),
    [currentFlow, setCurrentNodes]
  );
  const handleCurrentNodesChange = useCallback(
    (changes: NodeChange<IgFlowNode>[]) => {
      const allowed = readOnlyNodeChanges(changes);
      if (allowed.length) onCurrentNodesChange(allowed);
    },
    [onCurrentNodesChange]
  );
  const viewNodes = isCurrentView ? currentNodes : nodes;
  const rawViewEdges = isCurrentView ? currentFlow.edges : edges;

  const selectedNode = useMemo(
    () => viewNodes.find((node) => node.id === selectedNodeId) || null,
    [selectedNodeId, viewNodes]
  );

  const visibleEdges = useMemo(
    () =>
      rawViewEdges.map((edge) => {
        const connected =
          Boolean(selectedNodeId) &&
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const selected = edge.id === selectedEdgeId;
        return {
          ...edge,
          type: "smoothstep",
          selected,
          hidden: !wiresVisible && !connected && !selected,
          style: connected || selected ? selectedEdgeStyle : edgeStyle
        };
      }),
    [rawViewEdges, selectedEdgeId, selectedNodeId, wiresVisible]
  );

  // Display-only extras for each block: where its outputs lead, the worst
  // problem on it, and whether it differs from the current version.
  const visibleNodes = useMemo(() => {
    const nameById = new Map(
      viewNodes.map((node) => [node.id, node.data.label])
    );
    const targetsByNode = new Map<string, Record<string, string>>();
    rawViewEdges.forEach((edge) => {
      const name = nameById.get(edge.target);
      if (!edge.sourceHandle || !name) return;
      targetsByNode.set(edge.source, {
        ...(targetsByNode.get(edge.source) || {}),
        [edge.sourceHandle]: name
      });
    });
    const severityByNode = new Map<string, "error" | "warning">();
    if (!isCurrentView) {
      issues.forEach((issue) => {
        if (!issue.nodeId || severityByNode.get(issue.nodeId) === "error") {
          return;
        }
        severityByNode.set(issue.nodeId, issue.severity);
      });
    }
    const changedIds = new Set(
      isCurrentView || draftChanges?.neverPublished
        ? []
        : [
            ...(draftChanges?.changedBlockIds || []),
            ...(draftChanges?.addedBlockIds || [])
          ]
    );
    return viewNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        targets: targetsByNode.get(node.id),
        issueSeverity: severityByNode.get(node.id),
        changed: changedIds.has(node.id)
      }
    }));
  }, [draftChanges, isCurrentView, issues, rawViewEdges, viewNodes]);

  // ---- Saving and checking.
  const applyDraftChanges = useCallback(
    (changes?: InstagramDraftChanges, revision?: number) => {
      queryClient.setQueryData<InstagramCanvasDetailResponse>(
        canvasQueryKey,
        (current) =>
          current
            ? {
                ...current,
                data: {
                  ...current.data,
                  ...(changes ? { draftChanges: changes } : {}),
                  ...(typeof revision === "number"
                    ? { draftRevision: revision }
                    : {})
                }
              }
            : current
      );
    },
    [canvasQueryKey, queryClient]
  );

  // Checks what's on screen. Debounced; a response a newer check has
  // overtaken is dropped.
  const scheduleValidate = useCallback(
    (delay = 400) => {
      window.clearTimeout(validateTimerRef.current);
      validateTimerRef.current = window.setTimeout(async () => {
        const draft = latestDraftRef.current;
        const requestId = ++validateRequestRef.current;
        try {
          const response = await validateInstagramCanvasById(
            canvasId,
            draft || undefined
          );
          if (requestId !== validateRequestRef.current) return;
          setIssues(response.data?.validation?.issues || []);
          setAnalysis(response.data?.validation?.analysis);
        } catch {
          // Keep the last result; the next save checks again.
        }
      }, delay);
    },
    [canvasId]
  );
  useEffect(() => () => window.clearTimeout(validateTimerRef.current), []);

  const openConflict = useCallback((details: BotDraftConflictDetails) => {
    conflictRef.current = true;
    setConflict(details);
    setSaveState("error");
  }, []);

  const markSaved = useCallback(
    (signature: string, revision: number | undefined) => {
      if (typeof revision === "number") draftRevisionRef.current = revision;
      savedSignatureRef.current = signature;
      saveFailedRef.current = false;
      const latest = latestDraftRef.current;
      const stillPending = latest
        ? draftSignature(latest) !== signature
        : false;
      hasPendingEditsRef.current = stillPending;
      setHasUnsavedEdits(stillPending);
      if (stillPending) setPendingVersion((value) => value + 1);
      setSaveState("saved");
      setLastSavedAt(formatTime());
    },
    []
  );

  // The only save: autosave, Retry and the media library all run this.
  // Saves never overlap, so each sends the revision the last one returned.
  const saveNow = useCallback(async (): Promise<boolean> => {
    while (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    const draft = latestDraftRef.current;
    if (conflictRef.current || !draft || !hasPendingEditsRef.current) {
      return !conflictRef.current;
    }
    const signature = draftSignature(draft);
    const run = (async () => {
      setSaveState("saving");
      try {
        const response = await saveInstagramCanvasDraftById({
          canvasId,
          draftState: draft,
          baseRevision: draftRevisionRef.current
        });
        markSaved(signature, response.data?.draftRevision);
        applyDraftChanges(
          response.data?.draftChanges,
          response.data?.draftRevision
        );
        scheduleValidate();
        return true;
      } catch (error) {
        const draftConflict = getDraftConflict(error);
        if (draftConflict) {
          openConflict(draftConflict.details);
        } else {
          saveFailedRef.current = true;
          setSaveState("error");
        }
        return false;
      }
    })();
    saveInFlightRef.current = run;
    try {
      return await run;
    } finally {
      if (saveInFlightRef.current === run) saveInFlightRef.current = null;
    }
  }, [applyDraftChanges, canvasId, markSaved, openConflict, scheduleValidate]);

  // ---- Undo / redo.
  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0
    });
  }, []);
  const recordSnapshot = useCallback(
    (snapshot: Snapshot) => {
      if (isDraggingRef.current || isArrangingRef.current) return;
      const previous = snapshotRef.current;
      snapshotRef.current = snapshot;
      if (!previous || previous.signature === snapshot.signature) return;
      const now = Date.now();
      historyRef.current =
        now - lastRecordAtRef.current > HISTORY_COALESCE_MS
          ? recordHistory(historyRef.current, previous)
          : { ...historyRef.current, future: [] };
      lastRecordAtRef.current = now;
      syncHistoryState();
    },
    [syncHistoryState]
  );
  const resetHistory = useCallback(() => {
    historyRef.current = emptyHistory();
    snapshotRef.current = null;
    lastRecordAtRef.current = 0;
    syncHistoryState();
  }, [syncHistoryState]);
  const stepHistory = (direction: "undo" | "redo") => {
    const current = snapshotRef.current;
    if (isCurrentView || !current || conflict) return;
    const result =
      direction === "undo"
        ? undoHistory(historyRef.current, current)
        : redoHistory(historyRef.current, current);
    if (!result) return;
    historyRef.current = result.history;
    snapshotRef.current = result.snapshot;
    lastRecordAtRef.current = 0;
    setNodes(result.snapshot.nodes);
    setEdges(result.snapshot.edges);
    syncHistoryState();
  };

  const applyDraft = useCallback(
    (state?: InstagramCanvasState | null) => {
      const loaded = loadFlow(state);
      setNodes(loaded.nodes);
      setEdges(loaded.edges);
      setSelectedNodeId(
        loaded.nodes.find((node) => isMainMenu(node.data))?.id || null
      );
      setSelectedEdgeId(null);
    },
    [setEdges, setNodes]
  );

  // A draft the server sent (load, reload, discard, restore) becomes the
  // baseline: nothing unsaved, nothing to undo.
  const showServerDraft = useCallback(
    (draft: ServerDraft) => {
      draftRevisionRef.current = draft.draftRevision;
      savedSignatureRef.current = null;
      hasPendingEditsRef.current = false;
      saveFailedRef.current = false;
      setHasUnsavedEdits(false);
      resetHistory();
      applyDraft(draft.draftState);
      setCanvasMode("draft");
      applyDraftChanges(draft.draftChanges, draft.draftRevision);
    },
    [applyDraft, applyDraftChanges, resetHistory]
  );

  useEffect(() => {
    if (!detail || hydratedRef.current) return;
    hydratedRef.current = true;
    showServerDraft({
      draftState: detail.canvas?.draftState,
      draftRevision: detail.draftRevision ?? detail.canvas?.draftRevision
    });
  }, [detail, showServerDraft]);

  // Every committed change: record it for undo, and queue a save when it
  // differs from what the server has.
  useEffect(() => {
    if (!hydratedRef.current || !nodes.length) return;
    const draft = buildDraftState(nodes, edges);
    const signature = draftSignature(draft);
    latestDraftRef.current = draft;
    recordSnapshot({ nodes, edges, signature });
    if (savedSignatureRef.current === null) {
      // A newly loaded draft: its blocks are on screen now, so check them.
      savedSignatureRef.current = signature;
      scheduleValidate(0);
      return;
    }
    hasPendingEditsRef.current = signature !== savedSignatureRef.current;
    setHasUnsavedEdits(hasPendingEditsRef.current);
    if (hasPendingEditsRef.current) setPendingVersion((value) => value + 1);
  }, [edges, nodes, recordSnapshot, scheduleValidate]);

  // Autosave, shortly after the last change. Stops while a conflict is open.
  useEffect(() => {
    if (!pendingVersion || conflict) return;
    const timer = window.setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [conflict, pendingVersion, saveNow]);

  // In-app navigation sends a pending save on its way. If the last save
  // failed (or someone else's changes are in the way), it asks first.
  // Closing or reloading the tab can't wait for a save, so the browser asks.
  useEffect(() => {
    if (!orgId || !canvasId) return;
    const hasUnsaved = () =>
      hasPendingEditsRef.current ||
      Boolean(saveInFlightRef.current) ||
      saveFailedRef.current;
    const onRouteChangeStart = (url: string) => {
      if (url.split("?")[0] === router.asPath.split("?")[0]) return;
      if (
        (saveFailedRef.current || conflictRef.current) &&
        hasUnsaved() &&
        !window.confirm("Your latest changes aren't saved. Leave anyway?")
      ) {
        router.events.emit("routeChangeError");
        // Next.js only cancels a route change when this handler throws.
        throw "Route change cancelled: unsaved Instagram flow changes.";
      }
      const draft = latestDraftRef.current;
      if (!draft || !hasPendingEditsRef.current || conflictRef.current) return;
      hasPendingEditsRef.current = false;
      const send = () =>
        saveInstagramCanvasDraftById({
          canvasId,
          draftState: draft,
          baseRevision: draftRevisionRef.current
        }).catch(() => undefined);
      const inFlight = saveInFlightRef.current;
      void (inFlight ? inFlight.then(send, send) : send());
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    router.events.on("routeChangeStart", onRouteChangeStart);
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      router.events.off("routeChangeStart", onRouteChangeStart);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [canvasId, orgId, router]);

  const reloadTheirVersion = async () => {
    const result = await refetchCanvas();
    const data = result.data?.data;
    if (!data) {
      toast.error("Couldn't load the latest version. Try again.");
      return;
    }
    conflictRef.current = false;
    setConflict(null);
    setSaveState("idle");
    showServerDraft({
      draftState: data.canvas?.draftState,
      draftRevision: data.draftRevision ?? data.canvas?.draftRevision,
      draftChanges: data.draftChanges
    });
  };

  // ---- Selecting and focusing.
  const focusNode = useCallback(
    (nodeId: string, request?: Omit<FocusRequest, "nodeId" | "nonce">) => {
      const node = nodesRef.current.find((item) => item.id === nodeId);
      if (!node) return;
      setCanvasMode("draft");
      setSelectedEdgeId(null);
      setSelectedNodeId(node.id);
      void reactFlow?.setCenter(
        node.position.x + (node.measured?.width ?? 300) / 2,
        node.position.y + (node.measured?.height ?? 200) / 2,
        { zoom: Math.max(reactFlow.getZoom(), 0.9), duration: 300 }
      );
      if (request) {
        setFocusRequest({ ...request, nodeId: node.id, nonce: Date.now() });
      }
    },
    [reactFlow]
  );

  const focusIssue = useCallback(
    (issue: InstagramFlowIssue) => {
      if (!issue.nodeId) return;
      setIssuesOpen(false);
      focusNode(issue.nodeId, { field: issue.field, actionId: issue.actionId });
    },
    [focusNode]
  );

  // The outline selects in whichever version is on screen.
  const showNode = (nodeId: string) => {
    if (!isCurrentView) {
      focusNode(nodeId);
      return;
    }
    const node = currentNodes.find((item) => item.id === nodeId);
    if (!node || !reactFlow) return;
    setSelectedNodeId(node.id);
    void reactFlow.setCenter(
      node.position.x + (node.measured?.width ?? 300) / 2,
      node.position.y + (node.measured?.height ?? 200) / 2,
      { zoom: Math.max(reactFlow.getZoom(), 0.9), duration: 300 }
    );
  };

  // ---- Applying and switching on/off.
  const refreshAfterStatusChange = async () => {
    await refetchCanvas();
    queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
  };

  const switchOn = async (message?: string) => {
    setIsSwitching(true);
    try {
      await updateInstagramCanvasStatus({ canvasId, status: "active" });
      toast.success(
        message ||
          (username
            ? `Flow switched on. It answers @${username} now.`
            : "Flow switched on.")
      );
      await refreshAfterStatusChange();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Couldn't switch this flow on."));
      return false;
    } finally {
      setIsSwitching(false);
    }
  };

  const switchOff = async () => {
    setIsSwitching(true);
    try {
      await updateInstagramCanvasStatus({ canvasId, status: "inactive" });
      toast.success("Flow switched off.");
      await refreshAfterStatusChange();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Couldn't switch this flow off."));
    } finally {
      setIsSwitching(false);
    }
  };

  // One request saves, checks and applies; Activate then switches it on.
  const runApply = async (activate: boolean) => {
    while (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    if (conflictRef.current) return;
    const draft = buildDraftState(nodesRef.current, edges);
    const signature = draftSignature(draft);
    try {
      const response = await publishInstagramCanvasById({
        canvasId,
        draftState: draft,
        baseRevision: draftRevisionRef.current
      });
      markSaved(
        signature,
        response.data?.draftRevision ?? response.data?.canvas?.draftRevision
      );
      applyDraftChanges(
        response.data?.draftChanges,
        response.data?.draftRevision
      );
      setIssues(response.data?.validation?.issues || []);
      setAnalysis(response.data?.validation?.analysis);
      if (activate) {
        await switchOn(
          username
            ? `Flow activated. It answers @${username} from their next message.`
            : "Flow activated."
        );
        return;
      }
      toast.success(
        "Changes applied. People get them from their next message."
      );
      await refreshAfterStatusChange();
    } catch (error) {
      const draftConflict = getDraftConflict(error);
      if (draftConflict) {
        openConflict(draftConflict.details);
        return;
      }
      const invalid = getFlowInvalid(error);
      if (invalid) {
        setIssues(invalid.issues);
        setIssuesOpen(true);
        setApplyBlocked(true);
        return;
      }
      toast.error(
        getApiErrorMessage(error, "Couldn't apply changes. Try again.")
      );
    }
  };

  const apply = async (confirmed = false) => {
    if (isCurrentView || isApplying || conflict) return;
    const activate = neverApplied;
    if (activate && otherActiveFlow && !confirmed) {
      setSwitchConfirm({ kind: "activate" });
      return;
    }
    // Nothing unsaved: the last check is current, so show its errors
    // instead of asking again.
    const errors = issues.filter((issue) => issue.severity === "error");
    if (
      errors.length &&
      !hasPendingEditsRef.current &&
      !saveInFlightRef.current
    ) {
      setIssuesOpen(true);
      setApplyBlocked(true);
      return;
    }
    setIsApplying(true);
    try {
      await runApply(activate);
    } finally {
      setIsApplying(false);
    }
  };

  const requestSwitchOn = () => {
    if (otherActiveFlow) {
      setSwitchConfirm({ kind: "switch-on" });
      return;
    }
    void switchOn();
  };

  // Discard changes, or copy an applied version into the editor.
  const replaceDraft = async (
    target: { kind: "discard" } | { kind: "restore"; versionId: string }
  ) => {
    while (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    if (conflictRef.current) return false;
    try {
      const response =
        target.kind === "discard"
          ? await discardInstagramCanvasDraftById({
              canvasId,
              baseRevision: draftRevisionRef.current
            })
          : await restoreInstagramCanvasVersionById({
              canvasId,
              versionId: target.versionId,
              baseRevision: draftRevisionRef.current
            });
      showServerDraft(response.data || {});
      setSaveState("saved");
      setLastSavedAt(formatTime());
      toast.success(
        target.kind === "discard"
          ? "Pending changes discarded."
          : "Version copied into your editor. Apply changes when you're ready."
      );
      return true;
    } catch (error) {
      const draftConflict = getDraftConflict(error);
      if (draftConflict) {
        openConflict(draftConflict.details);
      } else {
        toast.error(
          getApiErrorMessage(
            error,
            target.kind === "discard"
              ? "Couldn't discard the changes. Try again."
              : "Couldn't restore that version. Try again."
          )
        );
      }
      return false;
    }
  };

  // ---- Editing.
  const readOnly = isCurrentView || Boolean(conflict);

  const updateNode = useCallback(
    (nodeId: string, updater: (data: IgNodeData) => IgNodeData) => {
      if (readOnly) return;
      const applyUpdate = (node: IgFlowNode): IgFlowNode => {
        const next = updater(node.data);
        const content = assignOptionIds(next.blockType, next.content);
        return {
          ...node,
          data: {
            ...next,
            content,
            actions: deriveActions(next.blockType, content)
          }
        };
      };
      // Outputs that disappear take exactly their own wires with them.
      const previous = nodesRef.current.find((node) => node.id === nodeId);
      if (previous) {
        const remaining = wireHandles(applyUpdate(previous).data);
        const removed = [...wireHandles(previous.data)].filter(
          (handle) => !remaining.has(handle)
        );
        if (removed.length) {
          setEdges((current) =>
            current.filter(
              (edge) =>
                !(
                  edge.source === nodeId &&
                  removed.includes(edge.sourceHandle || "")
                )
            )
          );
        }
      }
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? applyUpdate(node) : node))
      );
    },
    [readOnly, setEdges, setNodes]
  );

  // Main menu and welcome message belong to one block each: picking one
  // here takes it from the block that had it.
  const setStart = (nodeId: string, start: IgStart | undefined) => {
    if (readOnly) return;
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node || isMainMenu(node.data)) return;
    const previousOwner =
      start === "default" || start === "first_dm"
        ? nodesRef.current.find(
            (item) => item.id !== nodeId && item.data.triggerType === start
          )
        : undefined;
    setNodes((current) =>
      current.map((item) => {
        if (item.id === nodeId) {
          return { ...item, data: { ...item.data, triggerType: start } };
        }
        if (previousOwner && item.id === previousOwner.id) {
          return { ...item, data: { ...item.data, triggerType: undefined } };
        }
        return item;
      })
    );
    if (previousOwner) {
      toast.info(
        start === "default"
          ? `"${node.data.label}" is the main menu now, instead of "${previousOwner.data.label}".`
          : `"${node.data.label}" is the welcome message now. "${previousOwner.data.label}" is only reached from other blocks.`
      );
    }
  };

  const makeBlock = (
    type: InstagramBlockType,
    position: { x: number; y: number }
  ): IgFlowNode => {
    const current = nodesRef.current;
    const content = defaultContent(type);
    return {
      id: newNodeId(),
      type: "instagramBlock",
      position,
      data: {
        label: nextBlockName(type, current),
        blockType: type,
        triggerKey: newTriggerKey(current.map((node) => node.data.triggerKey)),
        keywords: [],
        content,
        actions: deriveActions(type, content),
        metadata: {}
      }
    };
  };

  const connectOutput = (
    nodeId: string,
    handle: string,
    targetId: string | null
  ) => {
    if (readOnly) return;
    setEdges((current) => {
      const rest = current.filter(
        (edge) => !(edge.source === nodeId && edge.sourceHandle === handle)
      );
      return targetId
        ? [
            ...rest,
            {
              id: newEdgeId(),
              source: nodeId,
              sourceHandle: handle,
              target: targetId,
              targetHandle: "in",
              type: "smoothstep"
            }
          ]
        : rest;
    });
  };

  const selectNew = (node: IgFlowNode) => {
    setNodes((current) => [...current, node]);
    setSelectedEdgeId(null);
    setSelectedNodeId(node.id);
    setFocusRequest({ nodeId: node.id, tab: "content", nonce: Date.now() });
  };

  // A new block about 380 px right of `source`, wired from `handle`.
  const placeBlockNextTo = (
    source: IgFlowNode,
    type: InstagramBlockType,
    handle?: string
  ) => {
    const siblings = edges.filter((edge) => edge.source === source.id).length;
    const node = makeBlock(type, {
      x: source.position.x + 380,
      y: source.position.y + siblings * 60
    });
    selectNew(node);
    if (handle) connectOutput(source.id, handle, node.id);
  };

  // From the Add tab: after the selected block, wired from its first output
  // that leads nowhere yet. With nothing selected, in view.
  const addFromRail = (type: InstagramBlockType) => {
    if (readOnly) return;
    const source = nodes.find((node) => node.id === selectedNodeId);
    if (source) {
      const wired = new Set(
        edges
          .filter((edge) => edge.source === source.id)
          .map((edge) => edge.sourceHandle)
      );
      const free = getOutputs(source.data).find(
        (output) => output.kind !== "url" && !wired.has(output.id)
      );
      placeBlockNextTo(source, type, free?.id);
      return;
    }
    const bounds = document
      .querySelector("[data-ig-flow-canvas]")
      ?.getBoundingClientRect();
    const position =
      reactFlow && bounds
        ? reactFlow.screenToFlowPosition({
            x: bounds.left + bounds.width / 2 - 150,
            y: bounds.top + bounds.height / 3
          })
        : { x: 260 + nodes.length * 24, y: 260 + nodes.length * 24 };
    selectNew(makeBlock(type, position));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData(
      BLOCK_DRAG_TYPE
    ) as InstagramBlockType;
    if (!type || !reactFlow || readOnly) return;
    selectNew(
      makeBlock(
        type,
        reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      )
    );
  };

  const duplicateNode = (nodeId: string) => {
    if (readOnly) return;
    const source = nodes.find((node) => node.id === nodeId);
    if (!source) return;
    const content = cloneContent(source.data.blockType, source.data.content);
    const copy: IgFlowNode = {
      id: newNodeId(),
      type: "instagramBlock",
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      // The copy starts only from other blocks: keywords and the main
      // menu belong to one block.
      data: {
        label: `${source.data.label} copy`,
        blockType: source.data.blockType,
        triggerKey: newTriggerKey(nodes.map((node) => node.data.triggerKey)),
        keywords: [],
        content,
        actions: deriveActions(source.data.blockType, content),
        metadata: { ...(source.data.metadata || {}) }
      }
    };
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      { ...copy, selected: true }
    ]);
    setSelectedNodeId(copy.id);
    toast.success(`Duplicated "${source.data.label}".`);
  };

  const requestDeletion = (ids: string[]) => {
    const removable = ids.filter((id) => {
      const node = nodesRef.current.find((item) => item.id === id);
      return node && !isMainMenu(node.data);
    });
    if (removable.length < ids.length) {
      toast.error("Make another block the main menu before deleting this one.");
    }
    if (!removable.length) return;
    const first = nodesRef.current.find((node) => node.id === removable[0]);
    setDeletion({
      ids: removable,
      label:
        removable.length === 1
          ? first?.data.label || "This block"
          : `${removable.length} blocks`,
      reachedFrom:
        removable.length === 1
          ? (analysis?.[removable[0]]?.entryPoints || []).map(
              describeInstagramEntryPoint
            )
          : undefined
    });
  };

  const commitDeletion = (ids: string[]) => {
    const removing = new Set(ids);
    setNodes((current) => current.filter((node) => !removing.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) => !removing.has(edge.source) && !removing.has(edge.target)
      )
    );
    setSelectedNodeId((current) =>
      current && removing.has(current) ? null : current
    );
  };

  // Keyboard deletes go through the same confirmation as the panel's.
  const handleNodesChange = useCallback(
    (changes: NodeChange<IgFlowNode>[]) => {
      if (conflictRef.current) {
        const allowed = readOnlyNodeChanges(changes);
        if (allowed.length) onNodesChange(allowed);
        return;
      }
      const removed = changes
        .filter(
          (
            change
          ): change is Extract<NodeChange<IgFlowNode>, { type: "remove" }> =>
            change.type === "remove"
        )
        .map((change) => change.id);
      if (removed.length) requestDeletion(removed);
      const rest = changes.filter((change) => change.type !== "remove");
      if (rest.length) onNodesChange(rest);
    },
    // requestDeletion reads refs and analysis only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysis, onNodesChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.sourceHandle) return;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: newEdgeId(),
            targetHandle: "in",
            type: "smoothstep"
          },
          current.filter(
            (edge) =>
              !(
                edge.source === connection.source &&
                edge.sourceHandle === connection.sourceHandle
              )
          )
        )
      );
    },
    [readOnly, setEdges]
  );

  const selectMedia = (asset: MediaAsset) => {
    const target = mediaPicker;
    setMediaPicker(null);
    if (!target) return;
    if (target.kind === "card") {
      if (asset.fileType !== "image") {
        toast.error("Carousel cards can only show images.");
        return;
      }
      updateNode(target.nodeId, (data) => ({
        ...data,
        content: {
          ...data.content,
          cards: (data.content.cards || []).map((card, index) =>
            index === target.cardIndex
              ? {
                  ...card,
                  mediaId: asset._id,
                  mediaName: asset.name,
                  mediaType: "image" as const,
                  imageUrl: asset.cloudinaryUrl
                }
              : card
          )
        }
      }));
      return;
    }
    updateNode(target.nodeId, (data) => ({
      ...data,
      content: {
        ...data.content,
        mediaId: asset._id,
        mediaName: asset.name,
        mediaUrl: asset.cloudinaryUrl
      }
    }));
  };

  // ---- View current version.
  const enterCurrentView = () => {
    editViewportRef.current = reactFlow?.getViewport() ?? null;
    pendingCurrentFitRef.current = true;
    setCanvasMode("current");
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };
  const exitCurrentView = () => {
    setCanvasMode("draft");
    setSelectedNodeId(null);
    const viewport = editViewportRef.current;
    if (viewport) {
      window.requestAnimationFrame(() => void reactFlow?.setViewport(viewport));
    }
  };
  // Fit the current version once its blocks have been measured.
  useEffect(() => {
    if (!isCurrentView || !pendingCurrentFitRef.current || !reactFlow) return;
    if (
      !currentNodes.length ||
      currentNodes.some((node) => !node.measured?.width)
    ) {
      return;
    }
    pendingCurrentFitRef.current = false;
    window.requestAnimationFrame(
      () => void reactFlow.fitView({ padding: 0.2 })
    );
  }, [currentNodes, isCurrentView, reactFlow]);

  // Left to right from the main menu; animated, and one undo step.
  const autoArrange = async () => {
    if (readOnly || !reactFlow || isArrangingRef.current || !nodes.length)
      return;
    const sizes = new Map(
      nodes.map((node) => {
        const internal = reactFlow.getInternalNode(node.id);
        return [
          node.id,
          {
            width: internal?.measured.width || 300,
            height: internal?.measured.height || 200
          }
        ];
      })
    );
    const handles = new Map(
      nodes.map((node) => [
        node.id,
        (
          reactFlow.getInternalNode(node.id)?.internals.handleBounds?.source ||
          []
        )
          .filter((handle) => handle.id)
          .map((handle) => ({
            id: String(handle.id),
            y: handle.y + handle.height / 2
          }))
      ])
    );
    const start = nodes.find((node) => isMainMenu(node.data)) || nodes[0];
    setIsArranging(true);
    isArrangingRef.current = true;
    try {
      const laidOut = await layoutFlow({
        nodes,
        edges,
        sizes,
        handles,
        firstNodeId: start.id
      });
      // The main menu stays where it is; everything moves around it.
      const startTarget = laidOut.get(start.id) || start.position;
      const dx = start.position.x - startTarget.x;
      const dy = start.position.y - startTarget.y;
      const from = new Map(
        nodes.map((node) => [node.id, { ...node.position }])
      );
      await new Promise<void>((resolve) => {
        const began = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - began) / ARRANGE_DURATION_MS);
          const eased = 1 - Math.pow(1 - progress, 3);
          setNodes((current) =>
            current.map((node) => {
              const a = from.get(node.id);
              const b = laidOut.get(node.id);
              if (!a || !b) return node;
              return {
                ...node,
                position: {
                  x: a.x + (b.x + dx - a.x) * eased,
                  y: a.y + (b.y + dy - a.y) * eased
                }
              };
            })
          );
          if (progress < 1) window.requestAnimationFrame(step);
          else resolve();
        };
        window.requestAnimationFrame(step);
      });
    } catch {
      toast.error("Couldn't arrange the blocks. Try again.");
    } finally {
      isArrangingRef.current = false;
      setIsArranging(false);
      // One more pass so the finished layout is recorded as one undo step.
      setNodes((current) => [...current]);
    }
    void reactFlow.fitView({ padding: 0.2, duration: 300 });
  };

  // Undo/redo and duplicate from the keyboard; in a text field the
  // browser's own undo applies.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || readOnly) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        stepHistory("undo");
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        stepHistory("redo");
      } else if (key === "d" && selectedNodeId) {
        event.preventDefault();
        duplicateNode(selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // ---- Rendering.
  if (!isStatusPending && !isReady) {
    return (
      <AppLayout hideHeader fullBleed>
        <div className="flex h-dvh items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md space-y-3 rounded-xl border bg-white p-6 text-center shadow-xs">
            <Instagram className="mx-auto size-8 text-pink-600" />
            <h1 className="font-heading text-xl font-semibold">
              Connect Instagram first
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect your Instagram professional account to build and switch on
              flows.
            </p>
            <Button asChild>
              <Link href="/instagram">Go to Instagram</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const flowStatus = getEditorFlowStatus(live, draftChanges);
  const primaryAction = getPrimaryAction(
    draftChanges,
    hasLiveVersion,
    hasUnsavedEdits
  );
  const canDiscard =
    hasLiveVersion &&
    !neverApplied &&
    (hasUnsavedEdits || Boolean(draftChanges?.hasUnpublishedChanges));
  const changeCount = draftChanges
    ? draftChanges.changedBlockCount + (draftChanges.startChanged ? 1 : 0)
    : 0;
  const selectedTargets = selectedNode
    ? Object.fromEntries(
        rawViewEdges
          .filter(
            (edge) => edge.source === selectedNode.id && edge.sourceHandle
          )
          .map((edge) => [String(edge.sourceHandle), edge.target])
      )
    : {};
  const unreachableMessage = selectedNode
    ? issues.find(
        (issue) =>
          issue.nodeId === selectedNode.id && issue.code === "UNREACHABLE"
      )?.message
    : undefined;
  const issueCounts = {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity !== "error").length
  };
  const pill = (
    <FlowStatusPill tone={flowStatus.tone} label={flowStatus.label} />
  );
  const mediaTargetNode = mediaPicker
    ? nodes.find((node) => node.id === mediaPicker.nodeId)
    : undefined;

  return (
    <AppLayout hideHeader fullBleed>
      <div className="flex h-dvh flex-col overflow-hidden border bg-white shadow-xs">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-white px-4 py-2">
          <Button asChild variant="ghost" size="sm" className="cursor-pointer">
            <Link
              href="/instagram?tab=canvas"
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Instagram flows
            </Link>
          </Button>
          <div className="min-w-0">
            <InlineEditableTitle
              value={canvasName}
              placeholder="Untitled flow"
              className="font-heading text-xl font-semibold"
              disabled={!canvasName}
              onSave={(name) => renameFlow({ canvasId, name })}
            />
          </div>
          {flowStatus.href ? (
            <Link href={flowStatus.href} className="hover:opacity-80">
              {pill}
            </Link>
          ) : (
            pill
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {saveState === "saving" ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </span>
              ) : saveState === "error" && !conflict ? (
                <span className="text-destructive">
                  Couldn&apos;t save ·{" "}
                  <button
                    type="button"
                    className="cursor-pointer font-medium underline-offset-2 hover:underline"
                    onClick={() => void saveNow()}
                  >
                    Retry
                  </button>
                </span>
              ) : saveState === "saved" && lastSavedAt ? (
                `Saved ${lastSavedAt}`
              ) : null}
            </span>
            {!isCurrentView && issues.length > 0 && (
              <IssuesButton
                issues={issues}
                open={issuesOpen}
                onOpenChange={setIssuesOpen}
                onSelect={focusIssue}
                blockedApply={applyBlocked}
              />
            )}
            <Button
              variant="outline"
              disabled={!visibleNodes.length}
              onClick={() => setTestOpen(true)}
            >
              <Play className="size-4" />
              Test
            </Button>
            <Button variant="outline" onClick={() => setVersionsOpen(true)}>
              <History className="size-4" />
              History
            </Button>
            {hasLiveVersion && !isActive && (
              <Button
                variant="outline"
                disabled={isSwitching || isCurrentView}
                onClick={requestSwitchOn}
              >
                {isSwitching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Power className="size-4" />
                )}
                Switch on
              </Button>
            )}
            <Button
              onClick={() => void apply()}
              disabled={
                isApplying ||
                isCurrentView ||
                isCanvasPending ||
                Boolean(conflict) ||
                primaryAction.disabled
              }
            >
              {isApplying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : primaryAction.disabled ? (
                <Check className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {primaryAction.label}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="More flow actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!hasLiveVersion || isCurrentView}
                  onSelect={enterCurrentView}
                >
                  <Eye className="size-4" />
                  View current version
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canDiscard || isCurrentView || Boolean(conflict)}
                  onSelect={() => setDiscardOpen(true)}
                >
                  <Undo2 className="size-4" />
                  Discard changes
                </DropdownMenuItem>
                {isActive && (
                  <DropdownMenuItem
                    disabled={isSwitching}
                    onSelect={() => void switchOff()}
                  >
                    <PowerOff className="size-4" />
                    Switch off
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {!enabledForPlan && (
          <div className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Your current plan doesn&apos;t include Instagram automation. You can
            keep building this flow, but saving and applying changes are blocked
            until you upgrade.
          </div>
        )}

        {conflict && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b border-destructive/30 bg-red-50 px-4 py-2 text-sm text-red-900"
          >
            <span>
              {conflict.updatedBy?.name || "Someone"} changed this flow after
              you opened it.{" "}
              <button
                type="button"
                className="cursor-pointer font-semibold underline underline-offset-2"
                onClick={() => void reloadTheirVersion()}
              >
                Reload
              </button>{" "}
              to see their changes.
            </span>
          </div>
        )}

        <div className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-800 lg:hidden">
          The flow builder is drag-and-drop and works best on a larger screen.
        </div>

        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1",
            railCollapsed
              ? "lg:grid-cols-[52px_minmax(0,1fr)_340px]"
              : "lg:grid-cols-[250px_minmax(0,1fr)_340px]",
            conflict && "pointer-events-none select-none opacity-60"
          )}
          aria-hidden={conflict ? true : undefined}
        >
          <aside
            className={cn(
              "overflow-y-auto border-r bg-muted/30 [scrollbar-width:thin]",
              railCollapsed ? "px-1.5 py-2" : "p-3"
            )}
          >
            <InstagramFlowRail
              readOnly={readOnly}
              nodes={visibleNodes}
              edges={rawViewEdges}
              selectedNodeId={selectedNodeId}
              issueCounts={
                isCurrentView ? { errors: 0, warnings: 0 } : issueCounts
              }
              collapsed={railCollapsed}
              onCollapsedChange={collapseRail}
              onAdd={addFromRail}
              onSelectNode={showNode}
            />
          </aside>

          <main
            data-ig-flow-canvas
            className="relative min-h-[560px] bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:24px_24px]"
            onDrop={handleDrop}
            onDragOver={(event) => {
              if (readOnly) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
          >
            {isCanvasPending || isStatusPending ? (
              <CanvasLoadingSkeleton />
            ) : isCanvasError ? (
              <div className="flex h-full items-center justify-center p-6">
                <div className="space-y-2 text-center text-sm">
                  <p>Couldn&apos;t load this flow.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchCanvas()}
                  >
                    Try again
                  </Button>
                </div>
              </div>
            ) : (
              <ReactFlow
                nodes={visibleNodes}
                edges={visibleEdges}
                nodeTypes={nodeTypes}
                onInit={setReactFlow}
                onNodesChange={
                  isCurrentView ? handleCurrentNodesChange : handleNodesChange
                }
                onEdgesChange={readOnly ? undefined : onEdgesChange}
                onConnect={onConnect}
                onNodeDragStart={() => {
                  isDraggingRef.current = true;
                }}
                onNodeDragStop={() => {
                  isDraggingRef.current = false;
                }}
                connectionLineType={ConnectionLineType.SmoothStep}
                defaultEdgeOptions={{ type: "smoothstep", style: edgeStyle }}
                onlyRenderVisibleElements
                onNodeClick={(_, node) => {
                  setSelectedEdgeId(null);
                  setSelectedNodeId(node.id);
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  if (readOnly) return;
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                }}
                fitView
                minZoom={0.2}
                maxZoom={1.4}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable
                deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
              >
                <Background />
                <FlowCanvasToolbar
                  readOnly={readOnly}
                  canUndo={historyState.canUndo}
                  canRedo={historyState.canRedo}
                  onUndo={() => stepHistory("undo")}
                  onRedo={() => stepHistory("redo")}
                  onZoomIn={() => void reactFlow?.zoomIn({ duration: 200 })}
                  onZoomOut={() => void reactFlow?.zoomOut({ duration: 200 })}
                  onFit={() =>
                    void reactFlow?.fitView({ padding: 0.2, duration: 300 })
                  }
                  onArrange={() => void autoArrange()}
                  isArranging={isArranging}
                  wiresVisible={wiresVisible}
                  onToggleWires={() => setWiresVisible((value) => !value)}
                  minimapVisible={minimapVisible}
                  onToggleMinimap={() => setMinimapVisible((value) => !value)}
                />
                {minimapVisible && (
                  <MiniMap
                    zoomable
                    pannable
                    nodeStrokeWidth={3}
                    style={{ width: 160, height: 110 }}
                    className="!rounded-lg !border !bg-white/90 !shadow-sm"
                  />
                )}
              </ReactFlow>
            )}
            {isCurrentView && (
              <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-sky-50 px-4 py-2 text-sm text-sky-900">
                <span>You&apos;re viewing the version customers get.</span>
                <Button size="sm" variant="outline" onClick={exitCurrentView}>
                  Back to editing
                </Button>
              </div>
            )}
            {selectedEdgeId && !readOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-4 top-4 z-10 border-destructive/30 bg-white/95 text-destructive shadow-xs"
                onClick={() => {
                  setEdges((current) =>
                    current.filter((edge) => edge.id !== selectedEdgeId)
                  );
                  setSelectedEdgeId(null);
                }}
              >
                <Trash2 className="size-4" />
                Delete connection
              </Button>
            )}
          </main>

          <InstagramBlockInspector
            node={selectedNode}
            readOnly={readOnly}
            updateNode={updateNode}
            blockChoices={viewNodes}
            targets={selectedTargets}
            connectOutput={(handle, targetId) =>
              selectedNode && connectOutput(selectedNode.id, handle, targetId)
            }
            createConnectedBlock={(handle, type) =>
              selectedNode && placeBlockNextTo(selectedNode, type, handle)
            }
            setStart={setStart}
            openMediaPicker={setMediaPicker}
            greetings={greetings}
            entryPoints={
              selectedNode
                ? analysis?.[selectedNode.id]?.entryPoints
                : undefined
            }
            unreachableMessage={unreachableMessage}
            focusRequest={focusRequest}
            onDuplicate={() => selectedNode && duplicateNode(selectedNode.id)}
            onDelete={() => selectedNode && requestDeletion([selectedNode.id])}
          />
        </div>
      </div>

      <MediaPickerDialog
        open={Boolean(mediaPicker)}
        onOpenChange={(open) => !open && setMediaPicker(null)}
        onSelect={selectMedia}
        // Opening the media library leaves this page: save first. If that
        // fails, the leave guard asks before going.
        onBeforeOpenMediaLibrary={async () => {
          await saveNow();
        }}
        requiredType={
          mediaPicker?.kind === "card" ||
          mediaTargetNode?.data.blockType === "send_image"
            ? "IMAGE"
            : "VIDEO"
        }
        selectedMediaId={
          mediaPicker?.kind === "card"
            ? mediaTargetNode?.data.content.cards?.[mediaPicker.cardIndex]
                ?.mediaId
            : mediaTargetNode?.data.content.mediaId
        }
      />
      <FlowDiagramPreviewDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        title="Test this flow"
        platform="Instagram"
        nodes={visibleNodes}
        edges={rawViewEdges}
        defaultMode="try"
        alternateStart={
          selectedNode && !isCurrentView
            ? { nodeId: selectedNode.id, label: selectedNode.data.label }
            : null
        }
      />
      <FlowVersionHistoryDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        canvasId={canvasId}
        readOnly={Boolean(conflict)}
        listVersions={listInstagramCanvasVersions}
        queryKeyPrefix="instagram-canvas-versions"
        onViewLive={enterCurrentView}
        onRestore={(version) =>
          replaceDraft({ kind: "restore", versionId: version._id })
        }
      />
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {changeCount > 0
                ? `Discard ${changeCount} pending change${changeCount === 1 ? "" : "s"} and go back to the current version?`
                : "Discard pending changes and go back to the current version?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void replaceDraft({ kind: "discard" })}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(switchConfirm)}
        onOpenChange={(open) => !open && setSwitchConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              &ldquo;{otherActiveFlow?.name || "Another flow"}&rdquo; is
              answering {username ? `@${username}` : "your Instagram messages"}{" "}
              now. Switch it off and use this flow instead?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Only one flow answers your Instagram messages at a time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = switchConfirm;
                setSwitchConfirm(null);
                if (pending?.kind === "activate") void apply(true);
                else void switchOn();
              }}
            >
              Use this flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(deletion)}
        onOpenChange={(open) => !open && setDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  &quot;{deletion?.label}&quot; and any wires pointing to it
                  will be removed.
                </p>
                {deletion?.reachedFrom && deletion.reachedFrom.length > 0 && (
                  <div>
                    <p>These will stop leading anywhere:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {deletion.reachedFrom.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deletion) commitDeletion(deletion.ids);
                setDeletion(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
