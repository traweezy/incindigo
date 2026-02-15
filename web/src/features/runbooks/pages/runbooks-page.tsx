import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  ClipboardCheck,
  Pencil,
  PlusCircle,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type FC,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  createRunbook,
  deleteRunbook,
  runbookQueryKey,
  updateRunbook
} from "@/features/runbooks/api/runbooks-api";
import { useCreateRunbook } from "@/features/runbooks/hooks/use-create-runbook";
import { useRunbooksForIncidentQuery } from "@/features/runbooks/hooks/use-runbooks-for-incident-query";
import { useRunbooksQuery } from "@/features/runbooks/hooks/use-runbooks-query";
import type {
  CreateRunbookInput,
  Runbook,
  UpdateRunbookInput
} from "@/features/runbooks/schemas/runbook-schemas";
import {
  incidentEventTypes,
  incidentSeverities,
  incidentServices,
  incidentSources
} from "@/features/incidents/lib/incident-taxonomy";
import { Badge } from "@/shared/components/primitives/badge";
import { Button } from "@/shared/components/primitives/button";
import { Card } from "@/shared/components/primitives/card";
import { Field } from "@/shared/components/primitives/field";
import { Input } from "@/shared/components/primitives/input";
import { TextArea } from "@/shared/components/primitives/textarea";

type RunbookFormValues = {
  checklist: string[];
  description: string;
  name: string;
  match: {
    source: string;
    event_type: string;
    service: string;
    severity: string;
    fingerprint_contains: string;
  };
};

const checklistItemSchema = z
  .string()
  .trim()
  .min(3, "Checklist steps should be at least 3 characters.")
  .max(180, "Checklist steps should stay under 180 characters.");

const runbookSchema = z.object({
  checklist: z.array(checklistItemSchema).min(1, "Add at least one checklist step.").max(25),
  description: z.string().trim().min(8, "Description should be at least 8 characters."),
  name: z.string().trim().min(3, "Name should be at least 3 characters."),
  match: z.object({
    source: z.string().trim().max(128),
    event_type: z.string().trim().max(128),
    service: z.string().trim().max(128),
    severity: z.string().trim().max(32),
    fingerprint_contains: z.string().trim().max(256)
  })
});

const defaultRunbookValues: RunbookFormValues = {
  checklist: [],
  description: "",
  name: "",
  match: {
    source: "",
    event_type: "",
    service: "",
    severity: "",
    fingerprint_contains: ""
  }
};

const sampleRunbookTemplates: readonly RunbookFormValues[] = incidentEventTypes.map(
  (eventType, index) => {
    const source = incidentSources[index % incidentSources.length] ?? "manual-demo";
    const service = incidentServices[index % incidentServices.length] ?? "api";
    const severity = incidentSeverities[index % incidentSeverities.length] ?? "high";
    const fingerprintHint = eventType.split(".")[0] ?? eventType;
    const includeSource = index % 2 === 0;
    const includeService = index % 3 !== 0;
    const includeFingerprint = index % 2 === 1;

    return {
      name: `${eventType} ${severity.toUpperCase()} Response`,
      description: `Targeted triage playbook for ${severity} ${eventType} alerts.`,
      checklist: [
        `Confirm ${eventType} scope and impacted surface`,
        `Check ${service} health and alert corroboration`,
        "Apply mitigation and verify stability over 10 minutes",
        "Post status update with owner and next checkpoint"
      ],
      match: {
        source: includeSource ? source : "",
        event_type: eventType,
        service: includeService ? service : "",
        severity,
        fingerprint_contains: includeFingerprint ? fingerprintHint : ""
      }
    };
  }
);

const normalizeMatch = (input: RunbookFormValues["match"]): CreateRunbookInput["match"] => {
  return {
    source: input.source.trim().toLowerCase(),
    event_type: input.event_type.trim().toLowerCase(),
    service: input.service.trim().toLowerCase(),
    severity: input.severity.trim().toLowerCase(),
    fingerprint_contains: input.fingerprint_contains.trim().toLowerCase()
  };
};

const formatMatchValue = (value: string | undefined): string => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "any";
};

