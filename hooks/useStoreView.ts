import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import type { StoreOrdersShow } from "@/client-api/types/stores.type";
import {
  type StoreActivityView,
  type StoreTab,
  parseActivityView,
  parseOrdersShow,
  parseStoreTab
} from "@/lib/storePage";

export interface StoreView {
  tab: StoreTab;
  /** Activity: Orders or Carts. */
  view: StoreActivityView;
  /** Activity › Orders filter. */
  show: StoreOrdersShow;
}

/**
 * The Store page's tab and Activity filter, kept in the URL
 * (/store?tab=activity&show=not_sent) so links and a refresh keep them.
 * Defaults are left out of the URL.
 */
export function useStoreView() {
  const router = useRouter();
  const tabParam = router?.query?.tab;
  const viewParam = router?.query?.view;
  const showParam = router?.query?.show;
  const [state, setState] = useState<StoreView>(() => ({
    tab: parseStoreTab(tabParam),
    view: parseActivityView(viewParam),
    show: parseOrdersShow(showParam)
  }));

  // Back, forward and links change the URL; follow them.
  useEffect(() => {
    setState({
      tab: parseStoreTab(tabParam),
      view: parseActivityView(viewParam),
      show: parseOrdersShow(showParam)
    });
  }, [tabParam, viewParam, showParam]);

  const update = useCallback(
    (next: Partial<StoreView>) => {
      const merged = { ...state, ...next };
      setState(merged);
      if (!router?.replace) return;
      const query = { ...router.query };
      delete query.tab;
      delete query.view;
      delete query.show;
      if (merged.tab !== "overview") query.tab = merged.tab;
      if (merged.tab === "activity") {
        if (merged.view !== "orders") query.view = merged.view;
        if (merged.view === "orders" && merged.show !== "all") {
          query.show = merged.show;
        }
      }
      void router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false
      });
    },
    [router, state]
  );

  return [state, update] as const;
}
