import { CheckCircle2, Clock3, Radar, UserRound, XCircle } from "lucide-react";
import { memo, useMemo, type FC } from "react";
import { Button } from "@/shared/components/primitives/button";
import { Card } from "@/shared/components/primitives/card";
import type { Incident } from "@/features/incidents/schemas/incident-schemas";

type IncidentCardProps = {
  incident: Incident;
  onInspect: (incident: Incident) => void;
  onResolve: (incidentID: string) => void;
  onCancel: (incidentID: string) => void;
  isResolving: boolean;
  isCancelling: boolean;
  runbookMatchCount: number;
};

const IncidentCardComponent: FC<IncidentCardProps> = ({
  incident,
  isCancelling,
  isResolving,
  onCancel,
  onInspect,
  onResolve,
  runbookMatchCount
}) => {
  const createdTime = useMemo(() => {
    return new Date(incident.created_at).toLocaleString();
  }, [incident.created_at]);

  const reporterInitials = useMemo(() => {
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
  }, [incident.reported_by]);

  const severitySurfaceClass =
    incident.severity === "critical"
      ? "border-rose-500/45"
      : incident.severity === "high"
        ? "border-amber-500/45"
        : incident.severity === "medium"
          ? "border-sky-500/45"
          : "border-emerald-500/45";

  const severityAccentClass =
    incident.severity === "critical"
      ? "bg-rose-500"
      : incident.severity === "high"
        ? "bg-amber-500"
        : incident.severity === "medium"
          ? "bg-sky-500"
          : "bg-emerald-500";

  const severityBadgeClass =
    incident.severity === "critical"
      ? "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/35"
      : incident.severity === "high"
        ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/35"
        : incident.severity === "medium"
          ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/35"
          : "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35";

  const statusClass =
    incident.status === "resolved"
      ? "text-emerald-200"
      : incident.status === "cancelled"
        ? "text-amber-200"
        : "text-sky-200";

  const statusDotClass =
    incident.status === "resolved"
      ? "bg-emerald-400"
      : incident.status === "cancelled"
        ? "bg-amber-400"
        : "bg-sky-400";

  return (
    <Card
      className={`relative flex h-full flex-col gap-3 overflow-hidden border bg-slate-900/90 transition hover:border-slate-500 ${severitySurfaceClass}`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${severityAccentClass}`} />
      <div className="flex items-center justify-between gap-3">
        <p
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase ${severityBadgeClass}`}
        >
          {incident.severity}
        </p>
        <p
          className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${statusClass}`}
        >
          <span aria-hidden="true" className={`size-2 rounded-full ${statusDotClass}`} />
          {incident.status === "resolved" ? <CheckCircle2 className="size-3.5" /> : null}
          {incident.status === "cancelled" ? <XCircle className="size-3.5" /> : null}
          {incident.status}
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="line-clamp-2 text-[15px] leading-5 font-semibold text-slate-100">
          {incident.summary}
        </h3>
        <p className="inline-flex items-center gap-2 text-[11px] tracking-[0.16em] text-slate-400 uppercase">
          <Radar className="size-3.5" />
          {incident.source} • {incident.event_type}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-800/90 bg-slate-950/30 px-2.5 py-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-100">
          {reporterInitials}
        </div>
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.14em] text-slate-500 uppercase">
            <UserRound className="size-3" />
            Reported by
          </p>
          <p className="truncate text-sm font-medium text-slate-200">{incident.reported_by}</p>
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-1">
        <p className="truncate rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 font-mono text-xs text-slate-300">
          {incident.fingerprint}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {runbookMatchCount > 0 ? `${runbookMatchCount} runbook match` : "No runbook match"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock3 className="size-3.5" />
            {createdTime}
          </span>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {incident.status === "open" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isResolving}
              onClick={() => onResolve(incident.id)}
            >
              {isResolving ? "Resolving..." : "Resolve"}
            </Button>
          ) : null}
          {incident.status === "open" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isCancelling}
              onClick={() => onCancel(incident.id)}
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => onInspect(incident)}>
            Inspect
          </Button>
        </div>
      </div>
    </Card>
  );
};

export const IncidentCard = memo(IncidentCardComponent);
