import {
  AlertCircle,
  BarChart3,
  Bot,
  Check,
  ChevronsUpDown,
  Megaphone,
  Contact,
  FileText,
  Images,
  Instagram,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Target,
  UserRound,
  Workflow,
  X,
  Zap
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getIntegrationStatus,
  getOrganization
} from "@/client-api/functions/organizations";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { WhatsAppNumberSwitcher } from "@/components/whatsapp/WhatsAppNumberSwitcher";
import assets from "@/json/assets";
import {
  isSubscriptionCanceledWithAccess,
  formatDate,
  getDaysUntil
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Organization, useOrganizationStore } from "@/stores/organizationStore";

interface AppLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
  fullBleed?: boolean;
}

const navigation = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Broadcasts", href: "/broadcasts", icon: Megaphone },
  { label: "Flows", href: "/flows", icon: Workflow },
  { label: "AI Assistant", href: "/settings/ai", icon: Bot },
  { label: "Instagram", href: "/instagram", icon: Instagram },
  { label: "Conversations", href: "/conversations", icon: MessageCircle },
  { label: "Contacts", href: "/contacts", icon: Contact },
  { label: "Campaigns", href: "/campaigns", icon: Target },
  { label: "Media", href: "/media", icon: Images },
  { label: "Settings", href: "/settings", icon: Settings }
];

