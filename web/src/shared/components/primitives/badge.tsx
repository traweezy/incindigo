import { cva, type VariantProps } from "class-variance-authority";
import { memo, type FC, type PropsWithChildren } from "react";
import { cn } from "@/shared/lib/ui/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-slate-800 text-slate-200",
        critical: "bg-rose-500/20 text-rose-200",
        high: "bg-orange-500/20 text-orange-200",
        medium: "bg-sky-500/20 text-sky-200",
        low: "bg-emerald-500/20 text-emerald-200"
      }
    },
    defaultVariants: {
      tone: "neutral"
    }
  }
);

type BadgeProps = PropsWithChildren<VariantProps<typeof badgeVariants>>;

const BadgeComponent: FC<BadgeProps> = ({ children, tone }) => {
  return <span className={cn(badgeVariants({ tone }))}>{children}</span>;
};

export const Badge = memo(BadgeComponent);
