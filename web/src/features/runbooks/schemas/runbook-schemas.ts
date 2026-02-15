import { z } from "zod";

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean()
});

export const runbookMatchSchema = z.object({
  source: z.string().optional(),
  event_type: z.string().optional(),
  service: z.string().optional(),
  severity: z.string().optional(),
  fingerprint_contains: z.string().optional()
});

export const runbookSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  checklist: z.array(checklistItemSchema),
  match: runbookMatchSchema.default({}),
  created_at: z.string(),
  updated_at: z.string()
});

export const runbooksResponseSchema = z.object({
  items: z.array(runbookSchema)
});

export const createRunbookInputSchema = z.object({
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().min(8).max(500),
  checklist: z.array(z.string().trim().min(1).max(180)).min(1),
  match: runbookMatchSchema
});

export const createRunbookResponseSchema = z.object({
  runbook: runbookSchema
});

export const updateRunbookInputSchema = createRunbookInputSchema;

export const updateRunbookResponseSchema = z.object({
  runbook: runbookSchema
});

export const runbooksForIncidentResponseSchema = z.object({
  items: z.array(runbookSchema)
});

export type Runbook = z.infer<typeof runbookSchema>;
export type CreateRunbookInput = z.infer<typeof createRunbookInputSchema>;
export type UpdateRunbookInput = z.infer<typeof updateRunbookInputSchema>;
