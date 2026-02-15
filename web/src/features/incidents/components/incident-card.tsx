import { Clock3, Radar } from "lucide-react";
import { memo, useMemo, type FC } from "react";
import { Badge } from "@/shared/components/primitives/badge";
import { Button } from "@/shared/components/primitives/button";
import { Card } from "@/shared/components/primitives/card";
import { getSeverityTone } from "@/features/incidents/lib/incidents";
import type { Incident } from "@/features/incidents/schemas/incident-schemas";

type IncidentCardProps = {
  incident: Incident;
  onInspect: (incident: Incident) => void;
  onResolve: (incidentID: string) => void;
  isResolving: boolean;
};

const IncidentCardComponent: FC<IncidentCardProps> = ({
  incident,
  isResolving,
  onInspect,
  onResolve
}) => {
  const createdTime = useMemo(() => {
    return new Date(incident.created_at).toLocaleString();
  }, [incident.created_at]);

  return (
    <Card className="flex h-full flex-col gap-4 border-slate-800/90 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20 transition hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <Badge tone={getSeverityTone(incident.severity)}>{incident.severity}</Badge>
        <p
          className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${
            incident.status === "resolved" ? "text-emerald-200" : "text-sky-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${
              incident.status === "resolved" ? "bg-emerald-400" : "bg-sky-400"
            }`}
          />
          {incident.status}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-100">{incident.summary}</h3>
        <p className="inline-flex items-center gap-2 text-xs tracking-[0.18em] text-slate-400 uppercase">
          <Radar className="size-3.5" />
          {incident.source} • {incident.event_type}
        </p>
      </div>

      <div className="mt-auto space-y-3">
        <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 font-mono text-xs text-slate-300">
          {incident.fingerprint}
        </p>

        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs text-slate-400">
            <Clock3 className="size-3.5" />
            {createdTime}
          </span>
          <div className="inline-flex items-center gap-2">
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
            <Button variant="secondary" size="sm" onClick={() => onInspect(incident)}>
              Inspect
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export const IncidentCard = memo(IncidentCardComponent);
