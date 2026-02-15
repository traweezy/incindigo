import { useForm } from "@tanstack/react-form";
import { memo, useCallback, useMemo, useState, type FC, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/shared/components/primitives/button";
import { Field } from "@/shared/components/primitives/field";
import { Input } from "@/shared/components/primitives/input";
import { TextArea } from "@/shared/components/primitives/textarea";
import {
  createIncidentInputSchema,
  type CreateIncidentInput,
  type CreateIncidentResponse,
  type IncidentSeverity
} from "@/features/incidents/schemas/incident-schemas";

type CreateIncidentFormValues = {
  fingerprint: string;
  source: string;
  eventType: string;
  summary: string;
  severity: IncidentSeverity;
  host: string;
  region: string;
  service: string;
};

type CreateIncidentFormProps = {
  onCreate: (input: CreateIncidentInput) => Promise<CreateIncidentResponse>;
  isSubmitting: boolean;
};

const fieldSchemas = {
  fingerprint: z.string().trim().min(3, "Fingerprint must be at least 3 characters."),
  source: z.string().trim().min(2, "Source is required."),
  eventType: z.string().trim().min(3, "Event type is required."),
  summary: z.string().trim().min(8, "Summary should be at least 8 characters."),
  host: z.string().trim().optional(),
  region: z.string().trim().optional(),
  service: z.string().trim().optional()
} as const;

const validateField = <T,>(schema: z.ZodType<T>, value: unknown): string | undefined => {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return undefined;
  }

  return parsed.error.issues[0]?.message ?? "Invalid value";
};

const initialValues: CreateIncidentFormValues = {
  fingerprint: "",
  source: "manual-demo",
  eventType: "http.5xx",
  summary: "",
  severity: "high",
  host: "",
  region: "",
  service: ""
};

