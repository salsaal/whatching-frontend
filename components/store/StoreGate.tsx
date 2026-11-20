import { useRouter } from "next/router";
import { type ReactNode, useEffect } from "react";

import type { StoreResponse } from "@/client-api/types/stores.type";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { useStore } from "@/hooks/useStore";
import AppLayout from "@/layouts/AppLayout";
import { storeErrorMessage } from "@/lib/store";

/**
 * Wraps the Store routes. They exist only when GET /organizations/stores
 * answers 200: without integrations:view, or while the backend doesn't
 * have stores yet (404), the page behaves like any unknown page and goes
 * to Overview, so nobody sees a broken or half-hidden feature.
 */
export function StoreGate({
  children,
  pollWhileSettingUp = false
}: {
  children: (data: StoreResponse["data"]) => ReactNode;
  /** The Store page; the return page polls on its own. */
  pollWhileSettingUp?: boolean;
}) {
  const router = useRouter();
  const store = useStore({ fresh: true, pollWhileSettingUp });

  useEffect(() => {
    if (store.isHidden) router.replace("/overview");
  }, [router, store.isHidden]);

  let content: ReactNode;
  if (store.data) {
    content = children(store.data.data);
  } else if (store.isError && !store.isHidden) {
    content = (
      <QueryErrorState
        message={storeErrorMessage(
          store.error,
          "Your store details couldn't be loaded. Please try again."
        )}
      />
    );
  } else {
    content = <DetailLoadingSkeleton />;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">{content}</div>
    </AppLayout>
  );
}
