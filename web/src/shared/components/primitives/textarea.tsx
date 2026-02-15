import { memo, type TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/ui/cn";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextAreaComponent = ({ className, ...props }: TextAreaProps) => {
  return (
    <textarea
      className={cn(
        "focus:border-brand-300 focus:ring-brand-400/40 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 transition outline-none placeholder:text-slate-500 focus:ring-2",
        className
      )}
      {...props}
    />
  );
};

export const TextArea = memo(TextAreaComponent);