const RunbooksPageComponent: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const incidentID = searchParams.get("incident_id");

  const queryClient = useQueryClient();
  const runbooksQuery = useRunbooksQuery();
  const runbooksForIncidentQuery = useRunbooksForIncidentQuery(incidentID);
  const createRunbookMutation = useCreateRunbook();

  const updateRunbookMutation = useMutation<
    Runbook,
    Error,
    { input: UpdateRunbookInput; runbookID: string }
  >({
    mutationFn: async ({ input, runbookID }) => updateRunbook(runbookID, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: runbookQueryKey });
      if (incidentID) {
        await queryClient.invalidateQueries({ queryKey: ["runbooks", "incident", incidentID] });
      }
      toast.success("Runbook updated");
    },
    onError: () => {
      toast.error("Failed to update runbook");
    }
  });

  const deleteRunbookMutation = useMutation<undefined, Error, string>({
    mutationFn: async (runbookID) => {
      await deleteRunbook(runbookID);
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: runbookQueryKey });
      if (incidentID) {
        await queryClient.invalidateQueries({ queryKey: ["runbooks", "incident", incidentID] });
      }
      toast.success("Runbook deleted");
    },
    onError: () => {
      toast.error("Failed to delete runbook");
    }
  });

  const [editingRunbookID, setEditingRunbookID] = useState<string | null>(null);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [checklistDraftError, setChecklistDraftError] = useState<string | undefined>(undefined);
  const [isSeedingSamples, setIsSeedingSamples] = useState(false);

  const isEditing = editingRunbookID !== null;

  const form = useForm({
    defaultValues: defaultRunbookValues,
    onSubmit: async ({ value }) => {
      const parsed = runbookSchema.parse(value);
      const payload = {
        checklist: parsed.checklist,
        description: parsed.description.trim(),
        name: parsed.name.trim(),
        match: normalizeMatch(parsed.match)
      } satisfies CreateRunbookInput;

      if (editingRunbookID) {
        await updateRunbookMutation.mutateAsync({
          runbookID: editingRunbookID,
          input: payload
        });
      } else {
        await createRunbookMutation.mutateAsync(payload);
      }
      setEditingRunbookID(null);
      setChecklistDraft("");
      setChecklistDraftError(undefined);
      form.reset();
    }
  });

  const runbookCount = useMemo(() => runbooksQuery.data?.length ?? 0, [runbooksQuery.data]);

  const addChecklistStep = useCallback(
    (steps: string[], onChange: (nextValue: string[]) => void) => {
      const parsed = checklistItemSchema.safeParse(checklistDraft);
      if (!parsed.success) {
        setChecklistDraftError(parsed.error.issues[0]?.message ?? "Invalid checklist step.");
        return;
      }

      const normalizedStep = parsed.data;
      if (steps.some((step) => step.toLowerCase() === normalizedStep.toLowerCase())) {
        setChecklistDraftError("That checklist step is already added.");
        return;
      }

      onChange([...steps, normalizedStep]);
      setChecklistDraft("");
      setChecklistDraftError(undefined);
    },
    [checklistDraft]
  );

  const removeChecklistStep = useCallback(
    (indexToRemove: number, steps: string[], onChange: (nextValue: string[]) => void) => {
      onChange(steps.filter((_, index) => index !== indexToRemove));
    },
    []
  );

  const handleChecklistInputKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      steps: string[],
      onChange: (nextValue: string[]) => void
    ) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      addChecklistStep(steps, onChange);
    },
    [addChecklistStep]
  );

  const handleSeedSamples = useCallback(async () => {
    const existingKeys = new Set(
      (runbooksQuery.data ?? []).map((runbook) => {
        const match = runbook.match;
        return [
          runbook.name.trim().toLowerCase(),
          match.source?.trim().toLowerCase() ?? "",
          match.event_type?.trim().toLowerCase() ?? "",
          match.service?.trim().toLowerCase() ?? "",
          match.severity?.trim().toLowerCase() ?? ""
        ].join("|");
      })
    );

    const missingSamples = sampleRunbookTemplates.filter((sample) => {
      const match = sample.match;
      const key = [
        sample.name.trim().toLowerCase(),
        match.source.trim().toLowerCase(),
        match.event_type.trim().toLowerCase(),
        match.service.trim().toLowerCase(),
        match.severity.trim().toLowerCase()
      ].join("|");
      return !existingKeys.has(key);
    });

    if (missingSamples.length === 0) {
      toast.info("Sample runbooks are already loaded.");
      return;
    }

    setIsSeedingSamples(true);
    try {
      for (const sample of missingSamples) {
        await createRunbook(sample);
      }
      await queryClient.invalidateQueries({ queryKey: runbookQueryKey });
      if (incidentID) {
        await queryClient.invalidateQueries({ queryKey: ["runbooks", "incident", incidentID] });
      }
      toast.success(
        `Loaded ${missingSamples.length} sample runbook${missingSamples.length === 1 ? "" : "s"}.`
      );
    } catch {
      toast.error("Failed to load sample runbooks.");
    } finally {
      setIsSeedingSamples(false);
    }
  }, [incidentID, queryClient, runbooksQuery.data]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      void form.handleSubmit();
    },
    [form]
  );

  const handleEditRunbook = useCallback(
    (runbook: Runbook) => {
      setEditingRunbookID(runbook.id);
      setChecklistDraft("");
      setChecklistDraftError(undefined);
      form.reset();
      form.setFieldValue(
        "checklist",
        runbook.checklist.map((item) => item.title)
      );
      form.setFieldValue("description", runbook.description);
      form.setFieldValue("name", runbook.name);
      form.setFieldValue("match", {
        source: runbook.match.source ?? "",
        event_type: runbook.match.event_type ?? "",
        service: runbook.match.service ?? "",
        severity: runbook.match.severity ?? "",
        fingerprint_contains: runbook.match.fingerprint_contains ?? ""
      });
    },
    [form]
  );

  const handleDeleteRunbook = useCallback(
    (runbook: Runbook) => {
      const confirmed = window.confirm(`Delete runbook "${runbook.name}"?`);
      if (!confirmed) {
        return;
      }
      deleteRunbookMutation.mutate(runbook.id);
    },
    [deleteRunbookMutation]
  );

  const clearEditor = useCallback(() => {
    setEditingRunbookID(null);
    setChecklistDraft("");
    setChecklistDraftError(undefined);
    form.reset();
  }, [form]);

  return (
    <section className="space-y-6">
      <Card className="space-y-3 border-indigo-300/40 bg-gradient-to-r from-indigo-950/65 via-slate-900 to-slate-900">
        <p className="font-mono text-xs tracking-[0.2em] text-indigo-300 uppercase">
          Operational Playbooks
        </p>
        <h1 className="font-display text-3xl font-semibold text-slate-50 sm:text-4xl">Runbooks</h1>
        <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
          Define runbooks with incident match rules so responders can discover the right checklist
          directly from the live board.
        </p>
      </Card>

      {incidentID ? (
        <Card className="space-y-2 border-emerald-400/30 bg-emerald-950/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-200">
              Showing runbooks matched to incident {incidentID}
            </p>
            <Button size="sm" variant="secondary" asChild>
              <Link
                to="/runbooks"
                onClick={(event) => {
                  event.preventDefault();
                  setSearchParams({});
                }}
              >
                Clear Incident Filter
              </Link>
            </Button>
          </div>
          {runbooksForIncidentQuery.isPending ? (
            <p className="text-sm text-emerald-100/80">Loading incident-specific matches...</p>
          ) : runbooksForIncidentQuery.data && runbooksForIncidentQuery.data.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {runbooksForIncidentQuery.data.map((runbook) => (
                <Badge key={runbook.id} tone="low">
                  {runbook.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-100/80">
              No explicit runbook match found for this incident.
            </p>
          )}
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,460px)_minmax(0,1fr)]">
        <Card className="space-y-4 border-slate-700/90 bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-100">
              {isEditing ? <Pencil className="size-4" /> : <PlusCircle className="size-4" />}
              {isEditing ? "Edit Runbook" : "Create Runbook"}
            </h2>
            <div className="inline-flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  void handleSeedSamples();
                }}
                disabled={isSeedingSamples || runbooksQuery.isPending}
              >
                <Sparkles className="size-4" />
                {isSeedingSamples ? "Loading..." : "Load Samples"}
              </Button>
              {isEditing ? (
                <Button type="button" size="sm" variant="ghost" onClick={clearEditor}>
                  Clear Edit
                </Button>
              ) : null}
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <form.Field
              name="name"
              validators={{
                onBlur: ({ value }) => {
                  const parsed = runbookSchema.shape.name.safeParse(value);
                  return parsed.success
                    ? undefined
                    : (parsed.error.issues[0]?.message ?? "Invalid value");
                }
              }}
            >
              {(field) => {
                const error = field.state.meta.errors[0] as string | undefined;
                return (
                  <Field label="Name" htmlFor="runbook-name" error={error}>
                    <Input
                      id="runbook-name"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                );
              }}
            </form.Field>

            <form.Field
              name="description"
              validators={{
                onBlur: ({ value }) => {
                  const parsed = runbookSchema.shape.description.safeParse(value);
                  return parsed.success
                    ? undefined
                    : (parsed.error.issues[0]?.message ?? "Invalid value");
                }
              }}
            >
              {(field) => {
                const error = field.state.meta.errors[0] as string | undefined;
                return (
                  <Field label="Description" htmlFor="runbook-description" error={error}>
                    <TextArea
                      id="runbook-description"
                      name={field.name}
                      rows={3}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="match">
              {(field) => {
                return (
                  <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                    <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">
                      Match Rules
                    </p>
                    <p className="text-xs text-slate-500">
                      Leave fields unset to match any incident value.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs text-slate-300">
                        <span>Source</span>
                        <select
                          className="focus:border-brand-300 focus:ring-brand-400/40 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                          value={field.state.value.source}
                          onChange={(event) =>
                            field.handleChange({ ...field.state.value, source: event.target.value })
                          }
                        >
                          <option value="">Any source</option>
                          {incidentSources.map((source) => (
                            <option key={source} value={source}>
                              {source}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-slate-300">
                        <span>Event type</span>
                        <select
                          className="focus:border-brand-300 focus:ring-brand-400/40 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                          value={field.state.value.event_type}
                          onChange={(event) =>
                            field.handleChange({
                              ...field.state.value,
                              event_type: event.target.value
                            })
                          }
                        >
                          <option value="">Any event type</option>
                          {incidentEventTypes.map((eventType) => (
                            <option key={eventType} value={eventType}>
                              {eventType}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-slate-300">
                        <span>Service</span>
                        <select
                          className="focus:border-brand-300 focus:ring-brand-400/40 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                          value={field.state.value.service}
                          onChange={(event) =>
                            field.handleChange({
                              ...field.state.value,
                              service: event.target.value
                            })
                          }
                        >
                          <option value="">Any service</option>
                          {incidentServices.map((service) => (
                            <option key={service} value={service}>
                              {service}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-slate-300">
                        <span>Severity</span>
                        <select
                          className="focus:border-brand-300 focus:ring-brand-400/40 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                          value={field.state.value.severity}
                          onChange={(event) =>
                            field.handleChange({
                              ...field.state.value,
                              severity: event.target.value
                            })
                          }
                        >
                          <option value="">Any severity</option>
                          {incidentSeverities.map((severity) => (
                            <option key={severity} value={severity}>
                              {severity}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="space-y-1 text-xs text-slate-300 sm:col-span-2">
                        <span id="runbook-match-fingerprint-label">Fingerprint contains</span>
                        <Input
                          id="runbook-match-fingerprint-contains"
                          name="runbook-match-fingerprint-contains"
                          aria-labelledby="runbook-match-fingerprint-label"
                          value={field.state.value.fingerprint_contains}
                          placeholder="db, queue, api-http..."
                          onChange={(event) =>
                            field.handleChange({
                              ...field.state.value,
                              fingerprint_contains: event.target.value
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              }}
            </form.Field>

            <form.Field
              name="checklist"
              validators={{
                onBlur: ({ value }) => {
                  const parsed = runbookSchema.shape.checklist.safeParse(value);
                  return parsed.success
                    ? undefined
                    : (parsed.error.issues[0]?.message ?? "Invalid value");
                }
              }}
            >
              {(field) => {
                const fieldError = field.state.meta.errors[0] as string | undefined;
                const error = fieldError ?? checklistDraftError;
                return (
                  <Field
                    label="Checklist steps"
                    htmlFor="runbook-checklist-step"
                    error={error}
                    description="Add one action at a time. Press Enter or click Add."
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          id="runbook-checklist-step"
                          name={field.name}
                          placeholder="Example: Verify DB lock wait spikes on primary"
                          value={checklistDraft}
                          onChange={(event) => {
                            setChecklistDraft(event.target.value);
                            if (checklistDraftError) {
                              setChecklistDraftError(undefined);
                            }
                          }}
                          onKeyDown={(event) =>
                            handleChecklistInputKeyDown(
                              event,
                              field.state.value,
                              field.handleChange
                            )
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            addChecklistStep(field.state.value, field.handleChange);
                          }}
                        >
                          Add
                        </Button>
                      </div>

                      {field.state.value.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                          No checklist steps added yet.
                        </p>
                      ) : (
                        <ol className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/50 p-2">
                          {field.state.value.map((step, index) => (
                            <li
                              key={`${step}-${index}`}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-200"
                            >
                              <span className="truncate">
                                <span className="mr-2 text-slate-400">{index + 1}.</span>
                                {step}
                              </span>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/60 p-1 text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                                aria-label={`Remove checklist step ${index + 1}`}
                                onClick={() =>
                                  removeChecklistStep(index, field.state.value, field.handleChange)
                                }
                              >
                                <X className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </Field>
                );
              }}
            </form.Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                className="flex-1 justify-center sm:flex-none"
                disabled={createRunbookMutation.isPending || updateRunbookMutation.isPending}
              >
                <ClipboardCheck className="size-4" />
                {createRunbookMutation.isPending || updateRunbookMutation.isPending
                  ? "Saving..."
                  : isEditing
                    ? "Save Runbook"
                    : "Create Runbook"}
              </Button>
              {isEditing ? (
                <Button type="button" variant="ghost" onClick={clearEditor}>
                  Cancel Edit
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="space-y-4 border-slate-700/90 bg-slate-900/70">
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-100">
              <BookOpenText className="size-4" />
              Available Templates
            </h2>
            <p className="text-xs text-slate-400">{runbookCount} total</p>
          </div>

          {runbooksQuery.isPending ? (
            <p className="text-sm text-slate-400">Loading runbooks...</p>
          ) : runbooksQuery.isError ? (
            <p className="text-sm text-rose-300">Unable to load runbooks right now.</p>
          ) : runbooksQuery.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {runbooksQuery.data.map((runbook) => (
                <div
                  key={runbook.id}
                  className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{runbook.name}</p>
                      <p className="line-clamp-2 text-xs text-slate-400">{runbook.description}</p>
                    </div>
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/70 p-1.5 text-slate-300 transition hover:border-indigo-400 hover:text-indigo-200"
                        onClick={() => handleEditRunbook(runbook)}
                        aria-label={`Edit ${runbook.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/70 p-1.5 text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                        onClick={() => handleDeleteRunbook(runbook)}
                        aria-label={`Delete ${runbook.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <Badge tone="neutral">source {formatMatchValue(runbook.match.source)}</Badge>
                    <Badge tone="neutral">event {formatMatchValue(runbook.match.event_type)}</Badge>
                    <Badge tone="neutral">service {formatMatchValue(runbook.match.service)}</Badge>
                    <Badge tone="neutral">
                      severity {formatMatchValue(runbook.match.severity)}
                    </Badge>
                  </div>

                  <ul className="space-y-1 text-xs text-slate-300">
                    {runbook.checklist.slice(0, 4).map((item) => (
                      <li key={item.id} className="inline-flex items-start gap-2">
                        <span className="mt-1 size-1.5 rounded-full bg-indigo-300" />
                        <span>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No runbooks created yet. Use Load Samples to populate this view.
            </p>
          )}
        </Card>
      </div>
    </section>
  );
};

export const RunbooksPage = memo(RunbooksPageComponent);
