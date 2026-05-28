import { checkWindow } from "@/lib/functions/_helpers.lib";
import { Archivo, Inter } from "next/font/google";

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
import { ApiResponse } from "@/api/types/api";
import RouteGuard from "@/components/auth/RouteGuard";
import { NuqsAdapter } from "nuqs/adapters/next/pages";

interface ErrorData {
  response: {
    data: {
      message: string;
    };
  };
}

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

  return (
    <main className={`${archivo.variable} ${inter.variable}`}>
      {/* <SessionProvider session={pageProps.session}> */}
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <Toaster richColors position="bottom-left" />
          <RouteGuard>
            <Component {...pageProps} />
          </RouteGuard>
        </NuqsAdapter>
      </QueryClientProvider>
      {/* </SessionProvider> */}
    </main>
  );
}

CustomApp.getInitialProps = async (context: AppContext) => {
  // // const client = initializeApollo({ headers: context.ctx.req?.headers });
  // // resetServerContext();
  const appProps = await App.getInitialProps(context);

  return { ...appProps };
};
