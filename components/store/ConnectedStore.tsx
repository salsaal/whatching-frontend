import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
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
import { StoreCartLog } from "@/components/store/StoreCartLog";
import { StoreCartReminders } from "@/components/store/StoreCartReminders";
import { StoreCheckNote } from "@/components/store/StoreCheckNote";
import { StoreCodSection } from "@/components/store/StoreCodSection";
import { StoreMessagesSection } from "@/components/store/StoreMessagesSection";
import { StoreOrderLog } from "@/components/store/StoreOrderLog";
import { StorePluginCard } from "@/components/store/StorePluginCard";
import { StoreTemplatesDialog } from "@/components/store/StoreTemplatesDialog";
import { useStoreSettings } from "@/components/store/useStoreSettings";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useWhatsAppNumberContext } from "@/components/whatsapp/WhatsAppNumberSwitcher";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { storeQueryKey } from "@/hooks/useStore";
import { formatWhen } from "@/lib/displayFormat";
import { formatPhoneNumber } from "@/lib/inbox";
import { badgeToneClass } from "@/lib/statusPresentation";
import {
  displayStoreUrl,
  storeErrorMessage,
  storeStatusPresentation,
  storeTemplateOptions,
  storeTemplatesState
} from "@/lib/store";
import { hasStorePlugin, isCartReminderTemplate } from "@/lib/storeCarts";
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
            ? "To fully remove Whatching’s access, open WordPress → WooCommerce → Settings → Advanced → REST API and revoke the Whatching key."
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

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
  ) : (
    <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
  );
}

