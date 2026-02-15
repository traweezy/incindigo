import { memo, type HTMLAttributes } from "react";
import { cn } from "@/shared/lib/ui/cn";

type CardProps = HTMLAttributes<HTMLElement>;

const CardComponent = ({ className, ...props }: CardProps) => {
  return (
    <article
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_8px_22px_-12px_rgba(2,6,23,0.95)]",
        className
      )}
      {...props}
    />
  );
};

export const Card = memo(CardComponent);
