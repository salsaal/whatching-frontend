import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Smartphone,
  Users,
  Wallet
} from "lucide-react";
import { useRouter } from "next/router";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  connectMetaEmbeddedSignup,
  syncMetaIntegration
} from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import AppLayout from "@/layouts/AppLayout";
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
    data.event ||
    (typeof data.data?.event === "string" ? data.data.event : "");
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
  const [lastSignupError, setLastSignupError] = useState("");
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

        upsertOrganization(organization);
        updateIntegrationFromOrganization(organization);
        setSignupSession(null);
        signupSessionRef.current = null;
        pendingAuthResponseRef.current = null;
        toast.success("Meta integration connected");
        if (data.data.subscribedAppsWarning) {
          toast.warning(data.data.subscribedAppsWarning);
        }

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["organization", activeOrgId]
          }),
          queryClient.invalidateQueries({
            queryKey: ["integration-status", activeOrgId]
          })
        ]);
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

  const tryConnectMeta = useCallback((
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
  }, [connectMetaMutate]);

  const stats = [
    {
      label: "Subscribers",
      value: activeOrganization?.usage?.subscribersCount || 0,
      icon: Users
    },
    {
      label: "AI tokens used",
      value: activeOrganization?.usage?.aiTokensUsed || 0,
      icon: Bot
    },
    {
      label: "Wallet balance",
      value: `Rs. ${activeOrganization?.walletBalance || 0}`,
      icon: Wallet
    },
    {
      label: "Templates queued",
      value: 0,
      icon: Send
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
                Track your WhatsApp workspace activity, usage, wallet, and setup
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

            return (
              <div
                key={stat.label}
                className="rounded-lg border bg-white p-5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
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
              </div>
            );
          })}
        </section>

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
                  Connect your customer&apos;s Meta Business and WhatsApp number
                  through Embedded Signup.
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
                  {signupSession.phoneNumberId}. Waiting for authorization to
                  finish.
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

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={!metaAppId || !metaConfigId || isConnectingMeta}
                onClick={startEmbeddedSignup}
              >
                {isConnectingMeta ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                {isMetaReady ? "Reconnect Meta" : "Connect Meta"}
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
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
