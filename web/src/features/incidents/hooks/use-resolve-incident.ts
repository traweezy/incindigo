import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  incidentOverviewQueryKey,
  incidentQueryKey,
  resolveIncident
} from "@/features/incidents/api/incidents-api";
import { upsertIncident } from "@/features/incidents/lib/incidents";
import type { Incident } from "@/features/incidents/schemas/incident-schemas";

export const useResolveIncident = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveIncident,
    onSuccess: (resolvedIncident) => {
      queryClient.setQueryData<Incident[]>(incidentQueryKey, (current = []) => {
        return upsertIncident(current, resolvedIncident);
      });
      void queryClient.invalidateQueries({ queryKey: incidentOverviewQueryKey });
      toast.success("Incident resolved");
    },
    onError: () => {
      toast.error("Unable to resolve incident");
    }
  });
};
