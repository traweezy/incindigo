import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createIncident,
  incidentOverviewQueryKey,
  incidentQueryKey
} from "@/features/incidents/api/incidents-api";
import type {
  CreateIncidentInput,
  IncidentSeverity
} from "@/features/incidents/schemas/incident-schemas";

const sources = ["manual-demo", "pagerduty", "grafana", "cloudwatch", "sentry"] as const;
const eventTypes = [
  "http.5xx",
  "db.latency",
  "cpu.high",
  "memory.pressure",
  "queue.backlog",
  "disk.space"
] as const;
const services = ["api", "worker", "scheduler", "edge", "billing"] as const;
const regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"] as const;
const severities: IncidentSeverity[] = ["critical", "high", "medium", "low"];

const buildSeedInput = (index: number, seed: number): CreateIncidentInput => {
  const source = sources[index % sources.length] ?? "manual-demo";
  const eventType = eventTypes[index % eventTypes.length] ?? "http.5xx";
  const severity = severities[index % severities.length] ?? "high";
  const service = services[index % services.length] ?? "api";
  const region = regions[index % regions.length] ?? "us-east-1";
  const hostIndex = (index % 32) + 1;

  return {
    fingerprint: `demo-${source}-${eventType}-${seed}-${index + 1}`,
    source,
    event_type: eventType,
    summary: `${service} reported ${eventType} threshold breach in ${region}`,
    severity,
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
