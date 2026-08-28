import { checkWindow } from "@/lib/functions/_helpers.lib";
import { Archivo, Inter } from "next/font/google";
import Head from "next/head";
import { useRouter } from "next/router";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  QueryKey
} from "@tanstack/react-query";
import type { AppContext, AppProps } from "next/app";
import App from "next/app";
import React from "react";
import { toast, Toaster } from "sonner";
import "@/styles/globals.css";
import "@xyflow/react/dist/style.css";
import { ApiResponse } from "@/client-api/types/api";
import RouteGuard from "@/components/auth/RouteGuard";
import { NuqsAdapter } from "nuqs/adapters/next/pages";

interface ErrorData {
  response: {
    data: {
      message: string;
    };
  };
}

type PageMeta = {
  title: string;
  description: string;
};

const defaultMeta: PageMeta = {
  title: "Whatching | WhatsApp and Instagram Automation",
  description:
    "Manage WhatsApp broadcasts, shared inbox conversations, automation flows, templates, contacts, and analytics from Whatching."
};

const pageMeta: Record<string, PageMeta> = {
  "/": defaultMeta,
  "/analytics": {
    title: "Analytics | Whatching",
    description:
      "Track message activity, contact growth, conversation status, broadcasts, and channel performance in Whatching."
  },
  "/auth/forgot-password": {
    title: "Forgot Password | Whatching",
    description: "Reset access to your Whatching workspace."
  },
  "/auth/login": {
    title: "Login | Whatching",
    description:
      "Sign in to Whatching to manage customer conversations and automation."
  },
  "/auth/reset-password": {
    title: "Reset Password | Whatching",
    description: "Create a new password for your Whatching account."
  },
  "/auth/signup": {
    title: "Create Account | Whatching",
    description:
      "Create a Whatching account for WhatsApp marketing, automation, and shared inbox workflows."
  },
  "/auth/verify": {
    title: "Verify Account | Whatching",
    description: "Verify your email address to activate Whatching."
  },
  "/broadcasts": {
    title: "Broadcasts | Whatching",
    description:
      "Create, schedule, monitor, and retry WhatsApp template broadcasts."
  },
  "/broadcasts/[broadcastId]": {
    title: "Broadcast Details | Whatching",
    description:
      "Review recipient delivery, read, failure, and retry details for a WhatsApp broadcast."
  },
  "/contacts": {
    title: "Contacts | Whatching",
    description:
      "Manage subscribers, tags, imports, exports, and WhatsApp Business App contact sync."
  },
  "/conversations": {
    title: "Conversations | Whatching",
    description:
      "Handle WhatsApp and Instagram conversations with bot, agent, status, and queue visibility."
  },
  "/flows": {
    title: "WhatsApp Flows | Whatching",
    description:
      "Build, publish, and assign visual WhatsApp automation flows by organization or phone number."
  },
  "/flows/[canvasId]": {
    title: "Flow Builder | Whatching",
    description:
      "Edit WhatsApp automation blocks, routing, follow-ups, media, locations, and publish checks."
  },
  "/instagram": {
    title: "Instagram Automation | Whatching",
    description:
      "Configure Instagram automation, comment rules, media responses, and agent handoff flows."
  },
  "/instagram/[canvasId]": {
    title: "Instagram Flow Builder | Whatching",
    description: "Edit visual Instagram automation workflows in Whatching."
  },
  "/media": {
    title: "Media Library | Whatching",
    description:
      "Upload and manage approved media assets for templates, broadcasts, and automation."
  },
  "/plans": {
    title: "Plans | Whatching",
    description:
      "Compare Whatching plans, trial eligibility, GST-inclusive pricing, and available upgrades."
  },
  "/checkout": {
    title: "Checkout | Whatching",
    description:
      "Review Whatching plan pricing, GST, billing details, and Razorpay checkout."
  },
  "/congratulations": {
    title: "Plan Purchased | Whatching",
    description:
      "Your Whatching plan purchase is being confirmed. Continue to the dashboard or billing settings."
  },
  "/organisations": {
    title: "Organisations | Whatching",
    description:
      "Choose or create an organization workspace for WhatsApp and Instagram operations."
  },
  "/overview": {
    title: "Overview | Whatching",
    description:
      "Review workspace setup, integration health, message limits, and broadcast readiness."
  },
  "/profile": {
    title: "Profile | Whatching",
    description: "Manage your Whatching profile and account details."
  },
  "/reset-password/[token]": {
    title: "Reset Password | Whatching",
    description: "Set a new password for your Whatching account."
  },
  "/settings": {
    title: "Settings | Whatching",
    description:
      "Manage team members, billing, AI knowledge, and workspace support settings."
  },
  "/settings/agents": {
    title: "Agents and Permissions | Whatching",
    description:
      "Invite, edit, and manage team permissions for your Whatching organization."
  },
  "/settings/billing": {
    title: "Billing | Whatching",
    description:
      "Review plan, subscription, payments, and billing history for Whatching."
  },
  "/settings/help": {
    title: "Help and Support | Whatching",
    description:
      "Create support tickets and attach screenshots for help from the Whatching team."
  },
  "/settings/ai": {
    title: "AI Assistant | Whatching",
    description:
      "Manage bot status, AI fallback, token usage, top-ups, and the knowledge base for the Whatching AI agent."
  },
  "/templates": {
    title: "Templates | Whatching",
    description:
      "Manage WhatsApp templates, media requirements, approval status, and quick reply routing."
  },
  "/templates/[templateId]": {
    title: "Template Details | Whatching",
    description:
      "Review WhatsApp template content, approval state, media, and routing details."
  },
  "/templates/create": {
    title: "Create Template | Whatching",
    description:
      "Create and submit WhatsApp message templates with variables, media, buttons, and location details."
  },
  "/verify/[token]": {
    title: "Verify Account | Whatching",
    description: "Complete email verification for your Whatching account."
  }
};

