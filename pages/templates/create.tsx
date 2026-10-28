import TemplateCreateForm from "@/components/templates/TemplateCreateForm";
import AppLayout from "@/layouts/AppLayout";
import { PermissionGate } from "@/components/common/NoAccess";

function CreateTemplatePageContent() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        <TemplateCreateForm />
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
