import { createBrowserRouter } from "react-router-dom";
import { redirectAuthedLoader, requireAuthLoader } from "@/features/auth/lib/route-guards";

export const router = createBrowserRouter([
  {
    path: "/",
    loader: requireAuthLoader,
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
      },
      {
        path: "runbooks",
        async lazy() {
          const module = await import("@/features/runbooks/pages/runbooks-page");
          return { Component: module.RunbooksPage };
        }
      }
    ]
  },
  {
    path: "/auth",
    loader: redirectAuthedLoader,
    async lazy() {
      const module = await import("@/features/auth/pages/auth-page");
      return { Component: module.AuthPage };
    }
  },
  {
    path: "/auth/verify",
    loader: redirectAuthedLoader,
    async lazy() {
      const module = await import("@/features/auth/pages/auth-verify-page");
      return { Component: module.AuthVerifyPage };
    }
  },
  {
    path: "*",
    async lazy() {
      const module = await import("@/app/pages/not-found-page");
      return { Component: module.NotFoundPage };
    }
  }
]);
