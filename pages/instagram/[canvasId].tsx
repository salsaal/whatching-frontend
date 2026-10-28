"use client";

import { useRouter } from "next/router";

import { InstagramPage } from "../instagram";
import { PermissionGate } from "@/components/common/NoAccess";

function InstagramCanvasEditorPageContent() {
  const router = useRouter();
  const canvasId =
    typeof router.query.canvasId === "string" ? router.query.canvasId : "";

  return <InstagramPage canvasOnly forcedCanvasId={canvasId} />;
}

export default function InstagramCanvasEditorPage() {
  return (
    <PermissionGate permission="instagram:manage" feature="Instagram">
      <InstagramCanvasEditorPageContent />
    </PermissionGate>
  );
}
