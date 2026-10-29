"use client";

import { CheckCircle2, LogOut, Mail, Phone, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { getMe } from "@/client-api/functions/auth";
import { getMyOrganizations } from "@/client-api/functions/organizations";
import { UserAvatar } from "@/components/account/UserMenu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout } from "@/hooks/useLogout";
import AccountLayout from "@/layouts/AccountLayout";
import { useAuthStore } from "@/stores/authStore";

const formatDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(date))
    : "-";

const roleLabel = { owner: "Owner", admin: "Admin", agent: "Agent" } as const;

export default function AccountProfilePage() {
  const setUser = useAuthStore((state) => state.setUser);
  const storedUser = useAuthStore((state) => state.user);
  const { logout, isLoggingOut } = useLogout();

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    refetchOnMount: "always"
  });
  // Same key as /organisations, so the list is usually already cached.
  const { data: organizationsData, isLoading: isOrganizationsLoading } =
    useQuery({
      queryKey: ["organizations", storedUser?._id],
      queryFn: getMyOrganizations,
      enabled: Boolean(storedUser?._id)
    });

  const user = data?.data.user;
  const organizations = organizationsData?.data.organizations || [];

  useEffect(() => {
    if (user) setUser(user);
  }, [setUser, user]);

  return (
    <AccountLayout activeTab="profile">
      <section className="rounded-lg bg-white p-6 shadow-xs">
        {isLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <UserAvatar name={user?.name} className="size-16 text-2xl" />
            <div className="min-w-0 space-y-1.5">
              <h1 className="font-heading text-2xl font-semibold">
                {user?.name}
              </h1>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4 shrink-0" />
                <span className="truncate">{user?.email}</span>
                {user?.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <CheckCircle2 className="size-3.5" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <XCircle className="size-3.5" />
                    Not verified
                  </span>
                )}
              </p>
              {user?.phoneNumber && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-4 shrink-0" />
                  {user.phoneNumber}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Member since {formatDate(user?.createdAt)}
                {user?.passwordChangedAt &&
                  ` · Password changed ${formatDate(user.passwordChangedAt)}`}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow-xs">
        <h2 className="font-heading text-base font-semibold">
          Your organisations
        </h2>
        {isOrganizationsLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : organizations.length ? (
          <ul className="mt-3 divide-y">
            {organizations.map((organization) => (
              <li
                key={organization._id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="truncate text-sm font-medium">
                  {organization.name}
                </span>
                {organization.myRole && (
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {roleLabel[organization.myRole]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;re not in any organisation yet.
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <Button variant="outline" isLoading={isLoggingOut} onClick={logout}>
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </AccountLayout>
  );
}
