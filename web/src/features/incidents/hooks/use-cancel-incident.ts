import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelIncident,
  incidentOverviewQueryKey,
  incidentQueryKey
} from "@/features/incidents/api/incidents-api";
import { upsertIncident } from "@/features/incidents/lib/incidents";
import type { Incident } from "@/features/incidents/schemas/incident-schemas";

type CancelIncidentVariables = {
  incidentID: string;
  cancelledBy: string;
  reason: string;
};

export const useCancelIncident = () => {
  const queryClient = useQueryClient();

  return useMutation<Incident, Error, CancelIncidentVariables>({
    mutationFn: async ({ cancelledBy, incidentID, reason }) => {
      return cancelIncident(incidentID, {
        reason,
        cancelled_by: cancelledBy
      });
    },
    onSuccess: (incident) => {
      queryClient.setQueryData<Incident[]>(incidentQueryKey, (current = []) => {
        return upsertIncident(current, incident);
      });
      void queryClient.invalidateQueries({ queryKey: incidentOverviewQueryKey });
      toast.success("Incident cancelled");
    },
    onError: () => {
      toast.error("Unable to cancel incident");
    }
  });
};
