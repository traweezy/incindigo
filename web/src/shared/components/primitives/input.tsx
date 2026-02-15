import { memo, type InputHTMLAttributes } from "react";
import { cn } from "@/shared/lib/ui/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const InputComponent = ({ className, ...props }: InputProps) => {
  return (
    <input
      className={cn(
        "focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none placeholder:text-slate-500 focus:ring-2",
        className
      )}
      {...props}
    />
  );
};

export const Input = memo(InputComponent);
