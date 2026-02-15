import { useQuery } from "@tanstack/react-query";
import { fetchIncidents, incidentQueryKey } from "@/features/incidents/api/incidents-api";

export const useIncidentsQuery = () => {
  return useQuery({
    queryKey: incidentQueryKey,
    queryFn: () => fetchIncidents(500),
    refetchInterval: 20_000
  });
};
