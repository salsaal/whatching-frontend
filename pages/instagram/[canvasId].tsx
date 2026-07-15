"use client";

import { useRouter } from "next/router";

import { InstagramPage } from "../instagram";

export default function InstagramCanvasEditorPage() {
  const router = useRouter();
  const canvasId =
    typeof router.query.canvasId === "string" ? router.query.canvasId : "";

  return <InstagramPage canvasOnly forcedCanvasId={canvasId} />;
}
