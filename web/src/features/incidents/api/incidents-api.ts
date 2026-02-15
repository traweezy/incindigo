import {
  createIncidentInputSchema,
  incidentOverviewResponseSchema,
  createIncidentResponseSchema,
  incidentsResponseSchema,
  resolveIncidentResponseSchema,
  timelineEventSchema,
  type CreateIncidentInput,
  type CreateIncidentResponse,
  type Incident,
  type IncidentOverview,
  type TimelineEvent
} from "@/features/incidents/schemas/incident-schemas";
import { fetchJson } from "@/shared/lib/net/fetch-json";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

const toAPIURL = (path: string): string => {
  if (API_BASE_URL.length === 0) {
    return path;
  }

  return new URL(path, API_BASE_URL).toString();
};

export const incidentQueryKey = ["incidents"] as const;
export const incidentOverviewQueryKey = ["incidents-overview"] as const;

export const fetchIncidents = async (limit?: number): Promise<Incident[]> => {
  const endpoint = new URL(toAPIURL("/api/v1/incidents"), window.location.origin);
  if (limit !== undefined) {
    endpoint.searchParams.set("limit", String(limit));
  }

  const payload = await fetchJson<unknown>(endpoint.toString(), {
    method: "GET"
  });

  const parsed = incidentsResponseSchema.parse(payload);
  return parsed.items;
};

export const fetchIncidentOverview = async (): Promise<IncidentOverview> => {
  const payload = await fetchJson<unknown>(toAPIURL("/api/v1/incidents/overview"), {
    method: "GET"
  });

  const parsed = incidentOverviewResponseSchema.parse(payload);
  return parsed.overview;
};

export const createIncident = async (
  input: CreateIncidentInput
): Promise<CreateIncidentResponse> => {
  const request = createIncidentInputSchema.parse(input);

  const payload = await fetchJson<unknown>(toAPIURL("/api/v1/webhooks/events"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  return createIncidentResponseSchema.parse(payload);
};

export const resolveIncident = async (incidentID: string): Promise<Incident> => {
  const payload = await fetchJson<unknown>(toAPIURL(`/api/v1/incidents/${incidentID}/resolve`), {
    method: "POST"
  });

  const parsed = resolveIncidentResponseSchema.parse(payload);
  return parsed.incident;
};

export const getIncidentEventSourceURL = (): string => {
  return toAPIURL("/api/v1/incidents/stream");
};

export const parseTimelineEvent = (raw: string): TimelineEvent | null => {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  const parsed = timelineEventSchema.safeParse(decoded);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
};
