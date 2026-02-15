import { BarChart3, Clock3, ListChecks } from "lucide-react";
import { memo, useCallback, useMemo, useState, type FC } from "react";
import { IncidentsOverview } from "@/features/incidents/components/incidents-overview";
import { LiveActivityFeed } from "@/features/incidents/components/live-activity-feed";
import { useIncidentOverviewQuery } from "@/features/incidents/hooks/use-incident-overview-query";
import { useIncidentStream } from "@/features/incidents/hooks/use-incident-stream";
import { useIncidentsQuery } from "@/features/incidents/hooks/use-incidents-query";
import type { TimelineEvent } from "@/features/incidents/schemas/incident-schemas";
import { Badge } from "@/shared/components/primitives/badge";
import { Card } from "@/shared/components/primitives/card";

const AnalyticsPageComponent: FC = () => {
  const overviewQuery = useIncidentOverviewQuery();
  const incidentsQuery = useIncidentsQuery();

  const [recentEvents, setRecentEvents] = useState<TimelineEvent[]>([]);
  const handleStreamEvent = useCallback((event: TimelineEvent) => {
    setRecentEvents((current) => [event, ...current].slice(0, 20));
  }, []);

  const stream = useIncidentStream({ onEvent: handleStreamEvent });

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);
  const recentIncidents = useMemo(() => incidents.slice(0, 8), [incidents]);
  const baselineEvents = useMemo<TimelineEvent[]>(() => {
    return incidents.slice(0, 12).map((incident) => {
      const resolvedAt = incident.resolved_at;
      return {
        event_type: incident.status === "resolved" ? "resolved" : "created",
        incident,
        occurred_at: incident.status === "resolved" && resolvedAt ? resolvedAt : incident.created_at
      };
    });
  }, [incidents]);
  const liveActivityEvents = useMemo(() => {
    const deduped = new Map<string, TimelineEvent>();
    for (const event of [...recentEvents, ...baselineEvents]) {
      const key = `${event.event_type}:${event.incident.id}:${event.occurred_at}`;
      if (!deduped.has(key)) {
        deduped.set(key, event);
      }
    }

    return [...deduped.values()]
      .sort((left, right) => Date.parse(right.occurred_at) - Date.parse(left.occurred_at))
      .slice(0, 20);
  }, [baselineEvents, recentEvents]);

  return (
    <section className="space-y-6">
      <Card className="overflow-hidden border-indigo-300/40 bg-gradient-to-r from-indigo-950/65 via-slate-900 to-slate-900">
        <div className="space-y-3">
          <p className="font-mono text-xs tracking-[0.2em] text-indigo-300 uppercase">Go Analytics Surface</p>
          <h1 className="font-display text-3xl font-semibold text-slate-50 sm:text-4xl">
            Incident Analytics
          </h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Server-computed trends refresh continuously while the SSE timeline streams creation,
            deduplication, and resolution events in real time.
          </p>
        </div>
      </Card>

      <div className="grid items-start gap-4 min-[1500px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <IncidentsOverview
          overview={overviewQuery.data}
          isPending={overviewQuery.isPending}
          isError={overviewQuery.isError}
        />
        <LiveActivityFeed
          events={liveActivityEvents}
          connectionState={stream.connectionState}
          lastEventAt={stream.lastEventAt}
        />
      </div>

      <Card className="space-y-3 border-slate-700/90 bg-slate-900/70">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ListChecks className="size-4" />
            Latest Incident Sample
          </p>
          <Badge tone="neutral">{recentIncidents.length} shown</Badge>
        </div>

        {incidentsQuery.isPending ? (
          <p className="text-sm text-slate-400">Loading incidents...</p>
        ) : recentIncidents.length === 0 ? (
          <p className="text-sm text-slate-400">No incidents available yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recentIncidents.map((incident) => {
              return (
                <div
                  key={incident.id}
                  className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={incident.severity}>{incident.severity}</Badge>
                    <p
                      className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${
                        incident.status === "resolved" ? "text-emerald-200" : "text-sky-200"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2 rounded-full ${
                          incident.status === "resolved" ? "bg-emerald-400" : "bg-sky-400"
                        }`}
                      />
                      {incident.status}
                    </p>
                  </div>
                  <p className="line-clamp-2 text-sm font-medium text-slate-100">{incident.summary}</p>
                  <p className="truncate text-xs text-slate-400">
                    {incident.source} | {incident.event_type}
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="size-3.5" />
                    {new Date(incident.created_at).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="border-emerald-400/20 bg-emerald-950/10">
        <p className="inline-flex items-center gap-2 text-sm text-emerald-200">
          <BarChart3 className="size-4" />
          This page is powered by server-side Go aggregates plus real-time stream events.
        </p>
      </Card>
    </section>
  );
};

export const AnalyticsPage = memo(AnalyticsPageComponent);
