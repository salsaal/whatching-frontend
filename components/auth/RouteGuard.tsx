import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/router";
import React, { useEffect } from "react";

const PUBLIC_ROUTES = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify",
  "/verify",
  "/reset-password",
  "/404"
];

const isRoutePublic = (pathname: string) =>
  PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

interface RouteGuardProps {
  children: React.ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const { hasHydrated, isAuthenticated, token } = useAuthStore();
  const publicRoute = isRoutePublic(router.pathname);

  useEffect(() => {
    if (!hasHydrated || publicRoute) return;

    if (!isAuthenticated || !token) {
      router.replace({
        pathname: "/auth/login",
        query: { next: router.asPath }
      });
    }
  }, [hasHydrated, isAuthenticated, publicRoute, router, token]);

  useEffect(() => {
    if (!hasHydrated || !publicRoute || router.pathname !== "/auth/login") {
      return;
    }

    if (isAuthenticated && token) {
      router.replace("/organisations");
    }
  }, [hasHydrated, isAuthenticated, publicRoute, router, token]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!publicRoute && (!isAuthenticated || !token)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
