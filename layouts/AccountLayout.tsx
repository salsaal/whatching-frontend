import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

import { UserMenu } from "@/components/account/UserMenu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import assets from "@/json/assets";
import { useOrganizationStore } from "@/stores/organizationStore";

export type AccountTab = "profile" | "security";

const tabs: Array<{ value: AccountTab; label: string; href: string }> = [
  { value: "profile", label: "Profile", href: "/account" },
  { value: "security", label: "Security", href: "/account/security" }
];

// The user's own account, outside any organisation: same top bar as
// /organisations, so it works before an org exists.
export default function AccountLayout({
  activeTab,
  children
}: {
  activeTab: AccountTab;
  children: ReactNode;
}) {
  const hasActiveOrganization = useOrganizationStore((state) =>
    Boolean(state.activeOrganization)
  );

  return (
    <div className="min-h-screen bg-[#f7faf8] text-foreground">
      <header className="sticky top-0 z-20 bg-white/95 shadow-xs backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/organisations">
            <Image
              src={assets.whatchingLogo}
              alt="Whatching"
              width={150}
              height={42}
            />
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <Link
          href={hasActiveOrganization ? "/overview" : "/organisations"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <Tabs value={activeTab}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="min-w-24 px-4"
                asChild
              >
                <Link href={tab.href}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {children}
      </main>
    </div>
  );
}
