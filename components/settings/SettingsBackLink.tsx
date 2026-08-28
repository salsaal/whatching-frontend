import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function SettingsBackLink() {
  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to Settings
    </Link>
  );
}
