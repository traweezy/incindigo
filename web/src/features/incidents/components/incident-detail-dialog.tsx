import {
  CheckCircle2,
  Clock3,
  Fingerprint,
  Radar,
  ShieldAlert,
  UserRound,
  XCircle
} from "lucide-react";
import { memo, useMemo, type FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/shared/components/primitives/dialog";
import type { Incident } from "@/features/incidents/schemas/incident-schemas";
import type { Runbook } from "@/features/runbooks/schemas/runbook-schemas";

type IncidentDetailDialogProps = {
  incident: Incident | null;
  matchedRunbooks: Runbook[];
  onOpenChange: (open: boolean) => void;
};

const IncidentDetailDialogComponent: FC<IncidentDetailDialogProps> = ({
  incident,
  matchedRunbooks,
  onOpenChange
}) => {
  const metadataText = useMemo(() => {
    if (!incident) {
      return "{}";
    }

    return JSON.stringify(incident.metadata, null, 2);
  }, [incident]);

  const reporterInitials = useMemo(() => {
    if (!incident) {
      return "??";
    }

    const normalized = incident.reported_by.trim();
    if (!normalized) {
      return "??";
    }

    const parts = normalized
      .split(/[\s@._-]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    const initials = parts
      .slice(0, 2)
      .map((part) => part.slice(0, 1).toUpperCase())
      .join("");
    return initials.length > 0 ? initials : "??";
  }, [incident]);

  const severityBadgeClass = useMemo(() => {
    if (!incident) {
      return "bg-slate-700 text-slate-200";
    }

    if (incident.severity === "critical") {
      return "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/35";
    }
    if (incident.severity === "high") {
      return "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/35";
    }
    if (incident.severity === "medium") {
      return "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/35";
    }
    return "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35";
  }, [incident]);

  const statusClass = useMemo(() => {
    if (!incident) {
      return "text-slate-300";
    }

    if (incident.status === "resolved") {
      return "text-emerald-200";
    }
    if (incident.status === "cancelled") {
      return "text-amber-200";
    }
    return "text-sky-200";
  }, [incident]);

  const statusDotClass = useMemo(() => {
    if (!incident) {
      return "bg-slate-400";
    }

    if (incident.status === "resolved") {
      return "bg-emerald-400";
    }
    if (incident.status === "cancelled") {
      return "bg-amber-400";
    }
    return "bg-sky-400";
  }, [incident]);

  const statusIcon = useMemo(() => {
    if (!incident) {
      return null;
    }

    if (incident.status === "resolved") {
      return <CheckCircle2 className="size-3.5" />;
    }
    if (incident.status === "cancelled") {
      return <XCircle className="size-3.5" />;
    }
    return null;
  }, [incident]);

  return (
    <Dialog open={Boolean(incident)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-5xl overflow-hidden p-0">
        <div className="max-h-[calc(100vh-1.5rem)] space-y-4 overflow-y-auto p-4 sm:p-6">
          <header className="space-y-3">
            <DialogTitle className="font-display text-xl font-semibold text-indigo-100">
              {incident?.summary ?? "Incident details"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-300">
              {incident?.source} • {incident?.event_type}
            </DialogDescription>
            {incident ? (
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase ${severityBadgeClass}`}
                >
                  {incident.severity}
                </p>
                <p
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${statusClass}`}
                >
                  <span aria-hidden="true" className={`size-2 rounded-full ${statusDotClass}`} />
                  {statusIcon}
                  {incident.status}
                </p>
              </div>
            ) : null}
          </header>

          {incident ? (
            <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">Source</p>
                <p className="inline-flex items-center gap-1.5 font-medium text-slate-100">
                  <Radar className="size-3.5" />
                  {incident.source}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">Event Type</p>
                <p className="font-medium text-slate-100">{incident.event_type}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">Created</p>
                <p className="inline-flex items-center gap-1.5 text-slate-200">
                  <Clock3 className="size-3.5 text-slate-400" />
                  {new Date(incident.created_at).toLocaleString()}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">
                  Last Updated
                </p>
                <p className="inline-flex items-center gap-1.5 text-slate-200">
                  <Clock3 className="size-3.5 text-slate-400" />
                  {new Date(incident.updated_at).toLocaleString()}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">
                  Fingerprint
                </p>
                <p className="mt-1 inline-flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 font-mono text-xs text-slate-200">
                  <Fingerprint className="size-3.5 text-slate-500" />
                  <span className="truncate">{incident.fingerprint}</span>
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">
                  Reported By
                </p>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-100">
                    {reporterInitials}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-100">
                    <UserRound className="size-3.5 text-slate-400" />
                    {incident.reported_by}
                  </span>
                </div>
              </div>

              {incident.status === "resolved" && incident.resolved_at ? (
                <div className="sm:col-span-2">
                  <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">
                    Resolution
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-200">
                    <CheckCircle2 className="size-3.5" />
                    Resolved at {new Date(incident.resolved_at).toLocaleString()}
                  </p>
                </div>
              ) : null}

              {incident.status === "cancelled" ? (
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">
                    Cancellation
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-sm text-amber-200">
                    <XCircle className="size-3.5" />
                    Cancelled by {incident.cancelled_by ?? "unknown"}
                  </p>
                  {incident.cancelled_at ? (
                    <p className="text-xs text-amber-200/90">
                      At {new Date(incident.cancelled_at).toLocaleString()}
                    </p>
                  ) : null}
                  {incident.cancel_reason ? (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-100">
                      {incident.cancel_reason}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <h4 className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
              <ShieldAlert className="size-3.5" />
              Matching Runbooks
            </h4>
            {matchedRunbooks.length > 0 ? (
              <div className="space-y-3">
                {matchedRunbooks.map((runbook) => {
                  const matchEntries = [
                    runbook.match.source ? `source: ${runbook.match.source}` : null,
                    runbook.match.event_type ? `event: ${runbook.match.event_type}` : null,
                    runbook.match.service ? `service: ${runbook.match.service}` : null,
                    runbook.match.severity ? `severity: ${runbook.match.severity}` : null,
                    runbook.match.fingerprint_contains
                      ? `fingerprint: ${runbook.match.fingerprint_contains}`
                      : null
                  ].filter((value): value is string => Boolean(value));

                  return (
                    <article
                      key={runbook.id}
                      className="space-y-3 rounded-lg border border-slate-700/80 bg-slate-900/70 p-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-100">{runbook.name}</p>
                        <p className="text-xs text-slate-400">{runbook.description}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {matchEntries.length > 0 ? (
                          matchEntries.map((entry) => (
                            <span
                              key={`${runbook.id}-${entry}`}
                              className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                            >
                              {entry}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                            matches any incident
                          </span>
                        )}
                      </div>

                      <ol className="space-y-1.5 text-xs text-slate-300">
                        {runbook.checklist.map((item, index) => (
                          <li key={item.id} className="inline-flex items-start gap-2">
                            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-slate-800 text-[10px] text-slate-200">
                              {index + 1}
                            </span>
                            <span>{item.title}</span>
                          </li>
                        ))}
                      </ol>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No runbook match found for this incident yet.
              </p>
            )}
          </section>

          <details className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <summary className="cursor-pointer text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
              Metadata
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-200">
              {metadataText}
            </pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const IncidentDetailDialog = memo(IncidentDetailDialogComponent);
