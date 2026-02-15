import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    async lazy() {
      const module = await import("@/app/layout/app-shell");
      return { Component: module.AppShell };
    },
    children: [
      {
        index: true,
        async lazy() {
          const module = await import("@/features/incidents/pages/incidents-page");
          return { Component: module.IncidentsPage };
        }
      },
      {
        path: "analytics",
        async lazy() {
          const module = await import("@/features/analytics/pages/analytics-page");
          return { Component: module.AnalyticsPage };
        }
      }
    ]
  },
  {
    path: "*",
    async lazy() {
      const module = await import("@/app/pages/not-found-page");
      return { Component: module.NotFoundPage };
    }
  }
]);
