import { ActivitySquare, BarChart3, BookCopy, LogOut, PlusCircle, UserRound } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FC, type MouseEvent as ReactMouseEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearAuthSession, useAuthSession } from "@/features/auth/lib/auth-session";
import { CreateIncidentForm } from "@/features/incidents/components/create-incident-form";
import { useCreateIncident } from "@/features/incidents/hooks/use-create-incident";
import type { CreateIncidentInput, CreateIncidentResponse } from "@/features/incidents/schemas/incident-schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/shared/components/primitives/dialog";

const openComposerEventName = "incindigo:open-composer";

const AppShellComponent: FC = () => {
  const navigate = useNavigate();
  const authSession = useAuthSession();
  const createIncidentMutation = useCreateIncident();
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const getNavClassName = useCallback(({ isActive }: { isActive: boolean }) => {
    return [
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition sm:gap-2 sm:px-3 sm:text-sm",
      isActive
        ? "border-indigo-300/70 bg-indigo-500/30 text-indigo-100 shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
        : "border-transparent bg-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-slate-100"
    ].join(" ");
  }, []);

  const year = useMemo(() => new Date().getUTCFullYear(), []);
  const accountLabel = useMemo(() => {
    if (!authSession) {
      return "Anonymous";
    }

    return authSession.email;
  }, [authSession]);

  const handleCreateIncidentClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setComposerOpen(true);
  }, []);

  const handleCreateIncident = useCallback(
    async (input: CreateIncidentInput): Promise<CreateIncidentResponse> => {
      const response = await createIncidentMutation.mutateAsync(input);
      setComposerOpen(false);
      return response;
    },
    [createIncidentMutation]
  );
  const handleSignOut = useCallback(() => {
    clearAuthSession();
    void navigate("/auth", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setAccountMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    const handleOpenComposer = () => {
      setComposerOpen(true);
    };

    window.addEventListener(openComposerEventName, handleOpenComposer);
    return () => {
      window.removeEventListener(openComposerEventName, handleOpenComposer);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_5%,rgba(79,70,229,0.3),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.2),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(15,23,42,0.8),transparent_45%)]"
      />

      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[110rem] px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="inline-flex min-w-0 items-center gap-3">
              <span className="size-2.5 rounded-full bg-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.9)]" />
              <span className="font-display truncate text-sm font-bold tracking-[0.2em] text-indigo-100 uppercase sm:text-base sm:tracking-[0.22em]">
                Incindigo
              </span>
            </div>

            <nav
              className="ml-2 hidden min-w-0 flex-1 overflow-x-auto md:block"
              aria-label="Primary"
            >
              <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/75 p-1">
                <NavLink to="/" className={getNavClassName} end>
                  <ActivitySquare className="size-4" />
                  <span>Live Board</span>
                </NavLink>
                <NavLink to="/analytics" className={getNavClassName}>
                  <BarChart3 className="size-4" />
                  <span>Analytics</span>
                </NavLink>
                <NavLink to="/runbooks" className={getNavClassName}>
                  <BookCopy className="size-4" />
                  <span>Runbooks</span>
                </NavLink>
              </div>
            </nav>

            <div className="ml-auto inline-flex items-center gap-1.5">
              <Link
                to="/"
                onClick={handleCreateIncidentClick}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/60 bg-emerald-500/20 px-2 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/30 sm:px-2.5"
              >
                <PlusCircle className="size-4" />
                <span className="hidden sm:inline">Create Incident</span>
                <span className="sm:hidden">Create</span>
              </Link>

              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setAccountMenuOpen((current) => !current);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100 sm:px-2.5"
                >
                  <UserRound className="size-3.5" />
                  <span className="hidden sm:inline">Account</span>
                </button>

                {isAccountMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl"
                  >
                    <p className="truncate px-2 py-1 text-xs text-slate-400">{accountLabel}</p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        handleSignOut();
                      }}
                      className="mt-1 inline-flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800/80"
                    >
                      <LogOut className="size-4" />
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <nav className="mt-2 min-w-0 overflow-x-auto md:hidden" aria-label="Primary">
            <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/75 p-1">
              <NavLink to="/" className={getNavClassName} end>
                <ActivitySquare className="size-4" />
                <span>Board</span>
              </NavLink>
              <NavLink to="/analytics" className={getNavClassName}>
                <BarChart3 className="size-4" />
                <span>Stats</span>
              </NavLink>
              <NavLink to="/runbooks" className={getNavClassName}>
                <BookCopy className="size-4" />
                <span>Runbooks</span>
              </NavLink>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <Dialog open={isComposerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl p-0">
          <div className="flex max-h-[88vh] flex-col">
            <div className="space-y-1 border-b border-slate-800 px-6 py-5">
              <DialogTitle className="font-display text-2xl font-semibold text-slate-50">
                Incident Composer
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                Trigger incidents from anywhere in the app.
              </DialogDescription>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <CreateIncidentForm
                onCreate={handleCreateIncident}
                isSubmitting={createIncidentMutation.isPending}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
