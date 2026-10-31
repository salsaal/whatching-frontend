import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";

import {
  getDraftTemplateById,
  getTemplateById
} from "@/client-api/functions/templates";
import TemplateCreateForm from "@/components/templates/TemplateCreateForm";
import { mapDraftToTemplate } from "@/components/templates/templateUtils";
import { DetailLoadingSkeleton } from "@/components/ui/loading-skeletons";
import AppLayout from "@/layouts/AppLayout";
import { PermissionGate } from "@/components/common/NoAccess";

function CreateTemplatePageContent() {
  const router = useRouter();
  // ?duplicate=<id>[&source=draft] prefills a new template from that one.
  const duplicateId =
    typeof router.query.duplicate === "string" ? router.query.duplicate : "";
  const source = router.query.source === "draft" ? "draft" : "meta";

  const { data: duplicateOf, isLoading } = useQuery({
    queryKey: ["template-detail", source, duplicateId],
    queryFn: async () =>
      source === "draft"
        ? mapDraftToTemplate(
            (await getDraftTemplateById(duplicateId)).data.draft
          )
        : {
            ...(await getTemplateById(duplicateId)).data.template,
            source: "meta" as const
          },
    enabled: Boolean(duplicateId)
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        {duplicateId && isLoading ? (
          <DetailLoadingSkeleton className="min-h-80" />
        ) : (
          // "Create another" adds ?fresh=…, which remounts a clean form.
          // (Not keyed by the whole URL: category/language live there too.)
          <TemplateCreateForm
            key={`${router.query.fresh || ""}:${duplicateId}`}
            duplicateOf={duplicateOf || null}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function CreateTemplatePage() {
  return (
    <PermissionGate permission="templates:manage" feature="template creation">
      <CreateTemplatePageContent />
    </PermissionGate>
  );
}
