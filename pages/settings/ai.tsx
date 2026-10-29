"use client";

import { useRouter } from "next/router";
import { useEffect } from "react";

import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import AppLayout from "@/layouts/AppLayout";

// The AI Assistant moved into the Bot section. This page only keeps old
// bookmarks working; it can't be a next.config redirect because the #hash
// that picks the section never reaches the server.
const destinationForHash = (hash: string) =>
  hash === "#knowledge" ? "/bot/ai#knowledge" : "/bot/ai";

export default function LegacyAiSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(destinationForHash(window.location.hash));
  }, [router]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        <DetailLoadingSkeleton />
      </div>
    </AppLayout>
  );
}
