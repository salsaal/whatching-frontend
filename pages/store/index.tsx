import { ConnectedStore } from "@/components/store/ConnectedStore";
import {
  StoreConnectForm,
  StorePlanNotice
} from "@/components/store/StoreConnectScreens";
import { StoreGate } from "@/components/store/StoreGate";
import { StorePastOrders } from "@/components/store/StorePastOrders";
import { storeScreen } from "@/lib/store";

export default function StorePage() {
  return (
    <StoreGate pollWhileSettingUp className="max-w-6xl">
      {(data) => {
        const screen = storeScreen(data);
        return (
          <div className="space-y-6">
            <section>
              <p className="text-sm font-medium text-primary">Store</p>
              <h1 className="mt-1 font-heading text-3xl font-semibold">
                WhatsApp for your online store
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Order updates, cash-on-delivery checks and cart reminders for
                your WooCommerce store.
              </p>
            </section>
            {screen === "plan" && <StorePlanNotice />}
            {screen === "connect" && (
              <>
                <StoreConnectForm previous={data.connection} />
                <StorePastOrders connection={data.connection} />
              </>
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
