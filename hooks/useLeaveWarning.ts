import { useRouter } from "next/router";
import { useEffect } from "react";

const DEFAULT_MESSAGE = "You have unsaved changes. Leave this page anyway?";

/**
 * While `when` is true, asks before the page is left: closing or reloading
 * the tab (the browser's own prompt) or going to another page in the app.
 * Shallow changes to the same page, like switching Store tabs, pass.
 */
export function useLeaveWarning(when: boolean, message = DEFAULT_MESSAGE) {
  const router = useRouter();
  const events = router?.events;

  useEffect(() => {
    if (!when) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const routeChangeStart = (
      _url: string,
      options?: { shallow?: boolean }
    ) => {
      if (options?.shallow) return;
      if (window.confirm(message)) return;
      events?.emit("routeChangeError");
      // Next.js has no other way to stop a route change.
      throw "Route change stopped: unsaved changes.";
    };
    window.addEventListener("beforeunload", beforeUnload);
    events?.on("routeChangeStart", routeChangeStart);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      events?.off("routeChangeStart", routeChangeStart);
    };
  }, [when, message, events]);
}
