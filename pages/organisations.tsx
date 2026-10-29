"use client";

import { Building2, ChevronDown, LogOut, Plus, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getMyOrganizations,
  setupOrganization
} from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CardGridLoadingSkeleton } from "@/components/ui/loading-skeletons";
import assets from "@/json/assets";
import { cn } from "@/lib/utils";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/stores/authStore";
import { Organization, useOrganizationStore } from "@/stores/organizationStore";

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));

const roleLabel: Record<NonNullable<Organization["myRole"]>, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent"
};

function Chip({
  dot,
  children
}: {
  dot?: "green" | "grey" | "amber";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium">
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            dot === "green" && "bg-emerald-500",
            dot === "grey" && "bg-slate-400",
            dot === "amber" && "bg-amber-500"
          )}
        />
      )}
      {children}
    </span>
  );
}

function OrganisationCard({
  organization,
  isLastOpened,
  onOpen
}: {
  organization: Organization;
  isLastOpened: boolean;
  onOpen: () => void;
}) {
  const isConnected = organization.metaConfig?.status === "ready";
  const hasPlan =
    Boolean(organization.planTier) && organization.planTier !== "none";
  const numberCount = organization.activePhoneNumberCount || 0;
  const displayNumber = organization.metaConfig?.displayPhoneNumber;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full cursor-pointer flex-col rounded-lg border border-transparent bg-white p-5 text-left shadow-xs transition hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate font-heading text-lg font-semibold group-hover:text-primary">
          {organization.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {isLastOpened && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Last opened
            </span>
          )}
          {organization.myRole && (
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {roleLabel[organization.myRole]}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip dot={isConnected ? "green" : "grey"}>
          {isConnected ? "Connected" : "Not connected"}
        </Chip>
        {hasPlan ? (
          <Chip>{organization.planTier.toUpperCase()}</Chip>
        ) : (
          <Chip dot="amber">No plan</Chip>
        )}
        {numberCount > 0 && (
          <Chip>
            {numberCount} number{numberCount === 1 ? "" : "s"}
          </Chip>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">
          {displayNumber || ""}
        </span>
        <span className="shrink-0">
          Created {formatDate(organization.createdAt)}
        </span>
      </div>
    </button>
  );
}

function Organisations() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const user = useAuthStore((state) => state.user);
  const { logout: handleLogout, isLoggingOut } = useLogout();
  const {
    organizations,
    activeOrganization,
    setOrganizations,
    addOrganization,
    setActiveOrganization
  } = useOrganizationStore();

  const { data: organizationsData, isLoading } = useQuery({
    queryKey: ["organizations", user?._id],
    queryFn: getMyOrganizations,
    enabled: Boolean(user?._id)
  });

  const { mutate: createOrganization, isPending: isCreating } = useMutation({
    mutationFn: setupOrganization,
    onSuccess: (data) => {
      addOrganization(data.data.organization);
      setName("");
      setIsCreateOpen(false);
      toast.success("Organisation created");
    }
  });

  const handleOpen = (organization: Organization) => {
    setActiveOrganization(organization);
    queryClient.invalidateQueries({ queryKey: ["membership"] });
    router.push("/overview");
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Organisation name is required");
      return;
    }
    createOrganization({ name: name.trim() });
  };

  useEffect(() => {
    if (organizationsData?.data.organizations) {
      setOrganizations(organizationsData.data.organizations);
    }
  }, [organizationsData, setOrganizations]);

  // The org in the store is the one used last, so it leads the list.
  const lastOpenedId = activeOrganization?._id;
  const sortedOrganizations = useMemo(
    () =>
      [...organizations].sort(
        (a, b) =>
          Number(b._id === lastOpenedId) - Number(a._id === lastOpenedId)
      ),
    [lastOpenedId, organizations]
  );

  const addButton = (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus className="size-4" />
      Add organisation
    </Button>
  );

  return (
    <div className="min-h-screen bg-[#f7faf8] text-foreground">
      <header className="sticky top-0 z-20 bg-white/95 shadow-xs backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Image
            src={assets.whatchingLogo}
            alt="Whatching"
            width={150}
            height={42}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-muted"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || "W"}
                </span>
                <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                  {user?.name}
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserRound className="size-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isLoggingOut}
                onSelect={() => void handleLogout()}
              >
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {isLoading ? (
          <CardGridLoadingSkeleton count={6} />
        ) : sortedOrganizations.length ? (
          <>
            <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-heading text-3xl font-semibold">
                  Your organisations
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick one to continue
                </p>
              </div>
              {addButton}
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedOrganizations.map((organization) => (
                <OrganisationCard
                  key={organization._id}
                  organization={organization}
                  isLastOpened={organization._id === lastOpenedId}
                  onOpen={() => handleOpen(organization)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="size-7" />
            </div>
            <h1 className="mt-5 font-heading text-2xl font-semibold">
              Create your first organisation
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An organisation is your workspace: WhatsApp numbers, contacts,
              flows and billing live inside it.
            </p>
            <div className="mt-6">{addButton}</div>
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organisation</DialogTitle>
            <DialogDescription>
              Start with a name. You can connect WhatsApp Business API after
              entering the workspace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Organisation name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Support"
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isCreating}>
                <Plus className="size-4" />
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Organisations;
