import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
