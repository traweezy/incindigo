import { expect, test } from "@playwright/test";

const baseIncident = {
  id: "8af6b13e-a5bb-4f98-9cc0-a9822beec328",
  fingerprint: "db-latency",
  source: "synthetic",
  event_type: "db.latency",
  summary: "Database latency crossed 500ms",
  severity: "high",
  status: "open",
  metadata: {
    service: "postgres"
  },
  created_at: "2026-02-14T12:00:00.000Z",
  updated_at: "2026-02-14T12:00:00.000Z"
};

test.beforeEach(async ({ page }) => {
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
