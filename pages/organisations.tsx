"use client";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Loader2,
  LogOut,
  Plus,
  Smartphone,
  Sparkles,
  Wallet
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getMyOrganizations,
  setupOrganization
} from "@/api/functions/organizations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import assets from "@/json/assets";
import { useAuthStore } from "@/stores/authStore";
import { Organization, useOrganizationStore } from "@/stores/organizationStore";

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));

const planLabel = (planTier: string) =>
  planTier === "none" ? "No active plan" : planTier.toUpperCase();

function Organisations() {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const {
    organizations,
    setOrganizations,
    addOrganization,
    setActiveOrganization,
    clearOrganizations
  } = useOrganizationStore();

  const firstName = useMemo(
    () => user?.name?.split(" ")?.[0] || "there",
    [user?.name]
  );

  const { data: organizationsData, isLoading } = useQuery({
    queryKey: ["organizations", user?._id],
    queryFn: getMyOrganizations,
    enabled: Boolean(user?._id)
  });

  const { mutate: createOrganization, isPending: isCreating } = useMutation({
    mutationFn: setupOrganization,
    onSuccess: (data) => {
      const organization = data.data.organization;

      addOrganization(organization);
      setName("");
      setIsCreateOpen(false);
      toast.success("Organisation created");
    }
  });

  const handleLogout = () => {
    logout();
    clearOrganizations();
    router.push("/auth/login");
  };

  const handleView = (organization: Organization) => {
    setActiveOrganization(organization);
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

  return (
    <div className="min-h-screen bg-[#f7faf8] text-foreground">
      <header className="sticky top-0 z-20 bg-white/95 shadow-xs backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Image src={assets.logo} alt="Whatching" width={150} height={42} />

          <div className="flex items-center gap-3">
            <div className="hidden size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary sm:flex">
              {user?.name?.charAt(0)?.toUpperCase() || "W"}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8">
          <p className="text-sm font-medium text-primary">Workspace</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-normal sm:text-4xl">
            Welcome, {firstName}
          </h1>
        </section>

        <section className="mb-12 overflow-hidden rounded-lg bg-emerald-50/70 shadow-xs">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_360px] lg:items-center lg:p-12">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex size-12 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                <Building2 className="size-6" />
              </div>
              <h2 className="font-heading text-2xl font-semibold">
                Create New Organisation
              </h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                One organisation is associated with one WhatsApp Business API
                number and its billing workspace.
              </p>

              <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" />
                Add organisation
              </Button>
            </div>

            <div className="hidden rounded-lg bg-white p-6 shadow-xs lg:block">
              <div className="flex flex-col items-start gap-4">
                <div className="flex size-16 items-center p-4 justify-center rounded-sm bg-primary/10">
                  <Sparkles className="size-6 text-primary" />
                </div>
                <div>
                  <p className="font-heading text-xl font-semibold">
                    WhatsApp growth hub
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage broadcasts, contacts, templates, wallet, and
                    integrations per organisation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-semibold">
                Recent Organisations
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an organisation to continue.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-56 items-center justify-center rounded-lg bg-white shadow-xs">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : organizations.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {organizations.map((organization) => (
                <Card
                  key={organization?._id}
                  className="rounded-lg border-0 bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-2xl">
                      {organization?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 font-medium capitalize text-primary">
                          <CheckCircle2 className="size-4" />
                          {organization?.metaConfig?.status || "pending"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Active plan</p>
                        <p className="mt-1 font-semibold text-emerald-900">
                          {planLabel(organization?.planTier)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center justify-between rounded-sm bg-muted/50 px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Smartphone className="size-4" />
                          Number
                        </span>
                        <span className="font-medium">
                          {organization?.metaConfig?.displayPhoneNumber ||
                            "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-sm bg-muted/50 px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Wallet className="size-4" />
                          Wallet
                        </span>
                        <span className="font-medium">
                          Rs. {organization?.walletBalance}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-sm bg-muted/50 px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <CalendarDays className="size-4" />
                          Created
                        </span>
                        <span className="font-medium">
                          {formatDate(organization?.createdAt)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleView(organization)}
                    >
                      View
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg bg-white p-8 text-center shadow-xs">
              <Building2 className="size-10 text-primary" />
              <h3 className="mt-4 font-heading text-xl font-semibold">
                No organisations yet
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Add your first organisation to connect WhatsApp Business API and
                start managing campaigns.
              </p>
              <Button className="mt-5" onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" />
                Add organisation
              </Button>
            </div>
          )}
        </section>
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
                placeholder="Zaki GYM"
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
