import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  ShoppingBag
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  checkStoreConnection,
  disconnectStore,
  getStoreStatuses
} from "@/client-api/functions/stores";
import { getAllTemplates } from "@/client-api/functions/templates";
import type {
  StoreCheckResponse,
  StoreConnection,
  StoreResponse
} from "@/client-api/types/stores.type";
import { StoreActivityTab } from "@/components/store/StoreActivityTab";
import { StoreCartRemindersTab } from "@/components/store/StoreCartReminders";
import { StoreCheckNote } from "@/components/store/StoreCheckNote";
import { StoreOrderMessagesTab } from "@/components/store/StoreOrderMessagesTab";
import { useStoreOrdersPage } from "@/components/store/StoreOrdersTable";
import { StoreOverviewTab } from "@/components/store/StoreOverviewTab";
import { StoreSummaryRow } from "@/components/store/StoreSummaryRow";
import { StoreReadyMadeDialog } from "@/components/store/StoreReadyMadeDialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWhatsAppNumberContext } from "@/components/whatsapp/WhatsAppNumberSwitcher";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { storeQueryKey } from "@/hooks/useStore";
import { useStoreView } from "@/hooks/useStoreView";
import { formatRelative } from "@/lib/displayFormat";
import { badgeToneClass } from "@/lib/statusPresentation";
import {
  displayStoreUrl,
  humanizeStatus,
  storeErrorMessage,
  storeStatusPresentation,
  storeTemplateOptions
} from "@/lib/store";
import { hasStorePlugin, isCartReminderTemplate } from "@/lib/storeCarts";
import { STORE_TABS, type StoreTab } from "@/lib/storePage";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

type EndAction = "disconnect" | "reconnect";

