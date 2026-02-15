import { expect, test } from "@playwright/test";

const asStringOrEmpty = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

const baseIncident = {
  id: "8af6b13e-a5bb-4f98-9cc0-a9822beec328",
  fingerprint: "db-latency",
  source: "synthetic",
  event_type: "db.latency",
  summary: "Database latency crossed 500ms",
  severity: "high",
  reported_by: "alerts@incindigo.dev",
  status: "open",
  metadata: {
    service: "postgres"
  },
  created_at: "2026-02-14T12:00:00.000Z",
  updated_at: "2026-02-14T12:00:00.000Z"
};

const baseRunbook = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Database Latency Triage",
  description: "Steps for stabilizing database latency incidents.",
  checklist: [
    { id: "item-1", title: "Review dashboards", completed: false },
    { id: "item-2", title: "Scale read replicas", completed: false }
  ],
  match: {
    source: "synthetic",
    event_type: "db.latency",
    service: "postgres",
    severity: "high",
    fingerprint_contains: "db-latency"
  },
  created_at: "2026-02-14T12:00:00.000Z",
  updated_at: "2026-02-14T12:00:00.000Z"
};

test.beforeEach(async ({ page }) => {
  const runbooks = [structuredClone(baseRunbook)];

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "incindigo_auth_session",
      JSON.stringify({
        authenticatedAt: new Date().toISOString(),
        email: "operator@incindigo.dev",
        sessionToken: "session-token-demo-1234567890"
      })
    );
  });

  await page.route("**/api/v1/incidents/stream", async (route) => {
    await route.abort();
  });

  await page.route("**/api/v1/incidents/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        overview: {
          generated_at: "2026-02-14T12:00:00.000Z",
          counts: {
            total: 1,
            open: 1,
            resolved: 0,
            severity: {
              critical: 0,
              high: 1,
              medium: 0,
              low: 0
            }
          },
          resolution: {
            average_seconds: 120,
            resolved_within_30m: 0
          },
          top_sources: [
            {
              source: "synthetic",
              total: 1,
              open: 1
            }
          ],
          top_event_types: [
            {
              event_type: "db.latency",
              total: 1,
              open: 1
            }
          ],
          recent_activity: [
            {
              bucket_start: "2026-02-14T11:30:00.000Z",
              created: 1,
              resolved: 0
            }
          ]
        }
      })
    });
  });

  await page.route("**/api/v1/incidents*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [baseIncident]
      })
    });
  });

  await page.route("**/api/v1/webhooks/events", async (route) => {
    const requestBody = route.request().postDataJSON() as Record<string, unknown>;

    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        deduplicated: false,
        incident: {
          ...baseIncident,
          id: "dcbd4d3b-fd77-4fe7-84f8-f61142ec516d",
          fingerprint: requestBody.fingerprint,
          source: requestBody.source,
          event_type: requestBody.event_type,
          summary: requestBody.summary,
          severity: requestBody.severity,
          reported_by: requestBody.reported_by,
          metadata: requestBody.metadata
        }
      })
    });
  });

  await page.route("**/api/v1/incidents/*/resolve", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        incident: {
          ...baseIncident,
          status: "resolved",
          resolved_at: "2026-02-14T13:00:00.000Z"
        }
      })
    });
  });

  await page.route("**/api/v1/incidents/*/cancel", async (route) => {
    const payload = route.request().postDataJSON() as {
      cancelled_by: string;
      reason: string;
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        incident: {
          ...baseIncident,
          status: "cancelled",
          cancelled_by: payload.cancelled_by,
          cancel_reason: payload.reason,
          cancelled_at: "2026-02-14T13:10:00.000Z"
        }
      })
    });
  });

  await page.route("**/api/v1/incidents/*/runbooks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: runbooks
      })
    });
  });

  await page.route("**/api/v1/runbooks**", async (route) => {
    const method = route.request().method();
    const requestURL = new URL(route.request().url());
    const path = requestURL.pathname;

    if (method === "GET" && path === "/api/v1/runbooks") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: runbooks
        })
      });
      return;
    }

    if (method === "POST" && path === "/api/v1/runbooks") {
      const payload = route.request().postDataJSON() as {
        checklist: string[];
        description: string;
        name: string;
        match?: Record<string, unknown>;
      };

      const createdRunbook = {
        ...baseRunbook,
        id: "fcf459f3-820f-4280-bf76-7f17f15f19f1",
        checklist: payload.checklist.map((item, index) => ({
          id: `item-${index + 1}`,
          title: item,
          completed: false
        })),
        description: payload.description,
        name: payload.name,
        match: {
          source: asStringOrEmpty(payload.match?.source),
          event_type: asStringOrEmpty(payload.match?.event_type),
          service: asStringOrEmpty(payload.match?.service),
          severity: asStringOrEmpty(payload.match?.severity),
          fingerprint_contains: asStringOrEmpty(payload.match?.fingerprint_contains)
        }
      };

      runbooks.unshift(createdRunbook);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          runbook: createdRunbook
        })
      });
      return;
    }

    if (method === "PUT" && path.startsWith("/api/v1/runbooks/")) {
      const runbookID = path.split("/").pop() ?? "";
      const payload = route.request().postDataJSON() as {
        checklist: string[];
        description: string;
        name: string;
        match?: Record<string, unknown>;
      };

      const existing = runbooks.find((item) => item.id === runbookID);
      if (!existing) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ title: "Not found" })
        });
        return;
      }

      const updatedRunbook = {
        ...existing,
        checklist: payload.checklist.map((item, index) => ({
          id: `item-${index + 1}`,
          title: item,
          completed: false
        })),
        description: payload.description,
        name: payload.name,
        match: {
          source: asStringOrEmpty(payload.match?.source),
          event_type: asStringOrEmpty(payload.match?.event_type),
          service: asStringOrEmpty(payload.match?.service),
          severity: asStringOrEmpty(payload.match?.severity),
          fingerprint_contains: asStringOrEmpty(payload.match?.fingerprint_contains)
        }
      };

      const existingIndex = runbooks.findIndex((item) => item.id === runbookID);
      runbooks[existingIndex] = updatedRunbook;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          runbook: updatedRunbook
        })
      });
      return;
    }

    if (method === "DELETE" && path.startsWith("/api/v1/runbooks/")) {
      const runbookID = path.split("/").pop() ?? "";
      const existingIndex = runbooks.findIndex((item) => item.id === runbookID);
      if (existingIndex === -1) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ title: "Not found" })
        });
        return;
      }

      runbooks.splice(existingIndex, 1);
      await route.fulfill({
        status: 204,
        body: ""
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({
        title: "Method not allowed"
      })
    });
  });
});

