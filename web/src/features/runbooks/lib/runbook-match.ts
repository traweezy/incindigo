import type { Incident } from "@/features/incidents/schemas/incident-schemas";
import type { Runbook } from "@/features/runbooks/schemas/runbook-schemas";

const normalize = (value: string | undefined): string => {
  return value?.trim().toLowerCase() ?? "";
};

export const runbookMatchesIncident = (runbook: Runbook, incident: Incident): boolean => {
  const matcher = runbook.match;
  const sourceMatcher = normalize(matcher.source);
  const eventTypeMatcher = normalize(matcher.event_type);
  const serviceMatcher = normalize(matcher.service);
  const severityMatcher = normalize(matcher.severity);
  const fingerprintMatcher = normalize(matcher.fingerprint_contains);

  const incidentSource = normalize(incident.source);
  const incidentEventType = normalize(incident.event_type);
  const incidentService =
    typeof incident.metadata.service === "string" ? normalize(incident.metadata.service) : "";
  const incidentSeverity = normalize(incident.severity);
  const incidentFingerprint = normalize(incident.fingerprint);

  if (sourceMatcher && sourceMatcher !== incidentSource) {
    return false;
  }
  if (eventTypeMatcher && eventTypeMatcher !== incidentEventType) {
    return false;
  }
  if (serviceMatcher && serviceMatcher !== incidentService) {
    return false;
  }
  if (severityMatcher && severityMatcher !== incidentSeverity) {
    return false;
  }
  if (fingerprintMatcher && !incidentFingerprint.includes(fingerprintMatcher)) {
    return false;
  }

  return true;
};
