import { DashboardAnalytics } from "@/client-api/types/analytics.type";
import { formatCompactNumber } from "@/lib/utils";

const qualityLabel: Record<string, string> = {
  GREEN: "High",
  YELLOW: "Medium",
  RED: "Low"
};

function formatRelativeTime(isoDate: string | null | undefined) {
  if (!isoDate) return null;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function HealthStrip({ dashboard }: { dashboard: DashboardAnalytics }) {
  const whatsapp = dashboard.integrationHealth.whatsapp;
  const phoneNumbers = whatsapp.phoneNumbers || [];
  const representative =
    phoneNumbers.find((number) => number.isDefault) || phoneNumbers[0];
  const quality = representative?.qualityRating
    ? qualityLabel[representative.qualityRating.toUpperCase()]
    : null;
  const messagingLimit = whatsapp.messagingLimit;
  const lastSynced = formatRelativeTime(
    phoneNumbers
      .map((number) => number.lastHealthCheckAt)
      .filter(Boolean)
      .sort()
      .reverse()[0]
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm shadow-xs">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="font-medium">
            {whatsapp.activePhoneNumbers} number
            {whatsapp.activePhoneNumbers === 1 ? "" : "s"} active
          </span>
        </span>
        {quality && (
          <span className="text-muted-foreground">Quality rating: {quality}</span>
        )}
        {messagingLimit && (
          <span className="text-muted-foreground">
            Messaging limit{" "}
            {messagingLimit.isUnlimited
              ? "Unlimited"
              : messagingLimit.limit
                ? `${formatCompactNumber(messagingLimit.limit)} / 24h`
                : "Not available"}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {dashboard.range.timezone} · Last {dashboard.range.days} days
        {lastSynced && ` · synced ${lastSynced}`}
      </div>
    </div>
  );
}
