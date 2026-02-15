import { BarChart3, Gauge, Radar, Siren } from "lucide-react";
import { memo, useMemo, type FC } from "react";
import { Badge } from "@/shared/components/primitives/badge";
import { Card } from "@/shared/components/primitives/card";
import type { IncidentOverview } from "@/features/incidents/schemas/incident-schemas";

type IncidentsOverviewProps = {
  overview: IncidentOverview | undefined;
  isPending: boolean;
  isError: boolean;
};

const IncidentsOverviewComponent: FC<IncidentsOverviewProps> = ({ overview, isPending, isError }) => {
  const maxActivity = useMemo(() => {
    if (!overview || overview.recent_activity.length === 0) {
      return 1;
    }

    return Math.max(
      ...overview.recent_activity.map((bucket) => {
        return Math.max(bucket.created, bucket.resolved);
      }),
      1
    );
  }, [overview]);

  if (isError) {
    return (
      <Card className="border-rose-400/40 bg-rose-950/20">
        <p className="text-sm text-rose-100">Analytics overview is temporarily unavailable.</p>
      </Card>
    );
  }

  if (isPending || !overview) {
    return (
      <Card className="border-slate-700/90 bg-slate-900/70">
        <p className="text-sm text-slate-300">Loading server-side analytics...</p>
      </Card>
    );
  }

  const resolvedRate = overview.counts.total
    ? Math.round((overview.counts.resolved / overview.counts.total) * 100)
    : 0;
  const avgResolveMinutes = Math.round(overview.resolution.average_seconds / 60);

  return (
    <Card className="space-y-5 border-slate-700/90 bg-slate-900/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-slate-400 uppercase">Operations Snapshot</p>
          <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-slate-100">
            <BarChart3 className="size-4" />
            Server-computed incident analytics
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Updated {new Date(overview.generated_at).toLocaleTimeString()}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Open incidents</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">{overview.counts.open}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Resolved share</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">{resolvedRate}%</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Avg resolve</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">{avgResolveMinutes || 0}m</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Resolved in 30m</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">{overview.resolution.resolved_within_30m}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-h-[19rem] flex-col space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Gauge className="size-4" />
            Recent Activity (30m buckets)
          </p>
          <div className="grid min-h-52 flex-1 grid-cols-12 items-end gap-1.5">
            {overview.recent_activity.slice(-12).map((bucket) => {
              const createdHeight = Math.max(10, Math.round((bucket.created / maxActivity) * 92));
              const resolvedHeight = Math.max(8, Math.round((bucket.resolved / maxActivity) * 72));

              return (
                <div key={bucket.bucket_start} className="flex flex-col items-center gap-1">
                  <div className="flex h-24 w-full max-w-4 items-end rounded-full bg-slate-900/80 p-[2px]">
                    <div className="w-full rounded-full bg-sky-400/70" style={{ height: `${createdHeight}px` }} />
                  </div>
                  <div className="flex h-20 w-full max-w-4 items-end rounded-full bg-slate-900/80 p-[2px]">
                    <div
                      className="w-full rounded-full bg-emerald-400/70"
                      style={{ height: `${resolvedHeight}px` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">Top bars: created, bottom bars: resolved.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Siren className="size-4" />
              Top Sources (by volume)
            </p>
            <div className="space-y-2">
              {overview.top_sources.slice(0, 4).map((source) => {
                return (
                  <div key={source.source} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-slate-200">{source.source}</span>
                    <div className="inline-flex items-center gap-1.5">
                      <Badge tone="neutral">{source.total} total</Badge>
                      <Badge tone={source.open > 0 ? "high" : "low"}>{source.open} open</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Radar className="size-4" />
              Top Event Types (by volume)
            </p>
            <div className="space-y-2">
              {overview.top_event_types.slice(0, 4).map((eventType) => {
                return (
                  <div
                    key={eventType.event_type}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-slate-200">{eventType.event_type}</span>
                    <div className="inline-flex items-center gap-1.5">
                      <Badge tone="neutral">{eventType.total} total</Badge>
                      <Badge tone={eventType.open > 0 ? "high" : "low"}>{eventType.open} open</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export const IncidentsOverview = memo(IncidentsOverviewComponent);
