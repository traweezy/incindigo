import { describe, expect, it } from "vitest";
import { sortIncidentsByNewest, upsertIncident } from "@/features/incidents/lib/incidents";
import type { Incident } from "@/features/incidents/schemas/incident-schemas";

const incidentA: Incident = {
  id: "d9b86f5f-b2d7-43f7-ae6f-4e91a50704da",
  fingerprint: "svc-a",
  source: "test",
  event_type: "cpu.high",
  summary: "CPU high",
  severity: "high",
  status: "open",
  metadata: {},
  created_at: "2026-02-14T10:00:00.000Z",
  updated_at: "2026-02-14T10:00:00.000Z"
};

const incidentB: Incident = {
  id: "22059f6d-f16d-4ecf-9d18-01bbfdd22a07",
  fingerprint: "svc-b",
  source: "test",
  event_type: "disk.low",
  summary: "Disk low",
  severity: "critical",
  status: "open",
  metadata: {},
  created_at: "2026-02-14T11:00:00.000Z",
  updated_at: "2026-02-14T11:00:00.000Z"
};

describe("incident collection helpers", () => {
  it("sorts incidents by newest timestamp", () => {
    const result = sortIncidentsByNewest([incidentA, incidentB]);
    expect(result[0]?.id).toBe(incidentB.id);
    expect(result[1]?.id).toBe(incidentA.id);
  });

  it("replaces existing incident when ids match", () => {
    const updatedIncidentA = {
      ...incidentA,
      summary: "CPU still high"
    };

    const result = upsertIncident([incidentA, incidentB], updatedIncidentA);
    const updated = result.find((item) => item.id === incidentA.id);

    expect(updated?.summary).toBe("CPU still high");
    expect(result).toHaveLength(2);
  });

  it("adds new incidents and keeps descending order", () => {
    const newest: Incident = {
      ...incidentA,
      id: "dc58f808-f58c-4374-bec9-8d004ca26d1a",
      created_at: "2026-02-14T12:00:00.000Z"
    };

    const result = upsertIncident([incidentA, incidentB], newest);

    expect(result[0]?.id).toBe(newest.id);
    expect(result).toHaveLength(3);
  });
});
