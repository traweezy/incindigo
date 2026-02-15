import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createIncident,
  incidentOverviewQueryKey,
  incidentQueryKey
} from "@/features/incidents/api/incidents-api";
import {
  incidentEventTypes,
  incidentRegions,
  incidentReporters,
  incidentServices,
  incidentSeverities,
  incidentSources
} from "@/features/incidents/lib/incident-taxonomy";
import type {
  CreateIncidentInput,
} from "@/features/incidents/schemas/incident-schemas";

const buildSeedInput = (index: number, seed: number): CreateIncidentInput => {
  const source = incidentSources[index % incidentSources.length] ?? "manual-demo";
  const eventType = incidentEventTypes[index % incidentEventTypes.length] ?? "http.5xx";
  const severity = incidentSeverities[index % incidentSeverities.length] ?? "high";
  const service = incidentServices[index % incidentServices.length] ?? "api";
  const region = incidentRegions[index % incidentRegions.length] ?? "us-east-1";
  const reporter = incidentReporters[index % incidentReporters.length] ?? "alerts@incindigo.dev";
  const hostIndex = (index % 32) + 1;

  return {
    fingerprint: `demo-${source}-${eventType}-${seed}-${index + 1}`,
    source,
    event_type: eventType,
    summary: `${service} reported ${eventType} threshold breach in ${region}`,
    severity,
    reported_by: reporter,
    metadata: {
      host: `${service}-${hostIndex}`,
      service,
      region,
      created_from: "frontend-seed"
    }
  };
};

export const useSeedIncidents = () => {
  const queryClient = useQueryClient();

  return useMutation<number, Error, number>({
    mutationFn: async (count: number): Promise<number> => {
      const clampedCount = Math.max(1, Math.min(Math.trunc(count), 200));
      const seed = Date.now();
      const payloads = Array.from({ length: clampedCount }, (_, index) => {
        return buildSeedInput(index, seed);
      });

      const chunkSize = 8;
      for (let index = 0; index < payloads.length; index += chunkSize) {
        const chunk = payloads.slice(index, index + chunkSize);
        await Promise.all(
          chunk.map(async (payload) => {
            await createIncident(payload);
          })
        );
      }

      return clampedCount;
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: incidentQueryKey });
      await queryClient.invalidateQueries({ queryKey: incidentOverviewQueryKey });
      toast.success(`Generated ${count} demo incidents`);
    },
    onError: () => {
      toast.error("Failed to seed incidents");
    }
  });
};
