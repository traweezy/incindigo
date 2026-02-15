import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateIncidentForm } from "@/features/incidents/components/create-incident-form";
import type {
  CreateIncidentInput,
  CreateIncidentResponse
} from "@/features/incidents/schemas/incident-schemas";

describe("CreateIncidentForm", () => {
  it("submits a normalized payload", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async (_input: CreateIncidentInput): Promise<CreateIncidentResponse> => {
      return {
        deduplicated: false,
        incident: {
          id: "c0b8ffb8-afe1-4ec6-afb4-6d2f4db14f16",
          fingerprint: "api-cpu",
          source: "manual-demo",
          event_type: "cpu.high",
          summary: "CPU above threshold",
          severity: "high",
          status: "open",
          metadata: {
            host: "api-1",
            region: "us-east-1",
            service: "api"
          },
          created_at: "2026-02-14T10:00:00.000Z",
          updated_at: "2026-02-14T10:00:00.000Z"
        }
      };
    });

    render(<CreateIncidentForm onCreate={onCreate} isSubmitting={false} />);

    await user.type(screen.getByLabelText(/Fingerprint/i), "api-cpu");
    await user.selectOptions(screen.getByLabelText(/Source/i), "manual-demo");
    await user.selectOptions(screen.getByLabelText(/Event Type/i), "cpu.high");
    await user.type(screen.getByLabelText(/Summary/i), "CPU above threshold for sustained period");
    await user.selectOptions(screen.getByLabelText(/Severity/i), "high");
    await user.type(screen.getByLabelText(/Host/i), "api-1");
    await user.selectOptions(screen.getByLabelText(/Region/i), "us-east-1");
    await user.selectOptions(screen.getByLabelText(/Service/i), "api");

    await user.click(screen.getByRole("button", { name: /Create Incident/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      fingerprint: "api-cpu",
      source: "manual-demo",
      event_type: "cpu.high",
      severity: "high",
      metadata: {
        host: "api-1",
        region: "us-east-1",
        service: "api",
        created_from: "frontend"
      }
    });

    expect(screen.getByText(/Incident created successfully\. ID:/i)).toBeInTheDocument();
  });
});
