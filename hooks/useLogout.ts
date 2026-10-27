import { useRouter } from "next/router";
import { useCallback, useState } from "react";

import { logoutUser } from "@/client-api/functions/auth";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";

export function useLogout() {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.logout);
  const clearOrganizations = useOrganizationStore(
    (state) => state.clearOrganizations
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      // Best effort: a network failure here must never trap the user in a
      // logged-in UI, so local state is cleared regardless.
      await logoutUser();
    } catch {
      // Ignore -- the refresh token simply expires on its own schedule.
    } finally {
      clearAuth();
      clearOrganizations();
      setIsLoggingOut(false);
      router.push("/auth/login");
    }
  }, [clearAuth, clearOrganizations, router]);

  return { logout, isLoggingOut };
}
