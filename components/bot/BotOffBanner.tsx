import { PowerOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBotSettings } from "@/hooks/useBotSettings";

// Shown on Bot tabs whose features only run while the master bot switch is
// on. Renders nothing until settings load, or when the bot is on.
export function BotOffBanner({ message }: { message: string }) {
  const { settings, planAllowed, isUpdating, updateSettings } =
    useBotSettings();
  if (!settings || settings.isBotEnabled) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <PowerOff className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
      <p className="min-w-0 flex-1 font-medium">{message}</p>
      <Button
        size="sm"
        className="shrink-0"
        disabled={!planAllowed}
        isLoading={isUpdating}
        onClick={() => updateSettings({ isBotEnabled: true })}
      >
        Turn on bot
      </Button>
    </div>
  );
}
