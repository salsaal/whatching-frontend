import { Store } from "lucide-react";

import { ConnectedStore } from "@/components/store/ConnectedStore";
import {
  StoreConnectForm,
  StorePlanNotice
} from "@/components/store/StoreConnectScreens";
import { StoreGate } from "@/components/store/StoreGate";
import { storeScreen } from "@/lib/store";

export default function StorePage() {
  return (
    <StoreGate pollWhileSettingUp>
      {(data) => {
        const screen = storeScreen(data);
        return (
          <div className="space-y-6">
            <section className="flex items-center gap-3 rounded-lg bg-white p-5 shadow-xs">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <Store className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Store</p>
                <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
                  Order updates on WhatsApp
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Message customers when they order from your WooCommerce store.
                </p>
              </div>
            </section>
            {screen === "plan" && <StorePlanNotice />}
            {screen === "connect" && (
              <StoreConnectForm previous={data.connection} />
            )}
            {screen === "connected" && (
              <ConnectedStore
                data={data}
                enabledForPlan={data.enabledForPlan}
              />
            )}
          </div>
        );
      }}
    </StoreGate>
  );
}
