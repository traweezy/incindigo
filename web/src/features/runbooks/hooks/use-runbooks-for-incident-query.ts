import { useQuery } from "@tanstack/react-query";
import { fetchRunbooksForIncident } from "@/features/runbooks/api/runbooks-api";

export const useRunbooksForIncidentQuery = (incidentID: string | null) => {
  return useQuery({
    queryKey: ["runbooks", "incident", incidentID],
    queryFn: async () => fetchRunbooksForIncident(incidentID ?? ""),
    enabled: Boolean(incidentID)
  });
};
