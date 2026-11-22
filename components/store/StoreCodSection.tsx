import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { StoreConnection } from "@/client-api/types/stores.type";
import { StoreCodPaymentMethods } from "@/components/store/StoreCodPaymentMethods";
import { useStoreSettings } from "@/components/store/useStoreSettings";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Section F: what happens with cash-on-delivery answers. */
export function StoreCodSection({
  connection,
  canManage
}: {
  connection: StoreConnection;
  canManage: boolean;
}) {
  const { save } = useStoreSettings(connection.id);
  const isShopify = connection.platform === "shopify";
  const autoCancelLabel = isShopify
    ? "Cancel the order in Shopify when the customer taps Cancel"
    : "Cancel the order in my store when the customer taps Cancel";
  const autoCancel = connection.settings?.cod?.autoCancel === true;
  const methods = connection.settings?.cod?.paymentMethods?.length
    ? connection.settings.cod.paymentMethods
    : ["cod"];
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (payload: Parameters<typeof save>[0]) => {
    setIsSaving(true);
    const problem = await save(payload);
    setIsSaving(false);
    setError(problem);
    return problem;
  };

  return (
    <section className="rounded-lg border bg-white p-4 shadow-xs sm:p-5">
      <h2 className="font-heading text-xl font-semibold">Cash on delivery</h2>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 text-sm">
          <p className="font-medium">{autoCancelLabel}</p>
          {isShopify ? (
            <p className="mt-1 text-muted-foreground">
              Only orders that haven&apos;t been fulfilled are cancelled. Stock
              is put back. A cancelled order can&apos;t be restored.
            </p>
          ) : (
            <>
              <p className="mt-1 text-muted-foreground">
                If it&apos;s off, we record their answer and tell you. You
                decide whether to cancel.
              </p>
              <p className="mt-1 text-muted-foreground">
                Orders already completed are never cancelled.
              </p>
            </>
          )}
        </div>
        <Switch
          checked={autoCancel}
          disabled={!canManage || isSaving}
          aria-label={autoCancelLabel}
          onCheckedChange={(checked) => run({ cod: { autoCancel: checked } })}
        />
      </div>

      {/* Shopify recognises its own cash on delivery: no payment methods. */}
      {isShopify ? (
        <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
          Answers are tagged on the order in Shopify as &ldquo;COD
          Confirmed&rdquo;, &ldquo;COD Cancel Requested&rdquo;, &ldquo;COD
          Cancelled&rdquo; or &ldquo;COD No Reply&rdquo;.
        </p>
      ) : (
        <Collapsible className="mt-4 border-t pt-3">
          <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            Advanced
            <ChevronDown className="size-4 transition group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <p className="text-sm font-medium">
              Which payment methods count as cash on delivery
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Orders paid with these get the cash-on-delivery check instead of
              &ldquo;Order confirmed&rdquo;.
            </p>
            <StoreCodPaymentMethods
              methods={methods}
              canManage={canManage}
              isSaving={isSaving}
              onSave={(paymentMethods) => run({ cod: { paymentMethods } })}
              onError={setError}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
      {error && (
        <p className={cn("mt-3 text-sm text-destructive")} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
