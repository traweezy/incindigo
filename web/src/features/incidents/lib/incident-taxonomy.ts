import type { IncidentSeverity } from "@/features/incidents/schemas/incident-schemas";

export const incidentSources = [
  "manual-demo",
  "pagerduty",
  "grafana",
  "cloudwatch",
  "sentry"
] as const;

export const incidentEventTypes = [
  "http.5xx",
  "db.latency",
  "cpu.high",
  "memory.pressure",
  "queue.backlog",
  "disk.space"
] as const;

export const incidentServices = ["api", "worker", "scheduler", "edge", "billing"] as const;

export const incidentRegions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"] as const;

export const incidentReporters = [
  "oncall@incindigo.dev",
  "sre@incindigo.dev",
  "platform@incindigo.dev",
  "alerts@incindigo.dev"
] as const;

export const incidentSeverities: IncidentSeverity[] = ["critical", "high", "medium", "low"];
