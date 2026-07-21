"use client";

import { CheckCircle2, LogOut, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { getMe } from "@/client-api/functions/auth";
import { Button } from "@/components/ui/button";
import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/layouts/AppLayout";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";

const formatDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(date))
    : "-";

export default function ProfilePage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const clearOrganizations = useOrganizationStore(
    (state) => state.clearOrganizations
  );

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    refetchOnMount: "always"
  });

  const user = data?.data.user;

  useEffect(() => {
    if (user) {
      setUser(user);
    }
  }, [setUser, user]);

  const handleLogout = () => {
    logout();
    clearOrganizations();
    router.push("/auth/login");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-lg bg-white p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-sm bg-primary/10">
                <UserRound className="size-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Profile</p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-8 w-52" />
                ) : (
                  <h1 className="mt-1 font-heading text-3xl font-semibold">
                    {user?.name}
                  </h1>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </section>

        {isLoading ? (
          <DetailLoadingSkeleton />
        ) : (
          <section className="grid gap-4 rounded-lg bg-white p-6 shadow-xs sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-1 font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="mt-1 font-medium">{user?.phoneNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verified</p>
              <p className="mt-1 inline-flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-primary" />
                {user?.isVerified ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p className="mt-1 font-medium">{formatDate(user?.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Password changed</p>
              <p className="mt-1 font-medium">
                {formatDate(user?.passwordChangedAt)}
              </p>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
