import { memo, type FC, type PropsWithChildren } from "react";
import { cn } from "@/shared/lib/ui/cn";

type FieldProps = PropsWithChildren<{
  label: string;
  htmlFor: string;
  error?: string | undefined;
  description?: string | undefined;
}>;

const FieldComponent: FC<FieldProps> = ({ children, description, error, htmlFor, label }) => {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-200">
        {label}
      </label>
      {description ? <p className="text-xs text-slate-400">{description}</p> : null}
      {children}
      <p className={cn("text-xs", error ? "text-rose-300" : "text-slate-500")}>{error ?? " "}</p>
    </div>
  );
};

export const Field = memo(FieldComponent);
