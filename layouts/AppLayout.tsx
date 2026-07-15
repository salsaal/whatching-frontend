import {
  BarChart3,
  Check,
  Megaphone,
  Contact,
  CreditCard,
  FileText,
  Images,
  Instagram,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Rocket,
  Settings,
  UserRound,
  Workflow,
  Zap
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getIntegrationStatus,
  getOrganization,
  purchaseSubscription
} from "@/api/functions/organizations";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import assets from "@/json/assets";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";

interface AppLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
  fullBleed?: boolean;
}

const navigation = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Broadcasts", href: "/broadcasts", icon: Megaphone },
  { label: "Flows", href: "/flows", icon: Workflow },
  { label: "Instagram", href: "/instagram", icon: Instagram },
  { label: "Conversations", href: "/conversations", icon: MessageCircle },
  { label: "Contacts", href: "/contacts", icon: Contact },
  { label: "Media", href: "/media", icon: Images },
  { label: "Settings", href: "/settings", icon: Settings }
];

const plans = [
  {
    id: "basic",
    name: "Basic",
    icon: Zap,
    price: "Rs. 2,499",
    description: "Ideal for small businesses",
    features: [
      "Bulk WhatsApp Messaging",
      "5,000 Subscribers",
      "WhatsApp AI Agent",
      "Drag & Drop Chatbot Builder",
      "100,000 AI Message Tokens",
      "2 Team Members",
      "0% Markup Fees",
      "WhatsApp Forms"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    icon: Rocket,
    price: "Rs. 3,999",
    description: "Advanced features for growing businesses",
    highlighted: true,
    features: [
      "Includes all Basic features",
      "15,000 Subscribers",
      "Unlimited AI Message Tokens",
      "5 Team Members",
      "Native WhatsApp Form Builder",
      "Instagram Direct Message Flows",
      "Accept Payments over WhatsApp",
      "Role-Based Team Permissions"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: CreditCard,
    price: "For Scale",
    description: "For high-scale businesses",
    features: [
      "Includes all Pro features",
      "High Volume Subscribers",
      "Custom Business Logic",
      "Unlimited Team Members",
      "More WhatsApp Numbers",
      "Dedicated Account Manager",
      "Priority Support"
    ]
  }
];

export default function AppLayout({
  children,
  hideHeader = false,
  fullBleed = false
}: AppLayoutProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  const {
    activeOrganization,
    integration,
    hasHydrated,
    setIntegration,
    upsertOrganization,
    clearOrganizations
  } = useOrganizationStore();

  const activeOrgId = activeOrganization?._id;

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

  const { mutate: subscribe, isPending: isSubscribing } = useMutation({
    mutationFn: purchaseSubscription,
    onSuccess: (data) => {
      window.location.href = data.data.paymentUrl || "";
    },
    onError: () => toast.error("Unable to start subscription checkout")
  });

  const status =
    integration?.state || activeOrganization?.metaConfig?.status || "pending";
  const isReady = status === "ready";
  const currentPlan = activeOrganization?.planTier || "none";
  const isNoPlan = currentPlan === "none";

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
    <nav className={cn("space-y-1", mobile ? "px-0" : "px-3 py-4")}>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive =
          router.pathname === item.href ||
          (item.href !== "/overview" && router.pathname.startsWith(item.href));

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
      <aside className="group/sidebar fixed inset-y-0 left-0 z-30 hidden w-20 overflow-hidden bg-white shadow-xs transition-all duration-200 hover:w-64 lg:block">
        <div className="relative flex h-18 items-center px-4">
          {/* Logo */}
          <div className="w-[150px] opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
            <Image src={assets.logo} alt="Whatching" width={150} height={42} />
          </div>

          {/* Icon */}
          <div className="absolute left-1/2 -translate-x-1/2 opacity-100 transition-opacity duration-200 group-hover/sidebar:opacity-0">
            <div className="flex size-10 items-center justify-center rounded-sm bg-primary/10">
              <MessageCircle className="size-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100%-72px)] flex-col justify-between">
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
                  <button
                    onClick={() => router.push("/organisations")}
                    className="mt-1 text-left font-heading text-lg font-semibold hover:text-primary"
                  >
                    {activeOrganization?.name || "Select organisation"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-start gap-3 rounded-sm bg-background px-3 py-2 shadow-xs lg:justify-center">
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

              <div className="flex items-center justify-start gap-3 lg:justify-end">
                <div className="text-left lg:text-right">
                  <p className="text-xs text-muted-foreground">Current plan</p>
                  <p className="font-heading text-sm font-semibold uppercase">
                    {isNoPlan ? "No plan" : currentPlan}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setIsPlansOpen(true)}>
                  <BarChart3 className="size-4" />
                  Explore plan
                </Button>
              </div>
            </div>
          </header>
        )}

        <main className={cn(fullBleed ? "p-0" : "px-4 py-6 sm:px-6 lg:px-8")}>
          {children}
        </main>
      </div>

      <Dialog open={isPlansOpen} onOpenChange={setIsPlansOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-0 shadow-xs sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              Explore plans
            </DialogTitle>
            <DialogDescription>
              Choose an infrastructure plan for this organisation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isCurrentPlan = plan.id === currentPlan;

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-lg bg-white p-6 shadow-xs",
                    plan.highlighted && !isCurrentPlan && "bg-emerald-50",
                    isCurrentPlan && "bg-primary/10 ring-1 ring-primary/20"
                  )}
                >
                  <div className="mb-6">
                    <div className="mb-4 flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="font-heading text-xl font-semibold">
                      {plan.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                    <p className="mt-6 font-heading text-3xl font-semibold">
                      {plan.price}
                      {plan.id !== "enterprise" && (
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          /month
                        </span>
                      )}
                    </p>
                  </div>

                  <Button
                    variant={plan.highlighted ? "default" : "outline"}
                    className="mb-6 w-full"
                    disabled={isCurrentPlan}
                    isLoading={isSubscribing}
                    onClick={() => {
                      if (isCurrentPlan) return;

                      if (plan.id === "enterprise") {
                        toast.info("Contact sales flow coming next");
                        return;
                      }

                      subscribe({ tier: plan.id });
                    }}
                  >
                    {isCurrentPlan
                      ? "Current plan"
                      : plan.id === "enterprise"
                        ? "Contact Sales"
                        : "Get Started"}
                  </Button>

                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-[86vw] max-w-sm translate-x-0 translate-y-0 rounded-none border-0 p-0 shadow-xs data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
          <div className="flex h-full flex-col bg-white">
            <div className="flex h-18 items-center px-5 shadow-xs">
              <Image
                src={assets.logo}
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
