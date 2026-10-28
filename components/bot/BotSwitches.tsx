import { Bot, LucideIcon, ShieldAlert, Sparkles } from "lucide-react";
import { ReactNode } from "react";

import { SpamProtectionFields } from "@/components/settings/SpamProtectionFields";
import { Switch } from "@/components/ui/switch";
import { useBotSettings } from "@/hooks/useBotSettings";

function SwitchRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  switchTitle,
  onCheckedChange,
  children
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  switchTitle: string;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={checked}
          disabled={disabled}
          title={switchTitle}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {children}
    </div>
  );
}

export function ActiveBotSwitch() {
  const { settings, planAllowed, isLoading, isUpdating, updateSettings } =
    useBotSettings();
  return (
    <SwitchRow
      icon={Bot}
      title="Active bot"
      description="Global switch for automation across every WhatsApp number."
      checked={Boolean(settings?.isBotEnabled)}
      disabled={isLoading || isUpdating || !planAllowed}
      switchTitle="Turn the active WhatsApp flow on or off"
      onCheckedChange={(checked) => updateSettings({ isBotEnabled: checked })}
    />
  );
}

export function AiFallbackSwitch() {
  const { settings, planAllowed, isLoading, isUpdating, updateSettings } =
    useBotSettings();
  return (
    <SwitchRow
      icon={Sparkles}
      title="AI fallback"
      description="Let AI answer when no flow route matches."
      checked={Boolean(settings?.isAiEnabled)}
      disabled={isLoading || isUpdating || !planAllowed}
      switchTitle="Allow AI fallback when no flow route matches"
      onCheckedChange={(checked) => updateSettings({ isAiEnabled: checked })}
    />
  );
}

export function SpamProtectionSwitch() {
  const { settings, planAllowed, isLoading, isUpdating, updateSettings } =
    useBotSettings();
  return (
    <SwitchRow
      icon={ShieldAlert}
      title="Spam protection"
      description="Automatically mute automated replies to a subscriber who sends too many messages too quickly."
      checked={Boolean(settings?.spamProtectionEnabled)}
      disabled={isLoading || isUpdating || !planAllowed}
      switchTitle="Turn spam-flood muting on or off"
      onCheckedChange={(checked) =>
        updateSettings({ spamProtectionEnabled: checked })
      }
    >
      {settings?.spamProtectionEnabled && (
        <SpamProtectionFields
          threshold={settings.spamFloodThreshold}
          windowSeconds={settings.spamFloodWindowSeconds}
          onSave={(patch) => updateSettings(patch)}
        />
      )}
    </SwitchRow>
  );
}
