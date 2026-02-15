import { memo, type FC } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/primitives/button";

const NotFoundPageComponent: FC = () => {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-indigo-300 uppercase">404</p>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Page not found</h1>
        <p className="max-w-sm text-sm text-slate-400">
          The route you requested is unavailable. Return to the incident board to continue.
        </p>
        <Button asChild>
          <Link to="/">Back to Live Board</Link>
        </Button>
      </div>
    </section>
  );
};

export const NotFoundPage = memo(NotFoundPageComponent);