export default function AppLayout({
  children,
  hideHeader = false,
  fullBleed = false
}: AppLayoutProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [planBannerDismissed, setPlanBannerDismissed] = useState(false);
  const [cancelBannerDismissed, setCancelBannerDismissed] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  const {
    activeOrganization,
    organizations,
    integration,
    hasHydrated,
    setIntegration,
    setActiveOrganization,
    upsertOrganization,
    clearOrganizations
  } = useOrganizationStore();

  const activeOrgId = activeOrganization?._id;

  const handleSwitchOrganization = (organization: Organization) => {
    if (organization._id === activeOrgId) return;
    setActiveOrganization(organization);
    router.push("/overview");
  };

  const { data: organizationData } = useQuery({
    queryKey: ["organization", activeOrgId],
    queryFn: getOrganization,
    enabled: Boolean(activeOrgId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });

  const { data: integrationData, isLoading: isIntegrationLoading } = useQuery({
    queryKey: ["integration-status", activeOrgId],
    queryFn: getIntegrationStatus,
    enabled: Boolean(activeOrgId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });

  const status =
    integration?.state || activeOrganization?.metaConfig?.status || "pending";
  const isReady = status === "ready";
  const currentPlan = activeOrganization?.planTier || "none";
  const isNoPlan = currentPlan === "none";
  const canceledWithAccess =
    isSubscriptionCanceledWithAccess(activeOrganization);
  const shouldShowCancelledPlanBanner =
    router.pathname === "/overview" ||
    router.pathname === "/plans" ||
    router.pathname.startsWith("/settings");
  const cancelBannerKey =
    activeOrgId && activeOrganization?.subscriptionCurrentPeriodEnd
      ? `whatching:dismissed-cancel-banner:${activeOrgId}:${activeOrganization.subscriptionCurrentPeriodEnd}`
      : null;

  useEffect(() => {
    if (!cancelBannerKey || typeof window === "undefined") return;
    try {
      setCancelBannerDismissed(
        window.localStorage.getItem(cancelBannerKey) === "1"
      );
    } catch {
      // Ignore storage access errors (private browsing, etc).
    }
  }, [cancelBannerKey]);

  const dismissCancelBanner = () => {
    setCancelBannerDismissed(true);
    if (!cancelBannerKey) return;
    try {
      window.localStorage.setItem(cancelBannerKey, "1");
    } catch {
      // Ignore storage access errors (private browsing, etc).
    }
  };
  const daysUntilAccessEnds = getDaysUntil(
    activeOrganization?.subscriptionCurrentPeriodEnd
  );

  useEffect(() => {
    if (organizationData?.data.organization) {
      upsertOrganization(organizationData.data.organization);
    }
  }, [organizationData, upsertOrganization]);

  useEffect(() => {
    if (integrationData?.data.integration) {
      setIntegration(integrationData.data.integration);
    }
  }, [integrationData, setIntegration]);

  useEffect(() => {
    if (hasHydrated && !activeOrganization) {
      router.replace("/organisations");
    }
  }, [activeOrganization, hasHydrated, router]);

  const renderNavLinks = (mobile = false) => (
    <nav className={cn("space-y-1", mobile ? "px-0" : "px-3 pt-8 pb-4")}>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive =
          router.pathname === item.href ||
          (item.href === "/settings" &&
            router.pathname.startsWith("/settings/") &&
            router.pathname !== "/settings/help" &&
            router.pathname !== "/settings/ai" &&
            !router.pathname.startsWith("/settings/ai/")) ||
          (item.href !== "/overview" &&
            item.href !== "/settings" &&
            router.pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => mobile && setIsMobileMenuOpen(false)}
            className={cn(
              "flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors",
              isActive
                ? mobile
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-primary/10 text-primary shadow-xs"
                : mobile
                  ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              !mobile &&
                "lg:justify-center lg:gap-0 lg:px-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-3"
            )}
            title={item.label}
          >
            <Icon className="size-5 shrink-0" />
            <span
              className={cn(
                !mobile &&
                  "lg:w-0 lg:overflow-hidden lg:opacity-0 lg:transition-opacity lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:opacity-100"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const handleLogout = () => {
    logout();
    clearOrganizations();
    setIsLogoutOpen(false);
    setIsMobileMenuOpen(false);
    router.push("/auth/login");
  };
  const renderAccountLinks = (mobile = false) => (
    <div className={cn("space-y-1", mobile ? "px-0" : "px-3 pb-4")}>
      <Link
        href="/profile"
        onClick={() => mobile && setIsMobileMenuOpen(false)}
        className={cn(
          "flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors",
          router.pathname === "/profile"
            ? mobile
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-primary/10 text-primary shadow-xs"
            : mobile
              ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          !mobile &&
            "lg:justify-center lg:gap-0 lg:px-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-3"
        )}
      >
        <UserRound className="size-5 shrink-0" />
        <span
          className={cn(
            !mobile &&
              "lg:w-0 lg:overflow-hidden lg:opacity-0 lg:transition-opacity lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:opacity-100"
          )}
        >
          Profile
        </span>
      </Link>
      <button
        type="button"
        onClick={() => setIsLogoutOpen(true)}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors",
          mobile
            ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          !mobile &&
            "lg:justify-center lg:gap-0 lg:px-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-3"
        )}
      >
        <LogOut className="size-5 shrink-0" />
        <span
          className={cn(
            !mobile &&
              "lg:w-0 lg:overflow-hidden lg:opacity-0 lg:transition-opacity lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:opacity-100"
          )}
        >
          Logout
        </span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7faf8] text-foreground">
      <aside className="group/sidebar fixed inset-y-0 left-0 z-[130] hidden w-20 flex-col overflow-hidden bg-white shadow-xs transition-all duration-200 hover:w-64 lg:flex">
        <button
          type="button"
          onClick={() => router.push("/organisations")}
          title="Switch organisation"
          className="relative flex h-18 w-full shrink-0 cursor-pointer items-center border-b px-4"
        >
          {/* Logo */}
          <div className="w-[150px] opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
            <Image
              src={assets.whatchingLogo}
              alt="Whatching"
              width={150}
              height={42}
            />
          </div>

          {/* Icon */}
          <div className="absolute left-1/2 -translate-x-1/2 opacity-100 transition-opacity duration-200 group-hover/sidebar:opacity-0">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-sm bg-primary/10">
              {/* <MessageCircle className="size-5 text-primary" /> */}
              <Image
                src={assets.whatchingIcon}
                alt="Whatching"
                height={200}
                width={200}
                className="h-[100px] w-[100px] object-cover text-primary"
              />
            </div>
          </div>
        </button>

        <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto">
          {renderNavLinks()}
          {renderAccountLinks()}
        </div>
      </aside>

      <div className="transition-all duration-200 lg:pl-20">
        {!hideHeader && (
          <header className="sticky top-0 z-20 bg-white/95 shadow-xs backdrop-blur">
            <div className="grid min-h-18 gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 lg:hidden"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <Menu className="size-5" />
                </Button>
                <div>
                  <p className="text-xs text-muted-foreground">Organisation</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="mt-1 flex cursor-pointer items-center gap-1 text-left font-heading text-lg font-semibold hover:text-primary"
                      >
                        <span className="max-w-[220px] truncate">
                          {activeOrganization?.name || "Select organisation"}
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <DropdownMenuLabel>Switch organisation</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {organizations.map((organization) => (
                        <DropdownMenuItem
                          key={organization._id}
                          onSelect={() => handleSwitchOrganization(organization)}
                          className="justify-between gap-2"
                        >
                          <span className="truncate">{organization.name}</span>
                          {organization._id === activeOrgId && (
                            <Check className="size-4 shrink-0 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => router.push("/organisations")}
                      >
                        Manage organisations
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-center">
                <WhatsAppNumberSwitcher showManage />
                <div className="flex items-center gap-2 rounded-sm bg-background px-3 py-2 shadow-xs">
                  {isIntegrationLoading ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        isReady ? "bg-primary" : "bg-amber-500"
                      )}
                    />
                  )}
                  <span className="text-sm font-medium">
                    WhatsApp Business API:{" "}
                    <span className="capitalize">{status}</span>
                  </span>
                  {!isReady && (
                    <Button
                      size="sm"
                      onClick={() => router.push("/overview?connectMeta=1")}
                    >
                      Connect now
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-start gap-3 lg:justify-end">
                <div className="text-left lg:text-right">
                  <p className="text-xs text-muted-foreground">Current plan</p>
                  <p className="font-heading text-sm font-semibold uppercase">
                    {isNoPlan ? "No plan" : currentPlan}
                  </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/plans")}>
                  <BarChart3 className="size-4" />
                  Explore plan
                </Button>
              </div>
            </div>
          </header>
        )}

        {!hideHeader && isNoPlan && !planBannerDismissed && (
          <div className="px-4 pt-3 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <Zap className="size-4 shrink-0 text-amber-600" />
              <p className="min-w-0 flex-1">
                Choose a plan to unlock broadcasts, automation, analytics, and
                team features.
              </p>
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => router.push("/plans")}
              >
                View plans
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0 text-amber-900"
                tooltip="Dismiss"
                onClick={() => setPlanBannerDismissed(true)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {!hideHeader &&
          canceledWithAccess &&
          shouldShowCancelledPlanBanner &&
          !cancelBannerDismissed && (
            <div className="px-4 pt-3 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-7xl flex-col gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 sm:flex-row sm:items-center">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <p className="min-w-0 flex-1">
                  Your plan is cancelled. Paid features will stop working on{" "}
                  <span className="font-semibold">
                    {formatDate(
                      activeOrganization?.subscriptionCurrentPeriodEnd
                    )}
                  </span>
                  {typeof daysUntilAccessEnds === "number"
                    ? ` (${daysUntilAccessEnds} day${daysUntilAccessEnds === 1 ? "" : "s"} left).`
                    : "."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => router.push("/plans")}
                >
                  Renew plan
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-red-900"
                  tooltip="Dismiss"
                  onClick={dismissCancelBanner}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          )}

        <main className={cn(fullBleed ? "p-0" : "px-4 py-6 sm:px-6 lg:px-8")}>
          {children}
        </main>
      </div>

      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-[86vw] max-w-sm translate-x-0 translate-y-0 rounded-none border-0 p-0 shadow-xs data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
          <div className="flex h-full flex-col bg-white">
            <div className="flex h-18 items-center px-5 shadow-xs">
              <Image
                src={assets.whatchingLogo}
                alt="Whatching"
                width={150}
                height={42}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {renderNavLinks(true)}
              <div className="mt-4 border-t pt-4">
                {renderAccountLinks(true)}
              </div>
            </div>
            <div className="space-y-3 p-4 shadow-xs">
              <div className="rounded-sm bg-background p-3">
                <p className="text-xs text-muted-foreground">Current plan</p>
                <p className="mt-1 font-heading text-sm font-semibold uppercase">
                  {isNoPlan ? "No plan" : currentPlan}
                </p>
              </div>
              <div className="rounded-sm bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  WhatsApp Business API
                </p>
                <p className="mt-1 text-sm font-medium capitalize">{status}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isLogoutOpen} onOpenChange={setIsLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will leave this workspace and need to sign in again before
              managing conversations, flows, broadcasts, or settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleLogout}
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
