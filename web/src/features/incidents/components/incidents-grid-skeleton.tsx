import { memo, type FC } from "react";
import { Card } from "@/shared/components/primitives/card";
import { Skeleton } from "@/shared/components/primitives/skeleton";

const IncidentsGridSkeletonComponent: FC = () => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => {
        return (
          <Card key={index} className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </Card>
        );
      })}
    </div>
  );
};

export const IncidentsGridSkeleton = memo(IncidentsGridSkeletonComponent);
