"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useRouter } from "next/router";

import { PermissionGate } from "@/components/common/NoAccess";
import { InstagramFlowEditor } from "@/components/instagram/flow-editor/InstagramFlowEditor";

function InstagramFlowEditorPageContent() {
  const router = useRouter();
  const canvasId =
    typeof router.query.canvasId === "string" ? router.query.canvasId : "";

  // Remount per flow: the editor loads a flow once, so reusing it across
  // /instagram/A -> /instagram/B could save A's blocks into B.
  return (
    <ReactFlowProvider key={canvasId}>
      {canvasId && <InstagramFlowEditor canvasId={canvasId} />}
    </ReactFlowProvider>
  );
}

export default function InstagramFlowEditorPage() {
  return (
    <PermissionGate permission="instagram:manage" feature="Instagram">
      <InstagramFlowEditorPageContent />
    </PermissionGate>
  );
}