const getPageMeta = (pathname: string) => pageMeta[pathname] || defaultMeta;

/**
 * It suppresses the useLayoutEffect warning when running in SSR mode
 */
function fixSSRLayout() {
  // suppress useLayoutEffect (and its warnings) when not running in a browser
  // hence when running in SSR mode
  if (!checkWindow()) {
    React.useLayoutEffect = () => {
      // console.log("layout effect")
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 0
    }
  },
  mutationCache: new MutationCache({
    onSuccess: (data: unknown, _v, _c, mutation) => {
      const apiData = data as ApiResponse;
      if (mutation.meta?.showToast !== false && apiData.message) {
        toast.success(apiData.message);
      }
    },
    onError: (res) => {
      const result = res as unknown as ErrorData;
      if (result?.response?.data?.message) {
        toast.error(result?.response?.data?.message);
      } else {
        toast.error("An error occurred while processing your request.");
      }
    },
    onSettled: (_data, _error, _variables, _context, mutation) => {
      if (mutation?.meta?.invalidateQueries) {
        queryClient.invalidateQueries({
          queryKey: mutation?.meta?.invalidateQueries as QueryKey,
          refetchType: "all"
        });
      }
    }
  })
});
export const archivo = Archivo({
  display: "swap",
  variable: "--font-archivo",
  subsets: ["latin"]
});
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"]
});
export default function CustomApp({ Component, pageProps }: AppProps) {
  fixSSRLayout();
  const router = useRouter();
  const meta = getPageMeta(router.pathname);

  return (
    <main className={`${archivo.variable} ${inter.variable}`}>
      <Head>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:site_name" content="Whatching" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
      </Head>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <Toaster richColors position="top-right" />
          <RouteGuard>
            <Component {...pageProps} />
          </RouteGuard>
        </NuqsAdapter>
      </QueryClientProvider>
    </main>
  );
}

CustomApp.getInitialProps = async (context: AppContext) => {
  // // const client = initializeApollo({ headers: context.ctx.req?.headers });
  // // resetServerContext();
  const appProps = await App.getInitialProps(context);

  return { ...appProps };
};
