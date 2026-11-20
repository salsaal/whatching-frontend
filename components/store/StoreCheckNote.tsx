import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import type { StoreCheckResponse } from "@/client-api/types/stores.type";
import { cn } from "@/lib/utils";

/** What Check connection found, in a line under the store's status. */
export function StoreCheckNote({
  result,
  className
}: {
  result: StoreCheckResponse["data"];
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-sm",
        result.reachable
          ? "text-primary"
          : result.settingUp
            ? "text-muted-foreground"
            : "text-destructive",
        className
      )}
      role="status"
    >
      {result.reachable ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : result.settingUp ? (
        <Clock className="size-4 shrink-0" />
      ) : (
        <AlertTriangle className="size-4 shrink-0" />
      )}
      {result.reachable
        ? "Store reached, everything's working."
        : result.message ||
          (result.settingUp
            ? "We're still setting up your store."
            : "We couldn't reach your store just now.")}
    </p>
  );
}
