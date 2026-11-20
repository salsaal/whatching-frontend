import { ChevronDown, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { StoreConnection } from "@/client-api/types/stores.type";
import { useStoreSettings } from "@/components/store/useStoreSettings";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MAX_PAYMENT_METHODS = 5;
// The same shape the API accepts for a payment method's code.
const METHOD_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

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
  const [newMethod, setNewMethod] = useState("");

  const run = async (payload: Parameters<typeof save>[0]) => {
    setIsSaving(true);
    const problem = await save(payload);
    setIsSaving(false);
    setError(problem);
    return problem;
  };

  const addMethod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const method = newMethod.trim().toLowerCase();
    if (!method || methods.includes(method)) {
      setNewMethod("");
      return;
    }
    if (!METHOD_PATTERN.test(method)) {
      setError(
        "Use the payment method's code from WooCommerce, like cod: letters, numbers, - or _."
      );
      return;
    }
    const problem = await run({
      cod: { paymentMethods: [...methods, method] }
    });
    if (!problem) setNewMethod("");
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
            <div className="mt-3 flex flex-wrap gap-2">
              {methods.map((method) => (
                <span
                  key={method}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pr-1 pl-3 text-sm"
                >
                  {method}
                  {canManage && methods.length > 1 && (
                    <button
                      type="button"
                      className="flex size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${method}`}
                      disabled={isSaving}
                      onClick={() =>
                        run({
                          cod: {
                            paymentMethods: methods.filter(
                              (entry) => entry !== method
                            )
                          }
                        })
                      }
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canManage && methods.length < MAX_PAYMENT_METHODS && (
              <form onSubmit={addMethod} className="mt-3 flex max-w-sm gap-2">
                <Input
                  value={newMethod}
                  onChange={(event) => setNewMethod(event.target.value)}
                  placeholder="Add a payment method code"
                  maxLength={40}
                  disabled={isSaving}
                  aria-label="Payment method code"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isSaving || !newMethod.trim()}
                >
                  Add
                </Button>
              </form>
            )}
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
