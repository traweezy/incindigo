import type { Incident, IncidentSeverity } from "@/features/incidents/schemas/incident-schemas";

export const sortIncidentsByNewest = (items: Incident[]): Incident[] => {
  return [...items].sort((left, right) => {
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
};

export const upsertIncident = (items: Incident[], incoming: Incident): Incident[] => {
  const existingIndex = items.findIndex((item) => item.id === incoming.id);

  if (existingIndex >= 0) {
    const copy = [...items];
    copy[existingIndex] = incoming;
    return sortIncidentsByNewest(copy);
  }

  return sortIncidentsByNewest([incoming, ...items]);
};

export const getSeverityTone = (severity: IncidentSeverity): IncidentSeverity => {
  return severity;
};
