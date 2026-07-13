import { useEffect } from "react";
import { useRouter } from "next/router";

import { useAuthStore } from "@/stores/authStore";

export default function NotFoundPage() {
  const router = useRouter();
  const { hasHydrated, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;

    router.replace(isAuthenticated && token ? "/overview" : "/auth/login");
  }, [hasHydrated, isAuthenticated, router, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
