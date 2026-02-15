import { memo, type HTMLAttributes } from "react";
import { cn } from "@/shared/lib/ui/cn";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

const SkeletonComponent = ({ className, ...props }: SkeletonProps) => {
  return <div className={cn("animate-pulse rounded-xl bg-slate-800/80", className)} {...props} />;
};

export const Skeleton = memo(SkeletonComponent);
