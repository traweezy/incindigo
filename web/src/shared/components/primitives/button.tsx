import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { memo, type ButtonHTMLAttributes, type FC } from "react";
import { cn } from "@/shared/lib/ui/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "border-brand-300/60 bg-brand-500/90 text-indigo-50 hover:bg-brand-400",
        secondary:
          "border-slate-700 bg-slate-900/70 text-slate-100 hover:border-slate-500 hover:bg-slate-900",
        ghost: "border-transparent bg-transparent text-slate-200 hover:bg-slate-800/70"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-5"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const ButtonComponent: FC<ButtonProps> = ({
  asChild = false,
  className,
  size,
  variant,
  ...props
}) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
};

export const Button = memo(ButtonComponent);
