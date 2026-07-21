import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function CardGridLoadingSkeleton({
  count = 6,
  className
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-white p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
          <div className="mt-5 flex justify-between">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListLoadingSkeleton({
  rows = 5,
  className
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-xs"
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CanvasLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-full min-h-[420px] overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:22px_22px]",
        className
      )}
    >
      <div className="absolute left-[10%] top-[18%] w-56 rounded-xl border bg-white p-4 shadow-xs">
        <div className="flex gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="mt-4 h-12" />
      </div>
      <Skeleton className="absolute left-[34%] top-[37%] h-1 w-[18%]" />
      <div className="absolute right-[12%] top-[48%] w-56 rounded-xl border bg-white p-4 shadow-xs">
        <div className="flex gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="mt-4 h-12" />
      </div>
    </div>
  );
}

export function DetailLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-4 rounded-xl border bg-white p-5 shadow-xs sm:grid-cols-2",
        className
      )}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ))}
    </div>
  );
}
