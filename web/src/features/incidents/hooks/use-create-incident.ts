import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createIncident,
  incidentOverviewQueryKey,
  incidentQueryKey
} from "@/features/incidents/api/incidents-api";
import { upsertIncident } from "@/features/incidents/lib/incidents";
import type {
  CreateIncidentInput,
  CreateIncidentResponse,
  Incident
} from "@/features/incidents/schemas/incident-schemas";

export const useCreateIncident = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateIncidentResponse, Error, CreateIncidentInput>({
    mutationFn: createIncident,
    onSuccess: (result) => {
      queryClient.setQueryData<Incident[]>(incidentQueryKey, (current = []) => {
        return upsertIncident(current, result.incident);
      });
      void queryClient.invalidateQueries({ queryKey: incidentOverviewQueryKey });

      toast.success(
        result.deduplicated
          ? "Incident deduplicated and existing record updated"
          : "Incident created successfully"
      );
    },
    onError: () => {
      toast.error("Failed to create incident. Check API availability.");
    }
  });
};
