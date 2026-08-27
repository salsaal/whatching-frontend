import { AlertCircle } from "lucide-react";

export function QueryErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertCircle className="size-4" />
      {message}
    </div>
  );
}
