import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-page py-16" aria-busy="true" aria-label="页面加载中">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-5 h-10 w-2/3 max-w-lg" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
