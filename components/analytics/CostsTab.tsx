import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  enableTemplateInsights,
  getConversationCostAnalytics,
  getTemplateAnalytics,
  getTemplateInsightsStatus
} from "@/client-api/functions/analytics";
import { AnalyticsRange, ConversationCostGroupBy } from "@/client-api/types/analytics.type";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const numberFormat = new Intl.NumberFormat("en-IN");

const groupByOptions: Array<{ value: ConversationCostGroupBy; label: string }> = [
  { value: "category", label: "Category" },
  { value: "type", label: "Type" },
  { value: "country", label: "Country" },
  { value: "phone", label: "Phone number" }
];

export default function CostsTab({ range }: { range: AnalyticsRange }) {
  const queryClient = useQueryClient();
  const [groupBy, setGroupBy] = useState<ConversationCostGroupBy>("category");
  const [acknowledged, setAcknowledged] = useState(false);

  const {
    data: costsData,
    isLoading: isLoadingCosts,
    isError: isCostsError
  } = useQuery({
    queryKey: ["analytics-conversation-costs", range, groupBy],
    queryFn: () => getConversationCostAnalytics({ range, groupBy })
  });

  const {
    data: templatesData,
    isLoading: isLoadingTemplates,
    isError: isTemplatesError
  } = useQuery({
    queryKey: ["analytics-template-costs", range],
    queryFn: () => getTemplateAnalytics({ range })
  });

  const { data: insightsStatusData } = useQuery({
    queryKey: ["template-insights-status"],
    queryFn: () => getTemplateInsightsStatus()
  });

  const { mutate: enableInsights, isPending: isEnabling } = useMutation({
    mutationFn: () => enableTemplateInsights(),
    meta: { showToast: false },
    onSuccess: () => {
      setAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ["template-insights-status"] });
    }
  });

  const breakdown = costsData?.data.breakdown || [];
  const totals = costsData?.data.totals;
  const currency = costsData?.data.currency || "USD";
  const templates = templatesData?.data.templates || [];
  const templateInsightsEnabled =
    insightsStatusData?.data.templateInsightsEnabled;

  const formatCost = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);

  return (
    <div className="space-y-6">
      {templateInsightsEnabled === false && (
        <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Enable template insights to see per-template click and spend
            data from Meta.
          </p>
          <AlertDialog
            onOpenChange={(open) => !open && setAcknowledged(false)}
          >
            <AlertDialogTrigger asChild>
              <Button size="sm">Enable template insights</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Enable template insights?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This is a <strong>permanent, one-time opt-in on Meta&apos;s
                  side</strong> — there is no API to disable it once enabled.
                  Meta will collect and anonymize chat data for link
                  tracking on this WhatsApp Business Account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label className="flex items-start gap-2 rounded-sm bg-muted/60 p-3 text-sm">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(Boolean(checked))}
                />
                I understand this cannot be undone.
              </label>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!acknowledged || isEnabling}
                  onClick={() => enableInsights()}
                >
                  Enable permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}

      <section className="rounded-lg bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Conversation costs
          </h2>
          <Select
            value={groupBy}
            onValueChange={(value) => setGroupBy(value as ConversationCostGroupBy)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupByOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCostsError && (
          <QueryErrorState message="Conversation costs could not be loaded." />
        )}

        {isLoadingCosts ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {totals && (
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total conversations
                  </p>
                  <p className="mt-1 font-heading text-lg font-semibold">
                    {numberFormat.format(totals.conversationCount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total spend</p>
                  <p className="mt-1 font-heading text-lg font-semibold">
                    {formatCost(totals.cost)}
                  </p>
                </div>
              </div>
            )}

            {breakdown.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-primary">
                      <th className="p-3 capitalize">{groupBy}</th>
                      <th className="p-3">Conversations</th>
                      <th className="p-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row) => (
                      <tr key={row.key} className="border-t">
                        <td className="p-3 capitalize">{row.key}</td>
                        <td className="p-3">
                          {numberFormat.format(row.conversationCount)}
                        </td>
                        <td className="p-3 text-right">
                          {formatCost(row.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                No conversation cost data for this range.
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg bg-white p-5 shadow-xs">
        <h2 className="mb-4 font-heading text-lg font-semibold">
          Template performance
        </h2>

        {isTemplatesError && (
          <QueryErrorState message="Template analytics could not be loaded." />
        )}

        {isLoadingTemplates ? (
          <Skeleton className="h-40" />
        ) : templates.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-primary">
                  <th className="p-3">Template</th>
                  <th className="p-3">Sent</th>
                  <th className="p-3">Delivered</th>
                  <th className="p-3">Read</th>
                  <th className="p-3">Clicks</th>
                  <th className="p-3 text-right">Spend</th>
                  <th className="p-3 text-right">Cost / delivered</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const totalClicks = template.clicks.reduce(
                    (sum, click) => sum + click.count,
                    0
                  );
                  const costPerDelivered =
                    template.delivered > 0
                      ? template.amountSpent / template.delivered
                      : 0;
                  return (
                    <tr key={template.templateId} className="border-t">
                      <td className="p-3 font-medium">
                        {template.name || template.templateId}
                      </td>
                      <td className="p-3">
                        {numberFormat.format(template.sent)}
                      </td>
                      <td className="p-3">
                        {numberFormat.format(template.delivered)}
                      </td>
                      <td className="p-3">
                        {numberFormat.format(template.read)}
                      </td>
                      <td className="p-3">
                        {numberFormat.format(totalClicks)}
                      </td>
                      <td className="p-3 text-right">
                        {formatCost(template.amountSpent)}
                      </td>
                      <td className="p-3 text-right">
                        {formatCost(costPerDelivered)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
            No template analytics for this range.
          </div>
        )}
      </section>
    </div>
  );
}
