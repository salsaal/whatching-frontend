import { ChevronDown, KeyRound, LogOut, Repeat, UserRound } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/hooks/useLogout";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

export function UserAvatar({
  name,
  className
}: {
  name?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary",
        className
      )}
    >
      {name?.charAt(0)?.toUpperCase() || "W"}
    </span>
  );
}

// The one account menu: in the /organisations and /account top bars and the
// app sidebar. "Switch organisation" only makes sense inside an org.
export function UserMenu({
  showSwitchOrganisation = false,
  side = "bottom",
  align = "end",
  trigger
}: {
  showSwitchOrganisation?: boolean;
  side?: "top" | "bottom" | "right";
  align?: "start" | "end";
  /** Custom trigger content; defaults to avatar + name + chevron. */
  trigger?: React.ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  const { logout, isLoggingOut } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ? (
          <button type="button" className="w-full cursor-pointer text-left">
            {trigger}
          </button>
        ) : (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-muted"
          >
            <UserAvatar name={user?.name} />
            <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
              {user?.name}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/security">
            <KeyRound className="size-4" />
            Change password
          </Link>
        </DropdownMenuItem>
        {showSwitchOrganisation && (
          <DropdownMenuItem asChild>
            <Link href="/organisations">
              <Repeat className="size-4" />
              Switch organisation
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isLoggingOut}
          onSelect={() => void logout()}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
