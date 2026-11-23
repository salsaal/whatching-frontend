"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "sonner";

import { deleteDrip, listDrips } from "@/client-api/functions/drips";
import { Drip, DripStatus } from "@/client-api/types/drips.type";
import { PermissionGate } from "@/components/common/NoAccess";
import { ConfirmDialog } from "@/components/drips/ConfirmDialog";
import { DripHowItWorks, DripPlanNotice } from "@/components/drips/DripIntro";
import { DripStatusBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useWhatsAppNumberContext } from "@/components/whatsapp/WhatsAppNumberSwitcher";
import AppLayout from "@/layouts/AppLayout";
import { formatCount, formatRelative } from "@/lib/displayFormat";
import { dripErrorMessage } from "@/lib/drips";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

const TABS: Array<{ value: string; label: string; status?: DripStatus }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts", status: "draft" },
  { value: "active", label: "Running", status: "active" },
  { value: "paused", label: "Paused", status: "paused" },
  { value: "archived", label: "Archived", status: "archived" }
];

const messagesText = (drip: Drip) =>
  `${drip.steps.length} message${drip.steps.length === 1 ? "" : "s"}`;

function DripsPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const hasPlan = useOrganizationStore(
    (state) => (state.activeOrganization?.planTier || "none") !== "none"
  );
  const { numbers } = useWhatsAppNumberContext();
  const [tab, setTab] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Drip | null>(null);
  const activeTab = TABS.find((item) => item.value === tab) || TABS[0];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["drips", orgId, activeTab.status || "all"],
    queryFn: () => listDrips(activeTab.status),
    enabled: Boolean(orgId),
    refetchOnMount: "always",
    refetchInterval: 15_000
  });
  const drips = data || [];

  const { mutate: removeDraft, isPending: isDeleting } = useMutation({
    mutationFn: deleteDrip,
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Draft deleted.");
      queryClient.invalidateQueries({ queryKey: ["drips"] });
      setDeleteTarget(null);
    },
    onError: (failure) =>
      toast.error(dripErrorMessage(failure, "The draft couldn't be deleted."))
  });

  const senderLabel = (drip: Drip) => {
    const number = numbers.find(
      (item) => item.phoneNumberId === drip.phoneNumberId
    );
    return number?.displayPhoneNumber || "";
  };
  const whenText = (drip: Drip) =>
    drip.activatedAt
      ? `Started ${formatRelative(drip.activatedAt)}`
      : `Created ${formatRelative(drip.createdAt)}`;

  const createButton = hasPlan ? (
    <Button asChild>
      <Link href="/drips/new">
        <Plus className="size-4" />
        Create drip
      </Link>
    </Button>
  ) : null;

  const rowActions = (drip: Drip) => (
    <div
      className="flex justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions for ${drip.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/drips/${drip.id}`}>
              {drip.status === "draft" ? "Edit" : "View"}
            </Link>
          </DropdownMenuItem>
          {drip.status === "draft" && (
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setDeleteTarget(drip)}
            >
              <Trash2 className="size-4" />
              Delete draft
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const count = (value: number, drip: Drip) =>
    drip.status === "draft" ? (
      <span className="text-muted-foreground">-</span>
    ) : (
      formatCount(value)
    );

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5 pb-20 sm:pb-0">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold">
              Drip campaigns
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Send each contact a short series of WhatsApp messages, one after
              another, with a wait between each. People who reply drop out on
              their own.
            </p>
          </div>
          <div className="hidden sm:block">{createButton}</div>
        </section>

        {!hasPlan && <DripPlanNotice />}

        <section className="flex gap-1 overflow-x-auto rounded-lg bg-white p-3 shadow-xs">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={cn(
                "shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition",
                tab === item.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </section>

        {isError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center">
            <ShieldAlert className="size-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">
              {dripErrorMessage(error, "Drips couldn't be loaded.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <section className="rounded-lg bg-white shadow-xs">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14" />
                ))}
              </div>
            ) : drips.length === 0 ? (
              tab === "all" ? (
                <DripHowItWorks action={createButton} />
              ) : (
                <p className="px-6 py-14 text-center text-sm text-muted-foreground">
                  No drips here.
                </p>
              )
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Drip</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">
                          In progress
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Finished
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Left early
                        </th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {drips.map((drip) => (
                        <tr
                          key={drip.id}
                          onClick={() => router.push(`/drips/${drip.id}`)}
                          className="cursor-pointer border-b transition last:border-0 hover:bg-muted/40"
                        >
                          <td className="max-w-80 px-4 py-3">
                            <p className="truncate font-medium">{drip.name}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {messagesText(drip)}
                              {senderLabel(drip) &&
                                ` · from ${senderLabel(drip)}`}{" "}
                              · {whenText(drip)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <DripStatusBadge status={drip.status} />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {count(drip.contacts.active, drip)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {count(drip.contacts.completed, drip)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {count(drip.contacts.stopped, drip)}
                          </td>
                          <td className="px-4 py-3">{rowActions(drip)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y md:hidden">
                  {drips.map((drip) => (
                    <li
                      key={drip.id}
                      onClick={() => router.push(`/drips/${drip.id}`)}
                      className="cursor-pointer space-y-2 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{drip.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {messagesText(drip)} · {whenText(drip)}
                          </p>
                        </div>
                        <DripStatusBadge status={drip.status} />
                      </div>
                      {drip.status !== "draft" && (
                        <p className="text-xs text-muted-foreground">
                          {formatCount(drip.contacts.active)} in progress ·{" "}
                          {formatCount(drip.contacts.completed)} finished ·{" "}
                          {formatCount(drip.contacts.stopped)} left early
                        </p>
                      )}
                      {drip.status === "draft" && rowActions(drip)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>

      {createButton && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-3 sm:hidden [&_a]:w-full">
          {createButton}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this draft?"
        body="Nothing has been sent from it. This can't be undone."
        action="Delete draft"
        isPending={isDeleting}
        onConfirm={() => deleteTarget && removeDraft(deleteTarget.id)}
      />
    </AppLayout>
  );
}

export default function DripsPage() {
  return (
    <PermissionGate permission="broadcasts:manage" feature="Drip campaigns">
      <DripsPageContent />
    </PermissionGate>
  );
}
