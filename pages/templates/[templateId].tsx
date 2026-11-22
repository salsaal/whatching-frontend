"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";

import {
  getDraftTemplateById,
  getTemplateById
} from "@/client-api/functions/templates";
import TemplateCreateForm from "@/components/templates/TemplateCreateForm";
import { mapDraftToTemplate } from "@/components/templates/templateUtils";
import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { useStore } from "@/hooks/useStore";
import AppLayout from "@/layouts/AppLayout";
import { storeTemplateUses } from "@/lib/storePage";
import { PermissionGate } from "@/components/common/NoAccess";

function TemplateDetailPageContent() {
  const router = useRouter();
  const templateId = router.query.templateId as string | undefined;
  const source = router.query.source === "draft" ? "draft" : "meta";

  const { data, isLoading } = useQuery({
    queryKey: ["template-detail", source, templateId],
    queryFn: async () => {
      if (!templateId) throw new Error("Missing template id");

      if (source === "draft") {
        const res = await getDraftTemplateById(templateId);
        return mapDraftToTemplate(res.data.draft);
      }

      const res = await getTemplateById(templateId);
      return {
        ...res.data.template,
        source: "meta" as const
      };
    },
    enabled: Boolean(templateId)
  });
  const storeConnection = useStore().data?.data.connection;
  const storeUses =
    data && source === "meta"
      ? storeTemplateUses(storeConnection, data.name, data.language)
      : [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        {isLoading || !data ? (
          <DetailLoadingSkeleton className="min-h-80" />
        ) : (
          <TemplateCreateForm
            initialTemplate={data}
            editKind={source}
            storeUses={storeUses}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function TemplateDetailPage() {
  return (
    <PermissionGate permission="templates:manage" feature="template editing">
      <TemplateDetailPageContent />
    </PermissionGate>
  );
}