test("cancels incidents and surfaces cancellation metadata", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Database latency crossed 500ms")).toBeVisible();

  await page
    .getByRole("button", { name: /^Cancel$/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Cancel Incident" })).toBeVisible();
  await page
    .getByPlaceholder("False positive, duplicate alert, invalid monitor...")
    .fill("False positive alert");
  await page.getByRole("button", { name: "Cancel Incident" }).click();

  await expect(page.getByText("Incident cancelled")).toBeVisible();
  await page.getByRole("button", { name: "Inspect" }).first().click();
  await expect(page.getByText("Cancellation")).toBeVisible();
  await expect(page.getByText("False positive alert")).toBeVisible();
  await expect(page.getByText("Cancelled by operator@incindigo.dev")).toBeVisible();
});

test("discovers incident runbooks from incident details", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Database latency crossed 500ms")).toBeVisible();

  await page.getByRole("button", { name: "Inspect" }).first().click();
  await expect(page.getByText("Matching Runbooks")).toBeVisible();
  await expect(page.getByText("Database Latency Triage")).toBeVisible();
  await expect(page.getByText("Review dashboards")).toBeVisible();
  await expect(page.getByText("Scale read replicas")).toBeVisible();
});

test("edits and deletes runbooks", async ({ page }) => {
  await page.goto("/runbooks");
  await expect(page.getByRole("heading", { name: "Runbooks" })).toBeVisible();
  await expect(page.getByText("Database Latency Triage")).toBeVisible();

  await page.getByLabel("Edit Database Latency Triage").click();
  await page.getByLabel("Name").fill("Database Latency Recovery");
  await page.getByRole("button", { name: "Save Runbook" }).click();
  await expect(page.getByText("Database Latency Recovery")).toBeVisible();

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByLabel("Delete Database Latency Recovery").click();
  await expect(page.getByText("Database Latency Recovery")).not.toBeVisible();
});

test("shows dashboard workflows: create, resolve, and history filter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Incident Command Deck" })).toBeVisible();
  await expect(page.getByText("Database latency crossed 500ms")).toBeVisible();

  await page.getByRole("link", { name: "Create Incident" }).click();
  await expect(page.getByRole("heading", { name: "Manually trigger an event" })).toBeVisible();

  await page.getByLabel("Fingerprint").fill("api-errors");
  await page.getByLabel("Source").selectOption("manual-demo");
  await page.getByLabel("Event Type").selectOption("http.5xx");
  await page.getByLabel("Summary").fill("5xx responses exceeded SLO budget");
  await page.getByLabel("Host").fill("api-2");
  await page.getByLabel("Region").selectOption("us-east-1");
  await page.getByLabel("Service").selectOption("api");

  await page.getByRole("button", { name: "Create Incident" }).click();
  await expect(page.getByRole("heading", { name: "Incident Composer" })).not.toBeVisible();
  await expect(page.getByText("5xx responses exceeded SLO budget")).toBeVisible();

  await page
    .getByRole("button", { name: /^Resolve$/ })
    .first()
    .click();
  await expect(page.getByText("Incident resolved")).toBeVisible();

  await page.getByLabel("Status filter").selectOption("resolved");
  await expect(page.getByText("Database latency crossed 500ms")).toBeVisible();
});

test("creates and renders runbooks from backend API", async ({ page }) => {
  await page.goto("/runbooks");

  await expect(page.getByRole("heading", { name: "Runbooks" })).toBeVisible();
  await expect(page.getByText("Database Latency Triage")).toBeVisible();

  await page.getByLabel("Name").fill("Queue Backlog Response");
  await page.getByLabel("Description").fill("Checklist for recovering queue backlog incidents.");
  const checklistInput = page.getByLabel("Checklist steps");
  await checklistInput.fill("Check queue depth");
  await checklistInput.press("Enter");
  await checklistInput.fill("Restart worker pool");
  await checklistInput.press("Enter");
  await checklistInput.fill("Replay stuck jobs");
  await checklistInput.press("Enter");

  await page.getByRole("button", { name: "Create Runbook" }).click();
  await expect(page.getByText("Runbook created")).toBeVisible();
  await expect(page.getByText("Queue Backlog Response")).toBeVisible();
});