/** Disconnect, or Reconnect (disconnect, then the connect screen). */
function EndConnectionDialog({
  connection,
  action,
  onOpenChange
}: {
  connection: StoreConnection;
  action: EndAction | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const { mutate, isPending } = useMutation({
    mutationFn: () => disconnectStore(connection.id),
    meta: { showToast: false },
    onSuccess: async (response) => {
      if (action === "reconnect") {
        toast.success("Store removed. Connect it again below.");
      } else {
        toast.success("Your store is disconnected.", {
          description: response.data.hadAccessKey
            ? "To fully remove Whatching’s access, open WordPress → WooCommerce → Settings → Advanced → REST API, find the Whatching entry, and click Revoke."
            : undefined,
          duration: response.data.hadAccessKey ? 20_000 : undefined
        });
      }
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: storeQueryKey(organizationId)
      });
    },
    onError: (error) =>
      toast.error(
        storeErrorMessage(
          error,
          "Your store couldn't be disconnected. Please try again."
        )
      )
  });

  return (
    <AlertDialog open={Boolean(action)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {action === "reconnect"
              ? "Reconnect your store?"
              : `Disconnect ${connection.storeName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action === "reconnect"
              ? "We'll remove the current connection so you can connect your store again. Order messages stop until you do. Your order history here is kept for 30 days."
              : hasStorePlugin(connection)
                ? "Order messages and cart reminders will stop. Your order history here is kept for 30 days."
                : "Order messages will stop. Your order history here is kept for 30 days."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              action === "disconnect" &&
                "bg-destructive text-white hover:bg-destructive/90"
            )}
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              mutate();
            }}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {action === "reconnect" ? "Remove and reconnect" : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const TAB_TRIGGER =
  "h-auto min-h-11 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-3 text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none";

/** A connected (or connecting) WooCommerce store: card, summary and tabs. */
export function ConnectedStore({
  data,
  enabledForPlan
}: {
  data: StoreResponse["data"];
  enabledForPlan: boolean;
}) {
  const connection = data.connection as StoreConnection;
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const { can } = useCurrentMembership();
  const canManage = can("integrations:manage");
  const { numbers } = useWhatsAppNumberContext();
  const [view, setView] = useStoreView();
  const [endAction, setEndAction] = useState<EndAction | null>(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [checkResult, setCheckResult] = useState<
    StoreCheckResponse["data"] | null
  >(null);

  const { data: templatesData } = useQuery({
    queryKey: ["templates", organizationId],
    queryFn: getAllTemplates,
    enabled: Boolean(organizationId)
  });
  const allTemplates = useMemo(
    () => templatesData?.data.templates || [],
    [templatesData]
  );
  const templatesLoaded = Boolean(templatesData);

  const statusesQuery = useQuery({
    queryKey: ["store-statuses", connection.id],
    queryFn: () => getStoreStatuses(connection.id),
    enabled: connection.status !== "connecting",
    staleTime: 5 * 60_000,
    retry: 1
  });
  const statuses = useMemo(
    () => statusesQuery.data?.data.statuses || [],
    [statusesQuery.data]
  );
  const statusesError = statusesQuery.isError
    ? storeErrorMessage(
        statusesQuery.error,
        "We couldn't read your store's order statuses just now."
      )
    : null;
  const statusName = (slug: string) =>
    statuses.find((status) => status.slug === slug)?.name ||
    humanizeStatus(slug);

  // The previews show totals in the store's currency, as its orders do.
  const currency =
    useStoreOrdersPage(connection.id, 1, "all", { live: false }).data?.data
      .orders[0]?.currency || undefined;

  // Templates belong to the WhatsApp account of the number that sends.
  const senderId = connection.settings?.senderPhoneNumberId;
  const sender =
    numbers.find((number) => number.phoneNumberId === senderId) ||
    numbers.find((number) => number.isDefault) ||
    numbers[0];
  const templateOptions = useMemo(
    () => storeTemplateOptions(allTemplates, sender?.wabaId),
    [allTemplates, sender?.wabaId]
  );
  // Cart reminders: WooCommerce with the backend's plugin support.
  const showPlugin = hasStorePlugin(connection);
  const cartTemplateOptions = useMemo(
    () => templateOptions.filter(isCartReminderTemplate),
    [templateOptions]
  );

  const { mutate: check, isPending: isChecking } = useMutation({
    mutationFn: () => checkStoreConnection(connection.id),
    meta: { showToast: false },
    onSuccess: (response) => {
      setCheckResult(response.data);
      // A failed check also updates the store's status on the server.
      queryClient.invalidateQueries({
        queryKey: storeQueryKey(organizationId)
      });
    },
    onError: (error) =>
      setCheckResult({
        reachable: false,
        message: storeErrorMessage(
          error,
          "We couldn't check your store just now. Please try again."
        )
      })
  });

  const status = storeStatusPresentation(connection.status);
  const checked = connection.lastSyncAt
    ? formatRelative(connection.lastSyncAt).replace(/^Just now$/, "just now")
    : null;
  const tabs = STORE_TABS.filter((tab) => tab.id !== "carts" || showPlugin);
  const tab: StoreTab =
    view.tab === "carts" && !showPlugin ? "overview" : view.tab;
  const openTab = (next: StoreTab) => setView({ tab: next });

  return (
    <div className="space-y-4">
      {!enabledForPlan && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            Your current plan doesn&apos;t include store messages, so none are
            being sent. Store connections are included in the Basic and Pro
            plans.
          </p>
        </div>
      )}

      {/* Store card */}
      <section className="overflow-hidden rounded-lg border bg-white shadow-xs">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShoppingBag className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-heading text-lg font-semibold">
                  {connection.storeName}
                </h2>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    badgeToneClass[status.tone]
                  )}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <a
                  href={connection.storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {displayStoreUrl(connection.storeUrl)}
                </a>
                {" · WooCommerce"}
                {checked && ` · checked ${checked}`}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-2">
              {/* Nothing to check until setup finishes. */}
              {connection.status !== "connecting" && (
                <Button
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  onClick={() => check()}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Check connection
                </Button>
              )}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 sm:size-9"
                    aria-label="More store options"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEndAction("reconnect")}>
                    Reconnect
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setEndAction("disconnect")}
                  >
                    Disconnect store
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {connection.status === "connecting" && (
          <p className="border-t bg-muted/40 px-4 py-3 text-sm text-muted-foreground sm:px-5">
            We&apos;re finishing setting up your store. This usually takes a
            minute.
          </p>
        )}

        {connection.status === "needs_attention" && (
          <div className="flex flex-col gap-3 border-t border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {connection.attention?.message ||
                "Whatching can't reach your store right now."}
            </p>
            {canManage && (
              <Button
                variant="outline"
                className="shrink-0 bg-white"
                onClick={() => setEndAction("reconnect")}
              >
                Reconnect
              </Button>
            )}
          </div>
        )}

        {checkResult && (
          <StoreCheckNote
            result={checkResult}
            className="border-t px-4 py-3 sm:px-5"
          />
        )}

        <StoreSummaryRow
          connectionId={connection.id}
          pluginLinked={connection.plugin?.connected === true}
          onOpenActivity={setView}
        />
      </section>

      <Tabs
        value={tab}
        onValueChange={(next) => openTab(next as StoreTab)}
        className="gap-0 rounded-lg border bg-white shadow-xs"
      >
        <TabsList
          aria-label="Store sections"
          className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent p-0 px-4 sm:px-5"
        >
          {tabs.map((entry) => (
            <TabsTrigger
              key={entry.id}
              value={entry.id}
              className={TAB_TRIGGER}
            >
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="p-4 sm:p-5">
          <StoreOverviewTab
            connection={connection}
            statusName={statusName}
            templates={allTemplates}
            templatesLoaded={templatesLoaded}
            numbers={numbers}
            canManage={canManage}
            showCarts={showPlugin}
            onOpenTab={openTab}
            onCreateTemplates={() => setIsTemplatesOpen(true)}
          />
        </TabsContent>

        <TabsContent value="messages" className="p-4 sm:p-5">
          <StoreOrderMessagesTab
            connection={connection}
            templateVariables={data.templateVariables}
            templates={{ options: templateOptions, allTemplates }}
            templatesLoaded={templatesLoaded}
            statuses={statuses}
            statusesError={statusesError}
            currency={currency}
            canManage={canManage}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
          />
        </TabsContent>

        {showPlugin && (
          // Kept mounted, so unsaved reminder changes survive other tabs.
          <TabsContent
            value="carts"
            forceMount
            className="p-4 data-[state=inactive]:hidden sm:p-5"
          >
            <StoreCartRemindersTab
              connection={connection}
              readyMadeCartTemplate={data.readyMadeCartTemplate}
              variables={data.templateVariables.cart_reminder}
              templates={{ options: cartTemplateOptions, allTemplates }}
              templatesLoaded={templatesLoaded}
              currency={currency}
              canManage={canManage}
            />
          </TabsContent>
        )}

        <TabsContent value="activity" className="p-4 sm:p-5">
          <StoreActivityTab
            connection={connection}
            statuses={statuses}
            view={view}
            onChange={setView}
            showCarts={showPlugin}
          />
        </TabsContent>
      </Tabs>

      <EndConnectionDialog
        connection={connection}
        action={endAction}
        onOpenChange={(open) => !open && setEndAction(null)}
      />
      <StoreReadyMadeDialog
        open={isTemplatesOpen}
        onOpenChange={setIsTemplatesOpen}
        connection={connection}
        readyMadeTemplates={data.readyMadeTemplates}
        templateVariables={data.templateVariables}
        templates={allTemplates}
        currency={currency}
      />
    </div>
  );
}
