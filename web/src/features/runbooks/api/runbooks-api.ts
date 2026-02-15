import { fetchJson } from "@/shared/lib/net/fetch-json";
import { toAPIURL } from "@/shared/lib/net/api-url";
import {
  createRunbookInputSchema,
  createRunbookResponseSchema,
  runbooksForIncidentResponseSchema,
  runbooksResponseSchema,
  updateRunbookInputSchema,
  updateRunbookResponseSchema,
  type CreateRunbookInput,
  type UpdateRunbookInput,
  type Runbook
} from "@/features/runbooks/schemas/runbook-schemas";

export const runbookQueryKey = ["runbooks"] as const;

export const fetchRunbooks = async (): Promise<Runbook[]> => {
  const payload = await fetchJson<unknown>(toAPIURL("/api/v1/runbooks"), {
    method: "GET"
  });

  const parsed = runbooksResponseSchema.parse(payload);
  return parsed.items;
};

export const createRunbook = async (input: CreateRunbookInput): Promise<Runbook> => {
  const request = createRunbookInputSchema.parse(input);
  const payload = await fetchJson<unknown>(toAPIURL("/api/v1/runbooks"), {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  const parsed = createRunbookResponseSchema.parse(payload);
  return parsed.runbook;
};

export const updateRunbook = async (runbookID: string, input: UpdateRunbookInput): Promise<Runbook> => {
  const request = updateRunbookInputSchema.parse(input);
  const payload = await fetchJson<unknown>(toAPIURL(`/api/v1/runbooks/${runbookID}`), {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PUT"
  });

  const parsed = updateRunbookResponseSchema.parse(payload);
  return parsed.runbook;
};

export const deleteRunbook = async (runbookID: string): Promise<void> => {
  await fetchJson<unknown>(toAPIURL(`/api/v1/runbooks/${runbookID}`), {
    method: "DELETE"
  });
};

export const fetchRunbooksForIncident = async (incidentID: string): Promise<Runbook[]> => {
  const payload = await fetchJson<unknown>(toAPIURL(`/api/v1/incidents/${incidentID}/runbooks`), {
    method: "GET"
  });

  const parsed = runbooksForIncidentResponseSchema.parse(payload);
  return parsed.items;
};
