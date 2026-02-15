import { z } from "zod";

export const severitySchema = z.enum(["critical", "high", "medium", "low"]);

export const incidentSchema = z.object({
  id: z.uuid(),
  fingerprint: z.string(),
  source: z.string(),
  event_type: z.string(),
  summary: z.string(),
  severity: severitySchema,
  status: z.enum(["open", "resolved"]),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().optional()
});

export const incidentsResponseSchema = z.object({
  items: z.array(incidentSchema)
});

export const timelineEventSchema = z.object({
  event_type: z.enum(["created", "deduplicated", "resolved", "auto_resolved"]),
  incident: incidentSchema,
  occurred_at: z.string()
});

export const createIncidentInputSchema = z.object({
  fingerprint: z.string().min(3).max(256),
  source: z.string().min(2).max(128),
  event_type: z.string().min(3).max(128),
  summary: z.string().min(8).max(512),
  severity: severitySchema,
  metadata: z.record(z.string(), z.unknown())
});

export const createIncidentResponseSchema = z.object({
  incident: incidentSchema,
  deduplicated: z.boolean().optional()
});

export const resolveIncidentResponseSchema = z.object({
  incident: incidentSchema
});

export const incidentOverviewSchema = z.object({
  generated_at: z.string(),
  counts: z.object({
    total: z.number(),
    open: z.number(),
    resolved: z.number(),
    severity: z.object({
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number()
    })
  }),
  resolution: z.object({
    average_seconds: z.number(),
    resolved_within_30m: z.number()
  }),
  top_sources: z.array(
    z.object({
      source: z.string(),
      total: z.number(),
      open: z.number()
    })
  ),
  top_event_types: z.array(
    z.object({
      event_type: z.string(),
      total: z.number(),
      open: z.number()
    })
  ),
  recent_activity: z.array(
    z.object({
      bucket_start: z.string(),
      created: z.number(),
      resolved: z.number()
    })
  )
});

export const incidentOverviewResponseSchema = z.object({
  overview: incidentOverviewSchema
});

export type Incident = z.infer<typeof incidentSchema>;
export type IncidentSeverity = z.infer<typeof severitySchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentInputSchema>;
export type CreateIncidentResponse = z.infer<typeof createIncidentResponseSchema>;
export type ResolveIncidentResponse = z.infer<typeof resolveIncidentResponseSchema>;
export type IncidentOverview = z.infer<typeof incidentOverviewSchema>;
