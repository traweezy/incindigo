import { memo, useMemo, type FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/shared/components/primitives/dialog";
import type { Incident } from "@/features/incidents/schemas/incident-schemas";

type IncidentDetailDialogProps = {
  incident: Incident | null;
  onOpenChange: (open: boolean) => void;
};

const IncidentDetailDialogComponent: FC<IncidentDetailDialogProps> = ({
  incident,
  onOpenChange
}) => {
  const metadataText = useMemo(() => {
    if (!incident) {
      return "{}";
    }

    return JSON.stringify(incident.metadata, null, 2);
  }, [incident]);

  return (
    <Dialog open={Boolean(incident)} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-4">
          <DialogTitle className="font-display text-xl font-semibold text-indigo-100">
            {incident?.summary ?? "Incident details"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-300">
            {incident?.source} • {incident?.event_type}
          </DialogDescription>

          <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <h4 className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
              Metadata
            </h4>
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-200">
              {metadataText}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const IncidentDetailDialog = memo(IncidentDetailDialogComponent);
