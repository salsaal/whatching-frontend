import type { TemplateComponent } from "@/client-api/types/templates.type";
import { WhatsAppPreview } from "@/components/whatsapp/WhatsAppPreview";
import { cn } from "@/lib/utils";

/**
 * The right half of a Store message card: what a customer reads, with
 * sample values filled in, or a grey bubble until a template is chosen.
 */
export function StorePreview({
  components,
  values,
  className
}: {
  components?: TemplateComponent[] | null;
  values: Record<string, string>;
  className?: string;
}) {
  if (components?.length) {
    return (
      <WhatsAppPreview
        components={components}
        variableValues={values}
        className={cn("flex h-full items-center rounded-none", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-full items-center bg-[#efeae2] p-4",
        className
      )}
    >
      <p className="max-w-[320px] rounded-lg rounded-tl-none bg-white/70 px-3 py-2 text-[13px] leading-5 text-muted-foreground shadow-xs">
        Choose a template to see what customers will read.
      </p>
    </div>
  );
}
