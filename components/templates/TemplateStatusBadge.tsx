import { cn } from "@/lib/utils";
import { statusLabel } from "./templateUtils";

interface TemplateStatusBadgeProps {
  status: string;
}

export default function TemplateStatusBadge({
  status
}: TemplateStatusBadgeProps) {
  const normalized = status.toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        normalized === "APPROVED" && "bg-emerald-100 text-emerald-700",
        normalized === "PENDING" && "bg-amber-100 text-amber-700",
        normalized === "REJECTED" && "bg-red-100 text-red-700",
        normalized === "DRAFT" && "bg-slate-100 text-slate-700",
        normalized === "ACTION_REQUIRED" && "bg-orange-100 text-orange-700"
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
