import AppLayout from "@/layouts/AppLayout";

interface WorkspacePlaceholderProps {
  title: string;
  description: string;
}

export default function WorkspacePlaceholder({
  title,
  description
}: WorkspacePlaceholderProps) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-primary">Workspace</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