/** Screen D and everything under it, for a store that is set up. */
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
  const { save } = useStoreSettings(connection.id);
  const [endAction, setEndAction] = useState<EndAction | null>(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [checkResult, setCheckResult] = useState<
    StoreCheckResponse["data"] | null
  >(null);
  const [senderError, setSenderError] = useState<string | null>(null);

  const { data: templatesData } = useQuery({
    queryKey: ["templates", organizationId],
    queryFn: getAllTemplates,
    enabled: Boolean(organizationId)
  });
  const allTemplates = useMemo(
    () => templatesData?.data.templates || [],
    [templatesData]
  );

  const statusesQuery = useQuery({
    queryKey: ["store-statuses", connection.id],
    queryFn: () => getStoreStatuses(connection.id),
    enabled: connection.status !== "connecting",
    staleTime: 5 * 60_000,
    retry: 1
  });
  const statuses = statusesQuery.data?.data.statuses || [];
  const statusesError = statusesQuery.isError
    ? storeErrorMessage(
        statusesQuery.error,
        "We couldn't read your store's order statuses just now."
      )
    : null;

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
  // Chosen: every message that's on has a template, some may be in review.
  const { ready: templatesReady, chosen: templatesChosen } =
    storeTemplatesState(connection.settings?.messages, allTemplates);
  const needsSender = numbers.length > 1;
  const checklistDone = templatesReady && (!needsSender || Boolean(senderId));

  return (
    <div className="space-y-6">
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

      {/* Header */}
      <section className="rounded-lg border bg-white shadow-xs">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingBag className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-heading text-xl font-semibold">
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
              <a
                href={connection.storeUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                {displayStoreUrl(connection.storeUrl)}
                <ExternalLink className="size-3.5" />
              </a>
              {connection.lastSyncAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last checked {formatWhen(connection.lastSyncAt).toLowerCase()}
                </p>
              )}
            </div>
          </div>
          {/* Nothing to check until setup finishes. */}
          {canManage && connection.status !== "connecting" && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
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
            </div>
          )}
        </div>

        {connection.status === "connecting" && (
          <p className="border-t bg-muted/40 px-5 py-3 text-sm text-muted-foreground sm:px-6">
            We&apos;re finishing setting up your store. This usually takes a
            minute.
          </p>
        )}

        {connection.status === "needs_attention" && (
          <div className="flex flex-col gap-3 border-t border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
            className="border-t px-5 py-3 sm:px-6"
          />
        )}

        <p className="border-t px-5 py-3 text-xs text-muted-foreground sm:px-6">
          WhatsApp (Meta) charges for each order message delivered. Meta bills
          you directly; Whatching doesn&apos;t add a charge.
        </p>
      </section>

      {showPlugin && (
        <StorePluginCard connection={connection} canManage={canManage} />
      )}

      {/* Set-up checklist, until it's complete */}
      {templatesData && !checklistDone && (
        <section className="rounded-lg border bg-white p-5 shadow-xs sm:p-6">
          <h2 className="font-heading text-xl font-semibold">
            Finish setting up
          </h2>
          <ol className="mt-4 space-y-4">
            <li className="flex gap-3">
              <StepIcon done={templatesReady} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Choose approved templates</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Every message that&apos;s turned on needs a WhatsApp template
                  that&apos;s been approved. The quickest way is to use ours.
                </p>
                {!templatesReady && templatesChosen ? (
                  <p className="mt-2 text-sm text-amber-800">
                    Waiting for WhatsApp to approve your templates. This usually
                    takes a few minutes.
                  </p>
                ) : (
                  canManage &&
                  !templatesReady && (
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => setIsTemplatesOpen(true)}
                    >
                      Create ready-made templates
                    </Button>
                  )
                )}
              </div>
            </li>
            {needsSender && (
              <li className="flex gap-3">
                <StepIcon done={Boolean(senderId)} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    Choose the WhatsApp number to send from
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Order messages go out from this number, using its templates.
                  </p>
                  <Select
                    value={senderId || ""}
                    disabled={!canManage}
                    onValueChange={async (value) => {
                      setSenderError(
                        await save({ senderPhoneNumberId: value })
                      );
                    }}
                  >
                    <SelectTrigger className="mt-3 w-full bg-white sm:w-80">
                      <SelectValue placeholder="Choose a number" />
                    </SelectTrigger>
                    <SelectContent>
                      {numbers.map((number) => (
                        <SelectItem
                          key={number.phoneNumberId}
                          value={number.phoneNumberId}
                        >
                          {formatPhoneNumber(number.displayPhoneNumber) ||
                            number.verifiedName ||
                            "WhatsApp number"}
                          {number.verifiedName &&
                            number.displayPhoneNumber &&
                            ` · ${number.verifiedName}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {senderError && (
                    <p className="mt-2 text-xs text-destructive">
                      {senderError}
                    </p>
                  )}
                </div>
              </li>
            )}
          </ol>
        </section>
      )}

      <StoreMessagesSection
        connection={connection}
        templateVariables={data.templateVariables}
        templates={{ options: templateOptions, allTemplates }}
        statuses={statuses}
        statusesError={statusesError}
        canManage={canManage}
      />

      <StoreCodSection connection={connection} canManage={canManage} />

      {showPlugin && (
        <StoreCartReminders
          connection={connection}
          readyMadeCartTemplate={data.readyMadeCartTemplate}
          variables={data.templateVariables.cart_reminder}
          templates={{ options: cartTemplateOptions, allTemplates }}
          canManage={canManage}
        />
      )}

      <StoreOrderLog
        connectionId={connection.id}
        customRules={connection.settings?.customStatusRules || []}
        statuses={statuses}
      />

      {showPlugin && connection.plugin?.connected && (
        <StoreCartLog connectionId={connection.id} />
      )}

      {canManage && (
        <section className="flex flex-col gap-3 rounded-lg border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="font-medium">Disconnect store</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {showPlugin
                ? "Stops order messages and cart reminders. Your order history here is kept for 30 days."
                : "Stops order messages. Your order history here is kept for 30 days."}
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setEndAction("disconnect")}
          >
            Disconnect
          </Button>
        </section>
      )}

      <EndConnectionDialog
        connection={connection}
        action={endAction}
        onOpenChange={(open) => !open && setEndAction(null)}
      />
      <StoreTemplatesDialog
        open={isTemplatesOpen}
        onOpenChange={setIsTemplatesOpen}
        connectionId={connection.id}
        platform={connection.platform}
        readyMadeTemplates={data.readyMadeTemplates}
        templateVariables={data.templateVariables}
      />
    </div>
  );
}
