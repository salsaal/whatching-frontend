import { X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const MAX_PAYMENT_METHODS = 5;
// The same shape the API accepts for a payment method's code.
const METHOD_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/**
 * The payment method codes that count as cash on delivery (WooCommerce):
 * chips to remove, and a field to add one. `onSave` resolves to the API's
 * reason when a change is refused.
 */
export function StoreCodPaymentMethods({
  methods,
  canManage,
  isSaving,
  onSave,
  onError
}: {
  methods: string[];
  canManage: boolean;
  isSaving: boolean;
  onSave: (methods: string[]) => Promise<string | null>;
  onError: (message: string) => void;
}) {
  const [newMethod, setNewMethod] = useState("");

  const addMethod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const method = newMethod.trim().toLowerCase();
    if (!method || methods.includes(method)) {
      setNewMethod("");
      return;
    }
    if (!METHOD_PATTERN.test(method)) {
      onError(
        "Use the payment method's code from WooCommerce, like cod: letters, numbers, - or _."
      );
      return;
    }
    const problem = await onSave([...methods, method]);
    if (!problem) setNewMethod("");
  };

  return (
    <>
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
                  onSave(methods.filter((entry) => entry !== method))
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
    </>
  );
}
