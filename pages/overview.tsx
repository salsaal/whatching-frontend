import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Send,
  Smartphone,
  Target,
  Users,
  Gauge
} from "lucide-react";
import { useRouter } from "next/router";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import Link from "next/link";

import { listCampaigns } from "@/client-api/functions/campaigns";
import {
  connectMetaEmbeddedSignup,
  getAiTokenUsage,
  getWhatsAppOutboundReadiness,
  getWhatsAppPhoneNumbers,
  manualConnectWhatsAppNumber,
  syncMetaIntegration,
  testWhatsAppOutboundReadiness
} from "@/client-api/functions/organizations";
import ManualConnectDialog from "@/components/whatsapp/ManualConnectDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import WhatsAppNumbersPanel from "@/components/whatsapp/WhatsAppNumbersPanel";
import { buildMetaPaymentMethodUrl } from "@/lib/metaBilling";
import { cn, formatCompactNumber } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

interface EmbeddedSignupSession {
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
  event: string;
  data: {
    waba_id?: string;
    wabaId?: string;
    phone_number_id?: string;
    phoneNumberId?: string;
    business_id?: string;
    event?: string;
    [key: string]: unknown;
  };
  coexistenceEnabled: boolean;
}

interface FacebookAuthResponse {
  code?: string;
  accessToken?: string;
}

interface FacebookLoginResponse {
  status?: string;
  authResponse?: FacebookAuthResponse;
}