const CreateIncidentFormComponent: FC<CreateIncidentFormProps> = ({ isSubmitting, onCreate }) => {
  const [createdIncidentID, setCreatedIncidentID] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value, formApi }) => {
      const payload = createIncidentInputSchema.parse({
        fingerprint: value.fingerprint,
        source: value.source,
        event_type: value.eventType,
        summary: value.summary,
        severity: value.severity,
        metadata: {
          ...(value.host ? { host: value.host } : {}),
          ...(value.region ? { region: value.region } : {}),
          ...(value.service ? { service: value.service } : {}),
          created_from: "frontend"
        }
      });

      const result = await onCreate(payload);
      setCreatedIncidentID(result.incident.id);
      formApi.reset();
    }
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      void form.handleSubmit();
    },
    [form]
  );

  const severityOptions = useMemo(
    () =>
      [
        { label: "Critical", value: "critical" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" }
      ] as const,
    []
  );
  const sourceOptions = useMemo(
    () =>
      [
        { label: "Manual Demo", value: "manual-demo" },
        { label: "PagerDuty", value: "pagerduty" },
        { label: "Grafana", value: "grafana" },
        { label: "CloudWatch", value: "cloudwatch" },
        { label: "Sentry", value: "sentry" }
      ] as const,
    []
  );
  const eventTypeOptions = useMemo(
    () =>
      [
        { label: "HTTP 5xx Spike", value: "http.5xx" },
        { label: "Database Latency", value: "db.latency" },
        { label: "CPU High", value: "cpu.high" },
        { label: "Memory Pressure", value: "memory.pressure" },
        { label: "Queue Backlog", value: "queue.backlog" },
        { label: "Disk Space", value: "disk.space" }
      ] as const,
    []
  );
  const regionOptions = useMemo(
    () =>
      [
        { label: "Not set", value: "" },
        { label: "us-east-1", value: "us-east-1" },
        { label: "us-west-2", value: "us-west-2" },
        { label: "eu-west-1", value: "eu-west-1" },
        { label: "ap-southeast-1", value: "ap-southeast-1" }
      ] as const,
    []
  );
  const serviceOptions = useMemo(
    () =>
      [
        { label: "Not set", value: "" },
        { label: "api", value: "api" },
        { label: "worker", value: "worker" },
        { label: "scheduler", value: "scheduler" },
        { label: "edge", value: "edge" },
        { label: "billing", value: "billing" }
      ] as const,
    []
  );

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-[0.22em] text-indigo-300 uppercase">
          Create Incident
        </p>
        <h2 className="font-display text-2xl font-semibold text-slate-100">
          Manually trigger an event
        </h2>
        <p className="text-sm text-slate-400">
          Use this page to simulate webhook ingest events and test timeline behavior.
        </p>
      </header>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="fingerprint"
            validators={{
              onBlur: ({ value }) => validateField(fieldSchemas.fingerprint, value)
            }}
          >
            {(field) => {
              const error = field.state.meta.errors[0] as string | undefined;
              return (
                <Field label="Fingerprint" htmlFor="fingerprint" error={error}>
                  <Input
                    id="fingerprint"
                    name={field.name}
                    placeholder="service-a:disk-space"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    autoComplete="off"
                    required
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field
            name="source"
            validators={{
              onBlur: ({ value }) => validateField(fieldSchemas.source, value)
            }}
          >
            {(field) => {
              const error = field.state.meta.errors[0] as string | undefined;
              return (
                <Field label="Source" htmlFor="source" error={error}>
                  <select
                    id="source"
                    name={field.name}
                    className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    {sourceOptions.map((option) => {
                      return (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              );
            }}
          </form.Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="eventType"
            validators={{
              onBlur: ({ value }) => validateField(fieldSchemas.eventType, value)
            }}
          >
            {(field) => {
              const error = field.state.meta.errors[0] as string | undefined;
              return (
                <Field label="Event Type" htmlFor="eventType" error={error}>
                  <select
                    id="eventType"
                    name={field.name}
                    className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    {eventTypeOptions.map((option) => {
                      return (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="severity">
            {(field) => {
              return (
                <Field label="Severity" htmlFor="severity">
                  <select
                    id="severity"
                    name={field.name}
                    className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value as IncidentSeverity)}
                  >
                    {severityOptions.map((option) => {
                      return (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              );
            }}
          </form.Field>
        </div>

        <form.Field
          name="summary"
          validators={{
            onBlur: ({ value }) => validateField(fieldSchemas.summary, value)
          }}
        >
          {(field) => {
            const error = field.state.meta.errors[0] as string | undefined;
            return (
              <Field label="Summary" htmlFor="summary" error={error}>
                <TextArea
                  id="summary"
                  name={field.name}
                  placeholder="Describe what is happening and why this matters."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </Field>
            );
          }}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <form.Field
            name="host"
            validators={{
              onBlur: ({ value }) => validateField(fieldSchemas.host, value)
            }}
          >
            {(field) => {
              return (
                <Field label="Host" htmlFor="host">
                  <Input
                    id="host"
                    name={field.name}
                    placeholder="api-7"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    autoComplete="off"
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field
            name="region"
            validators={{
              onBlur: ({ value }) => validateField(fieldSchemas.region, value)
            }}
          >
            {(field) => {
              return (
                <Field label="Region" htmlFor="region">
                  <select
                    id="region"
                    name={field.name}
                    className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    {regionOptions.map((option) => {
                      return (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              );
            }}
          </form.Field>

          <form.Field
            name="service"
            validators={{
              onBlur: ({ value }) => validateField(fieldSchemas.service, value)
            }}
          >
            {(field) => {
              return (
                <Field label="Service" htmlFor="service">
                  <select
                    id="service"
                    name={field.name}
                    className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    {serviceOptions.map((option) => {
                      return (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              );
            }}
          </form.Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <form.Subscribe
            selector={(state) => {
              return [state.canSubmit, state.isSubmitting] as const;
            }}
          >
            {([canSubmit, formIsSubmitting]) => {
              const disabled = !canSubmit || formIsSubmitting || isSubmitting;
              return (
                <Button type="submit" disabled={disabled}>
                  {formIsSubmitting || isSubmitting ? "Submitting..." : "Create Incident"}
                </Button>
              );
            }}
          </form.Subscribe>
          <Button type="button" variant="ghost" onClick={() => form.reset()}>
            Clear
          </Button>
        </div>
      </form>

      <p
        className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300"
        aria-live="polite"
      >
        {createdIncidentID
          ? `Incident created successfully. ID: ${createdIncidentID}`
          : "Create an incident to push it to the live board and SSE stream."}
      </p>
    </section>
  );
};

export const CreateIncidentForm = memo(CreateIncidentFormComponent);
