import TemplateCreateForm from "@/components/templates/TemplateCreateForm";
import AppLayout from "@/layouts/AppLayout";

export default function CreateTemplatePage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        <TemplateCreateForm />
      </div>
    </AppLayout>
  );
}
