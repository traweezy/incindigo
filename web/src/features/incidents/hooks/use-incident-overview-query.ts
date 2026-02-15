import { useQuery } from "@tanstack/react-query";
import {
  fetchIncidentOverview,
  incidentOverviewQueryKey
} from "@/features/incidents/api/incidents-api";

export const useIncidentOverviewQuery = () => {
  return useQuery({
    queryKey: incidentOverviewQueryKey,
    queryFn: fetchIncidentOverview,
    refetchInterval: 15_000
  });
};
