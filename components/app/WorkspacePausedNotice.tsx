import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WORKSPACE_PAUSED_TEXT } from "@/lib/workspacePause";

/** Not dismissible: while it's up, nothing reaches customers. */
export function WorkspacePausedNotice({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 sm:flex-row sm:items-center",
        className
      )}
    >
      <AlertCircle className="size-4 shrink-0 text-red-600" />
      <p className="min-w-0 flex-1">{WORKSPACE_PAUSED_TEXT}</p>
      <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
        <Link href="/settings/help">Contact support</Link>
      </Button>
    </div>
  );
}
