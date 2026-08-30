import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/router";

import { Button } from "@/components/ui/button";

export function OwnerOnlyNotice() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg rounded-lg bg-white p-8 text-center shadow-xs">
      <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-amber-100 text-amber-700">
        <ShieldAlert className="size-6" />
      </div>
      <h1 className="mt-4 font-heading text-2xl font-semibold">
        Owner access required
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Billing and subscription management is limited to the organisation
        owner. Ask your owner to make this change, or reach out to them for
        access.
      </p>
      <Button className="mt-6" onClick={() => router.push("/overview")}>
        Back to dashboard
      </Button>
    </div>
  );
}
