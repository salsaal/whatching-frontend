import { Menu } from "lucide-react";
import { createContext, useContext } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Lets pages that hide the shared top bar (inbox, Instagram, flow builder)
// still open the app menu on phones, from their own header.
const AppMenuContext = createContext<(() => void) | null>(null);

export const AppMenuProvider = AppMenuContext.Provider;

/** The phone-only menu button, for a page's own header. */
export function MobileMenuButton({ className }: { className?: string }) {
  const openMenu = useContext(AppMenuContext);
  if (!openMenu) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Open menu"
      className={cn("size-9 shrink-0 lg:hidden", className)}
      onClick={openMenu}
    >
      <Menu className="size-5" />
    </Button>
  );
}
