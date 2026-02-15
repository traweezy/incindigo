import { ActivitySquare, BarChart3, PlusCircle } from "lucide-react";
import { memo, useCallback, useMemo, type FC } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

const AppShellComponent: FC = () => {
  const getNavClassName = useCallback(({ isActive }: { isActive: boolean }) => {
    return [
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition sm:gap-2 sm:px-3 sm:text-sm",
      isActive
        ? "border-indigo-300/70 bg-indigo-500/30 text-indigo-100"
        : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-slate-100"
    ].join(" ");
  }, []);

  const year = useMemo(() => new Date().getUTCFullYear(), []);
  const handleCreateIncidentClick = useCallback(() => {
    window.sessionStorage.setItem("incindigo_open_composer", "1");
    window.dispatchEvent(new Event("incindigo:open-composer"));
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_5%,rgba(79,70,229,0.3),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.2),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(15,23,42,0.8),transparent_45%)]"
      />

      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[110rem] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="inline-flex min-w-0 items-center gap-3">
              <span className="size-3 rounded-full bg-indigo-500 shadow-[0_0_18px_rgba(99,102,241,0.95)]" />
              <span className="font-display truncate text-sm font-bold tracking-[0.2em] text-indigo-100 uppercase sm:text-base sm:tracking-[0.22em]">
                Incindigo
              </span>
            </div>

            <nav
              className="inline-flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap sm:gap-2"
              aria-label="Primary"
            >
              <NavLink to="/" className={getNavClassName} end>
                <ActivitySquare className="size-4" />
                <span className="sm:hidden">Board</span>
                <span className="hidden sm:inline">Live Board</span>
              </NavLink>
              <NavLink to="/analytics" className={getNavClassName}>
                <BarChart3 className="size-4" />
                <span className="sm:hidden">Stats</span>
                <span className="hidden sm:inline">Analytics</span>
              </NavLink>
              <Link
                to="/"
                onClick={handleCreateIncidentClick}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/60 bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/30 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <PlusCircle className="size-4" />
                <span className="sm:hidden">Create</span>
                <span className="hidden sm:inline">Create Incident</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="mx-auto mt-auto w-full max-w-[110rem] px-4 pt-2 pb-8 text-xs text-slate-500 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p>Incindigo frontend sandbox {year}</p>
          <div className="inline-flex flex-wrap items-center gap-3">
            <a
              href="http://localhost:8080/healthz"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 transition hover:text-slate-200"
            >
              healthz
            </a>
            <a
              href="http://localhost:8080/readyz"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 transition hover:text-slate-200"
            >
              readyz
            </a>
            <a
              href="http://localhost:8080/metrics"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 transition hover:text-slate-200"
            >
              metrics
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const AppShell = memo(AppShellComponent);
