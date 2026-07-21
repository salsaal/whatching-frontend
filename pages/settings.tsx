"use client";

import {
  Brain,
  CreditCard,
  Loader2,
  Settings,
  Trash2,
  UserPlus,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import { deleteOrganization } from "@/client-api/functions/organizations";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";

const settingsLinks = [
  {
    href: "/settings/agents",
    title: "Agents",
    description:
      "Invite staff, manage team access, and prepare agents for inbox assignment.",
    icon: UsersRound,
    badge: "Team"
  },
  {
    href: "/settings/billing",
    title: "Billing",
    description:
      "Review billing activity, subscription status, and cancellation controls.",
    icon: CreditCard,
    badge: "Plan"
  },
  {
    href: "/settings/knowledge",
    title: "Knowledge Source",
    description:
      "Manage text and file sources used by AI fallback and support answers.",
    icon: Brain,
    badge: "AI"
  }
];

export default function SettingsPage() {
  const router = useRouter();
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const clearOrganizations = useOrganizationStore(
    (state) => state.clearOrganizations
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const { mutate: deleteOrg, isPending: isDeleting } = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      toast.success("Organization deleted.");
      clearOrganizations();
      router.push("/organisations");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message ||
          "Organization could not be deleted. Cancel active subscriptions first."
      );
    }
  });

  const normalizedConfirmation = confirmation.trim().toLowerCase();
  const confirmationMatches =
    Boolean(normalizedConfirmation) &&
    [activeOrganization?.name, activeOrganization?.slug]
      .filter(Boolean)
      .some((value) => value?.trim().toLowerCase() === normalizedConfirmation);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Settings className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Settings</p>
              <h1 className="font-heading text-3xl font-semibold">
                Workspace settings
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage team access and commercial settings from one place.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {settingsLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="h-full rounded-lg transition hover:border-primary/40 hover:shadow-md">
                  <CardContent className="flex h-full gap-4 p-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-heading text-xl font-semibold">
                          {item.title}
                        </h2>
                        <Badge variant="secondary">{item.badge}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>

        <section className="rounded-lg border border-dashed bg-muted/30 p-5">
          <div className="flex gap-3">
            <UserPlus className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="font-medium">Agent assignment starts here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add agents first, then assign conversations to them from the new
                Conversations inbox.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-destructive/25 bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
                <Trash2 className="size-5" />
              </div>
              <div>
                <p className="font-medium text-destructive">
                  Delete organization
                </p>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  This permanently deletes subscribers, conversations, messages,
                  broadcasts, media, flows, Instagram automation, team access,
                  and settings. Active subscriptions must be cancelled first.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              tooltip="Permanently delete this organization and its data"
              onClick={() => {
                setConfirmation("");
                setDeleteOpen(true);
              }}
            >
              Delete organization
            </Button>
          </div>
        </section>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Type the organization name or slug to
              confirm. If a subscription is active, cancel it from Billing
              first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              Type {activeOrganization?.name || activeOrganization?.slug}
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={activeOrganization?.slug || "organization-slug"}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting || !confirmationMatches}
              onClick={(event) => {
                event.preventDefault();
                deleteOrg({ confirmation: confirmation.trim() });
              }}
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
