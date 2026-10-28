import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import { describePermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function NoAccess({
  feature,
  accessLabel
}: {
  feature: string;
  accessLabel: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-lg bg-white p-8 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </div>
      <h1 className="mt-4 font-heading text-xl font-semibold">
        You don&apos;t have access to {feature}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask your organization owner to give you {accessLabel} access.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/overview" className="flex items-center gap-2">
          <ArrowLeft className="size-4" />
          Back to Overview
        </Link>
      </Button>
    </div>
  );
}

// Wraps a whole page: renders it only once the member is known to hold
// `permission`. Until then it shows a skeleton (never a flash of the page),
// and if they lack it, the No-access panel inside the normal app shell.
export function PermissionGate({
  permission,
  feature,
  children
}: {
  permission: string;
  feature: string;
  children: ReactNode;
}) {
  const { can, isLoading, permissionSchema } = useCurrentMembership();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl">
          <DetailLoadingSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (!can(permission)) {
    const described = describePermission(permission, permissionSchema);
    return (
      <AppLayout>
        <NoAccess
          feature={feature}
          accessLabel={
            described === permission ? `${feature} (${permission})` : described
          }
        />
      </AppLayout>
    );
  }

  return <>{children}</>;
}

// A button the user can see but not use. The shared Button's real
// `disabled` state sets pointer-events: none, which also kills its hover
// tooltip -- so this only *looks* disabled (and says so to assistive tech)
// while keeping the tooltip that explains why.
export function LockedButton({
  reason,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "disabled" | "tooltip"> & {
  reason: string;
}) {
  return (
    <Button
      {...props}
      aria-disabled="true"
      tooltip={reason}
      className={cn("cursor-not-allowed opacity-60", className)}
      onClick={(event) => event.preventDefault()}
    >
      {children}
    </Button>
  );
}