interface FacebookSdk {
  init: (options: {
    appId: string;
    autoLogAppEvents?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: Record<string, unknown>
  ) => void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const facebookGraphVersion =
  process.env.NEXT_PUBLIC_META_GRAPH_VERSION || "v20.0";
const embeddedSignupVersion =
  process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_VERSION || "v4";
const businessAppOnboardingFeatureType = "whatsapp_business_app_onboarding";
const whatsappBusinessAppOnboardingEvent =
  "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";

const facebookAllowedOrigins = [
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://business.facebook.com"
];

const getEmbeddedSignupSession = (
  eventData: unknown
): EmbeddedSignupSession | null => {
  const payload =
    typeof eventData === "string" ? JSON.parse(eventData) : eventData;

  if (!payload || typeof payload !== "object") return null;

  const data = payload as {
    type?: string;
    event?: string;
    data?: {
      waba_id?: string;
      wabaId?: string;
      phone_number_id?: string;
      phoneNumberId?: string;
      business_id?: string;
      businessId?: string;
      event?: string;
      [key: string]: unknown;
    };
  };

  const signupEvent =
    data.event || (typeof data.data?.event === "string" ? data.data.event : "");
  if (data.type !== "WA_EMBEDDED_SIGNUP" || !signupEvent) {
    return null;
  }

  const wabaId = data.data?.waba_id || data.data?.wabaId || "";
  const phoneNumberId =
    data.data?.phone_number_id || data.data?.phoneNumberId || "";
  const businessId = data.data?.business_id || data.data?.businessId;

  if (!wabaId || !phoneNumberId) return null;

  return {
    wabaId,
    phoneNumberId,
    businessId,
    event: signupEvent,
    data: {
      ...data.data,
      waba_id: data.data?.waba_id || wabaId,
      wabaId,
      phone_number_id: data.data?.phone_number_id || phoneNumberId,
      phoneNumberId,
      ...(businessId ? { business_id: businessId } : {}),
      event: signupEvent
    },
    coexistenceEnabled: signupEvent === whatsappBusinessAppOnboardingEvent
  };
};

export default function OverviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isFacebookSdkReady, setIsFacebookSdkReady] = useState(false);
  const [signupSession, setSignupSession] =
    useState<EmbeddedSignupSession | null>(null);
  const [isPaymentPromptOpen, setIsPaymentPromptOpen] = useState(false);
  const [paymentMethodUrl, setPaymentMethodUrl] = useState<string | null>(null);
  const [verificationPhoneNumberRecordId, setVerificationPhoneNumberRecordId] =
    useState("");
  const [lastSignupError, setLastSignupError] = useState("");
  const [isManualConnectOpen, setIsManualConnectOpen] = useState(false);
  const pendingAuthResponseRef = useRef<FacebookAuthResponse | null>(null);
  const signupSessionRef = useRef<EmbeddedSignupSession | null>(null);
  const isConnectingRef = useRef(false);
  const autoStartConnectRef = useRef(false);
  const {
    activeOrganization,
    integration,
    upsertOrganization,
    setIntegration
  } = useOrganizationStore();
  const activeOrgId = activeOrganization?._id;
  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const metaConfigId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
  const isMetaReady =
    integration?.state === "ready" ||
    activeOrganization?.metaConfig?.status === "ready";
  const { data: phoneNumbersData } = useQuery({
    queryKey: ["whatsapp-phone-numbers", activeOrgId],
    queryFn: getWhatsAppPhoneNumbers,
    enabled: Boolean(activeOrgId && isMetaReady),
    refetchOnMount: "always"
  });
  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", "overview-count"],
    queryFn: () => listCampaigns({ limit: 1 }),
    enabled: Boolean(activeOrgId)
  });
  const { isOwner } = useCurrentMembership();
  const { data: aiTokenUsageData } = useQuery({
    queryKey: ["ai-token-usage", activeOrgId],
    queryFn: getAiTokenUsage,
    enabled: Boolean(activeOrgId) && isOwner
  });
  const verificationNumber = useMemo(() => {
    const phoneNumbers = phoneNumbersData?.data.phoneNumbers || [];
    return (
      phoneNumbers.find(
        (number) =>
          (number._id || number.id) === verificationPhoneNumberRecordId
      ) ||
      phoneNumbers.find(
        (number) =>
          number.phoneNumberId === integration?.phoneNumberId &&
          number.status === "active" &&
          number.connectionStatus === "ready"
      ) ||
      phoneNumbers.find(
        (number) =>
          number.isDefault &&
          number.status === "active" &&
          number.connectionStatus === "ready"
      ) ||
      phoneNumbers.find(
        (number) =>
          number.status === "active" && number.connectionStatus === "ready"
      )
    );
  }, [
    integration?.phoneNumberId,
    phoneNumbersData?.data.phoneNumbers,
    verificationPhoneNumberRecordId
  ]);
  const readinessRecordId =
    verificationNumber?._id || verificationNumber?.id || "";
  const {
    data: readinessData,
    isLoading: isReadinessLoading,
    refetch: refetchReadiness
  } = useQuery({
    queryKey: ["whatsapp-outbound-readiness", readinessRecordId],
    queryFn: () => getWhatsAppOutboundReadiness(readinessRecordId),
    enabled: Boolean(readinessRecordId),
    refetchInterval: 4000,
    refetchOnWindowFocus: true
  });
  const readiness = readinessData?.data.readiness;
  const canStartBroadcast =
    readinessData?.data.canStartBroadcast === true ||
    readiness?.status === "ready";
  const effectivePaymentMethodUrl =
    (readinessData?.data.blocker?.details?.paymentSetupUrl as
      | string
      | undefined) ||
    paymentMethodUrl ||
    buildMetaPaymentMethodUrl({
      businessId: activeOrganization?.metaConfig?.clientBusinessId,
      wabaId:
        verificationNumber?.wabaId || activeOrganization?.metaConfig?.wabaId
    });

  const { mutate: runReadinessTest, isPending: isTestingReadiness } =
    useMutation({
      mutationFn: () => {
        if (!readinessRecordId) {
          throw new Error("No active WhatsApp number is available.");
        }
        return testWhatsAppOutboundReadiness(readinessRecordId);
      },
      onSuccess: async (response) => {
        toast.success(
          response.message ||
            "Broadcast verification started. Waiting for Meta's delivery status."
        );
        await refetchReadiness();
      }
    });

  const updateIntegrationFromOrganization = (
    organization: typeof activeOrganization
  ) => {
    if (!organization) return;

    setIntegration({
      state: organization.metaConfig?.status || "pending",
      wabaId: organization.metaConfig?.wabaId,
      phoneNumberId: organization.metaConfig?.phoneNumberId,
      businessAccountName: organization.metaConfig?.businessAccountName,
      displayPhoneNumber: organization.metaConfig?.displayPhoneNumber,
      connectedAt: organization.metaConfig?.connectedAt,
      lastHealthCheckAt: organization.metaConfig?.lastHealthCheckAt
    });
  };

  const { mutate: connectMetaMutate, isPending: isConnectingMeta } =
    useMutation({
      mutationFn: connectMetaEmbeddedSignup,
      onSuccess: async (data) => {
        const organization = data.data.organization;
        const connectedPhoneNumberId = signupSessionRef.current?.phoneNumberId;
        const connectedPaymentUrl = buildMetaPaymentMethodUrl({
          businessId:
            organization.metaConfig?.clientBusinessId ||
            signupSessionRef.current?.businessId,
          wabaId:
            organization.metaConfig?.wabaId || signupSessionRef.current?.wabaId
        });

        upsertOrganization(organization);
        updateIntegrationFromOrganization(organization);
        setSignupSession(null);
        signupSessionRef.current = null;
        pendingAuthResponseRef.current = null;
        toast.success("Meta integration connected");
        toast.info(
          "We initiated broadcast verification. Whatching will create a one-time template and send it to the configured test number to verify payment setup. The test costs approximately Rs. 0.115."
        );
        setPaymentMethodUrl(connectedPaymentUrl);
        setIsPaymentPromptOpen(Boolean(connectedPaymentUrl));
        if (data.data.subscribedAppsWarning) {
          toast.warning(data.data.subscribedAppsWarning);
        }

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["organization", activeOrgId]
          }),
          queryClient.invalidateQueries({
            queryKey: ["integration-status", activeOrgId]
          }),
          queryClient.invalidateQueries({
            queryKey: ["whatsapp-phone-numbers", activeOrgId]
          })
        ]);

        try {
          const phoneNumbers = await getWhatsAppPhoneNumbers();
          const connectedNumber = phoneNumbers.data.phoneNumbers.find(
            (number) => number.phoneNumberId === connectedPhoneNumberId
          );
          if (connectedNumber) {
            const connectedRecordId = connectedNumber._id || connectedNumber.id;
            setVerificationPhoneNumberRecordId(connectedRecordId);
            const verification =
              await testWhatsAppOutboundReadiness(connectedRecordId);
            await queryClient.invalidateQueries({
              queryKey: ["whatsapp-outbound-readiness", connectedRecordId]
            });
            toast.info(
              verification.message ||
                "Broadcast verification is waiting for Meta's delivery status."
            );
          }
        } catch {
          toast.warning(
            "The number is connected, but broadcast verification could not start yet. Add the payment method and retry from Broadcasts."
          );
        }
      },
      onError: () => {
        pendingAuthResponseRef.current = null;
      },
      onSettled: () => {
        isConnectingRef.current = false;
      }
    });

  const { mutate: syncIntegrationMutate, isPending: isSyncingIntegration } =
    useMutation({
      mutationFn: syncMetaIntegration,
      onSuccess: (data) => {
        setIntegration(data.data.integration);
      }
    });

  const { mutate: manualConnectMutate, isPending: isManualConnecting } =
    useMutation({
      mutationFn: manualConnectWhatsAppNumber,
      onSuccess: async (data) => {
        const organization = data.data.organization;
        upsertOrganization(organization);
        updateIntegrationFromOrganization(organization);
        setIsManualConnectOpen(false);
        toast.success("WhatsApp number connected");

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["organization", activeOrgId]
          }),
          queryClient.invalidateQueries({
            queryKey: ["integration-status", activeOrgId]
          }),
          queryClient.invalidateQueries({
            queryKey: ["whatsapp-phone-numbers", activeOrgId]
          })
        ]);
      }
    });

  const tryConnectMeta = useCallback(
    (
      session: EmbeddedSignupSession | null,
      authResponse: FacebookAuthResponse | null
    ) => {
      if (!session || !authResponse || isConnectingRef.current) return;

      if (!session.phoneNumberId) {
        setLastSignupError(
          "Meta returned the WhatsApp Business app onboarding event without a phone number id. Backend onboarding needs the phone number id before it can connect this account."
        );
        return;
      }

      const code = authResponse.code?.trim();

      if (!code) {
        setLastSignupError("Meta did not return an authorization code.");
        return;
      }

      isConnectingRef.current = true;
      setLastSignupError("");
      connectMetaMutate({
        code,
        authResponse: { ...authResponse },
        wabaId: session.wabaId,
        waba_id: session.wabaId,
        whatsappBusinessAccountId: session.wabaId,
        phoneNumberId: session.phoneNumberId,
        phone_number_id: session.phoneNumberId,
        businessPhoneNumberId: session.phoneNumberId,
        businessId: session.businessId,
        business_id: session.businessId,
        event: session.event,
        sessionEvent: session.event,
        signupEvent: session.event,
        data: session.data,
        coexistenceEnabled: session.coexistenceEnabled
      });
    },
    [connectMetaMutate]
  );

  const aiTokensRemaining = aiTokenUsageData?.data.usage?.remaining;
  const stats = [
    {
      label: "Subscribers",
      value: formatCompactNumber(activeOrganization?.usage?.subscribersCount || 0),
      icon: Users
    },
    isOwner && typeof aiTokensRemaining === "number"
      ? {
          label: "AI tokens remaining",
          value: formatCompactNumber(Math.max(0, aiTokensRemaining)),
          icon: Bot,
          href: "/settings/billing#ai-tokens",
          tooltip: "Included plan tokens plus any top-ups, minus usage this cycle."
        }
      : {
          label: "AI tokens used",
          value: formatCompactNumber(activeOrganization?.usage?.aiTokensUsed || 0),
          icon: Bot,
          href: isOwner ? "/settings/billing#ai-tokens" : undefined
        },
    {
      label: "Daily message limit",
      value:
        activeOrganization?.metaConfig?.messagingLimitCount?.toLocaleString(
          "en-IN"
        ) || "Not available",
      icon: Gauge,
      tooltip: "Business-initiated conversations in a rolling 24-hour period."
    },
    {
      label: "Campaigns",
      value: formatCompactNumber(campaignsData?.data.pagination.total || 0),
      icon: Target,
      href: "/campaigns",
      tooltip: "Distinct Click-to-WhatsApp ad campaigns that have driven contacts."
    }
  ];
  const setupItems = useMemo(
    () => [
      { label: "Create organisation", done: Boolean(activeOrganization?._id) },
      {
        label: "Connect WhatsApp Business API",
        done: isMetaReady
      },
      {
        label: "Sync templates",
        done: Boolean(integration?.lastTemplateSyncAt)
      },
      {
        label: "Import contacts",
        done: Boolean(activeOrganization?.usage?.subscribersCount)
      }
    ],
    [
      activeOrganization?._id,
      activeOrganization?.usage?.subscribersCount,
      integration?.lastTemplateSyncAt,
      isMetaReady
    ]
  );
  const isSetupComplete = setupItems.every((item) => item.done);

  useEffect(() => {
    if (!metaAppId) return;

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: metaAppId,
        autoLogAppEvents: true,
        xfbml: true,
        version: facebookGraphVersion
      });
      setIsFacebookSdkReady(true);
    };

    if (window.FB) {
      window.fbAsyncInit();
    }
  }, [metaAppId]);

  useEffect(() => {
    const handleEmbeddedSignupMessage = (event: MessageEvent) => {
      if (!facebookAllowedOrigins.includes(event.origin)) return;

      try {
        const session = getEmbeddedSignupSession(event.data);
        if (!session) return;

        setSignupSession(session);
        signupSessionRef.current = session;
        tryConnectMeta(session, pendingAuthResponseRef.current);
      } catch {
        setLastSignupError("Unable to read Meta embedded signup response.");
      }
    };

    window.addEventListener("message", handleEmbeddedSignupMessage);
    return () =>
      window.removeEventListener("message", handleEmbeddedSignupMessage);
  }, [tryConnectMeta]);

  const startEmbeddedSignup = useCallback(() => {
    if (!metaAppId || !metaConfigId) {
      setLastSignupError(
        "Meta app id or embedded signup configuration id is missing."
      );
      return;
    }

    if (!window.FB || !isFacebookSdkReady) {
      setLastSignupError("Meta SDK is still loading. Try again in a moment.");
      return;
    }

    setLastSignupError("");
    setSignupSession(null);
    signupSessionRef.current = null;
    pendingAuthResponseRef.current = null;
    isConnectingRef.current = false;

    window.FB.login(
      (response) => {
        if (!response.authResponse) {
          setLastSignupError(
            "Meta signup was closed before authorization completed."
          );
          return;
        }

        pendingAuthResponseRef.current = response.authResponse;
        tryConnectMeta(signupSessionRef.current, response.authResponse);
      },
      {
        config_id: metaConfigId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          version: embeddedSignupVersion,
          setup: {},
          featureType: businessAppOnboardingFeatureType,
          feature_type: businessAppOnboardingFeatureType,
          sessionInfoVersion: "3"
        }
      }
    );
  }, [isFacebookSdkReady, metaAppId, metaConfigId, tryConnectMeta]);

  useEffect(() => {
    if (
      autoStartConnectRef.current ||
      router.query.connectMeta !== "1" ||
      !isFacebookSdkReady
    ) {
      return;
    }

    autoStartConnectRef.current = true;
    startEmbeddedSignup();
    router.replace("/overview", undefined, { shallow: true });
  }, [isFacebookSdkReady, router, startEmbeddedSignup]);

  return (
    <AppLayout>
      {metaAppId && (
        <Script
          id="facebook-jssdk"
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
        />
      )}
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Overview</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold">
                {activeOrganization?.name || "Organisation overview"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Track your WhatsApp workspace activity, usage, limits, and setup
                progress.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex items-center gap-2 rounded-sm bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                {isMetaReady ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                {isMetaReady ? "Meta connected" : "Meta pending"}
              </div>
              {integration?.lastHealthCheckAt && (
                <p className="text-xs text-muted-foreground">
                  Last checked{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(new Date(integration.lastHealthCheckAt))}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const cardClassName = cn(
              "rounded-lg border bg-white p-5 shadow-xs",
              stat.href &&
                "block transition hover:border-primary/40 hover:shadow-md"
            );
            const content = (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    className={
                      stat.tooltip
                        ? "cursor-help text-sm text-muted-foreground underline decoration-dotted"
                        : "text-sm text-muted-foreground"
                    }
                    title={stat.tooltip}
                  >
                    {stat.label}
                  </p>
                  <p className="mt-2 font-heading text-2xl font-semibold">
                    {stat.value}
                  </p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </div>
              </div>
            );

            return stat.href ? (
              <Link key={stat.label} href={stat.href} className={cardClassName}>
                {content}
              </Link>
            ) : (
              <div key={stat.label} className={cardClassName}>
                {content}
              </div>
            );
          })}
        </section>

        {isSetupComplete ? (
          <section className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">
                  WhatsApp Business API connected
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {integration?.displayPhoneNumber ||
                    activeOrganization?.metaConfig?.displayPhoneNumber}{" "}
                  ·{" "}
                  {integration?.businessAccountName ||
                    activeOrganization?.metaConfig?.businessAccountName}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  document
                    .getElementById("whatsapp-numbers")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Manage numbers
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSyncingIntegration}
                onClick={() => syncIntegrationMutate()}
              >
                {isSyncingIntegration ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Sync status
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                onClick={() => setIsManualConnectOpen(true)}
              >
                Connect another number manually
              </button>
            </div>
          </section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-lg border bg-white p-6 shadow-xs">
              <h2 className="font-heading text-xl font-semibold">
                Setup checklist
              </h2>
              <div className="mt-5 space-y-3">
                {setupItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-sm border px-4 py-3"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span
                      className={
                        item.done ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      {item.done ? "Done" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-6 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-xl font-semibold">
                    WhatsApp Business API
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Connect your customer&apos;s Meta Business and WhatsApp
                    number through Embedded Signup.
                  </p>
                </div>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary/10">
                  <Smartphone className="size-5 text-primary" />
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-sm bg-muted/50 p-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Number</p>
                  <p className="mt-1 font-medium">
                    {integration?.displayPhoneNumber ||
                      activeOrganization?.metaConfig?.displayPhoneNumber ||
                      "No number connected yet"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Business account
                  </p>
                  <p className="mt-1 font-medium">
                    {integration?.businessAccountName ||
                      activeOrganization?.metaConfig?.businessAccountName ||
                      "Not connected"}
                  </p>
                </div>
                {signupSession && !isMetaReady && (
                  <div className="rounded-sm bg-white p-3 text-xs text-muted-foreground">
                    Received WABA {signupSession.wabaId} and phone number{" "}
                    {signupSession.phoneNumberId}. Waiting for authorization
                    to finish.
                  </div>
                )}
              </div>

              {lastSignupError && (
                <div className="mt-4 flex gap-2 rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{lastSignupError}</span>
                </div>
              )}

              {!metaAppId || !metaConfigId ? (
                <div className="mt-4 rounded-sm bg-amber-50 p-3 text-sm text-amber-800">
                  Add `NEXT_PUBLIC_META_APP_ID` and
                  `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID` to enable Meta
                  Embedded Signup.
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={!metaAppId || !metaConfigId || isConnectingMeta}
                  onClick={
                    isMetaReady
                      ? () =>
                          document
                            .getElementById("whatsapp-numbers")
                            ?.scrollIntoView({ behavior: "smooth" })
                      : startEmbeddedSignup
                  }
                >
                  {isConnectingMeta ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Smartphone className="size-4" />
                  )}
                  {isMetaReady ? "Manage numbers" : "Connect Meta"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!isMetaReady || isSyncingIntegration}
                  onClick={() => syncIntegrationMutate()}
                >
                  {isSyncingIntegration ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Sync status
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                  onClick={() => setIsManualConnectOpen(true)}
                >
                  Connect manually
                </button>
              </div>
            </div>
          </section>
        )}
        {isMetaReady && verificationNumber && (
          <section className="rounded-lg border bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {canStartBroadcast ? (
                    <CheckCircle2 className="size-5 text-primary" />
                  ) : (
                    <Send className="size-5 text-amber-600" />
                  )}
                  <h2 className="font-heading text-lg font-semibold">
                    Broadcast setup
                  </h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {canStartBroadcast
                    ? "This WhatsApp number is verified and ready to create broadcasts."
                    : readinessData?.data.blocker?.message ||
                      readiness?.failureMessage ||
                      "Verify one paid business message before broadcasts are enabled. The test costs approximately Rs. 0.115."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Status:{" "}
                  {isReadinessLoading
                    ? "checking"
                    : String(readiness?.status || "not tested").replace(
                        /_/g,
                        " "
                      )}
                </p>
              </div>
              {!canStartBroadcast && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {effectivePaymentMethodUrl && (
                    <Button variant="outline" asChild>
                      <a
                        href={effectivePaymentMethodUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex gap-2 items-center"
                      >
                        <CreditCard className="size-4" />
                        Add payment method
                      </a>
                    </Button>
                  )}
                  {readiness?.status !== "testing" && (
                    <Button
                      disabled={isTestingReadiness}
                      onClick={() => runReadinessTest()}
                    >
                      {isTestingReadiness ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      {readiness?.status === "template_pending"
                        ? "Check approval and continue"
                        : "Verify broadcasts"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
        <WhatsAppNumbersPanel
          onAddNumber={startEmbeddedSignup}
          addingNumber={isConnectingMeta}
        />
      </div>
      <Dialog open={isPaymentPromptOpen} onOpenChange={setIsPaymentPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add your WhatsApp payment method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Your number is connected. Whatching creates a one-time system
              template and sends it to the configured test recipient. It costs
              approximately Rs. 0.115.
            </p>
            <div className="rounded-sm bg-muted/60 p-3">
              <p className="font-medium capitalize text-foreground">
                {isReadinessLoading
                  ? "Checking broadcast setup"
                  : canStartBroadcast
                    ? "Broadcasts are ready"
                    : String(readiness?.status || "not tested").replace(
                        /_/g,
                        " "
                      )}
              </p>
              {!canStartBroadcast && (
                <p className="mt-1 text-xs leading-5">
                  {readinessData?.data.blocker?.message ||
                    readiness?.failureMessage ||
                    "Add the payment method, then run verification. Broadcast creation unlocks after Meta confirms the test message."}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPaymentPromptOpen(false)}
            >
              Later
            </Button>
            {!canStartBroadcast && effectivePaymentMethodUrl && (
              <Button asChild>
                <a
                  href={effectivePaymentMethodUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-2 items-center"
                >
                  <CreditCard className="size-4" />
                  Add payment method
                </a>
              </Button>
            )}
            {/* {!canStartBroadcast && readiness?.status !== "testing" && (
              <Button
                disabled={!readinessRecordId || isTestingReadiness}
                onClick={() => runReadinessTest()}
              >
                {isTestingReadiness ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {readiness?.status === "template_pending"
                  ? "Check approval"
                  : "Verify broadcasts"}
              </Button>
            )} */}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualConnectDialog
        open={isManualConnectOpen}
        isSaving={isManualConnecting}
        onOpenChange={setIsManualConnectOpen}
        onSave={manualConnectMutate}
      />
    </AppLayout>
  );
}
