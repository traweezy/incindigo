import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Search,
  Signal,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState, type FC } from "react";
import { CreateIncidentForm } from "@/features/incidents/components/create-incident-form";
import { IncidentCard } from "@/features/incidents/components/incident-card";
import { IncidentDetailDialog } from "@/features/incidents/components/incident-detail-dialog";
import { IncidentsGridSkeleton } from "@/features/incidents/components/incidents-grid-skeleton";
import { useCreateIncident } from "@/features/incidents/hooks/use-create-incident";
import { useIncidentStream } from "@/features/incidents/hooks/use-incident-stream";
import { useIncidentsQuery } from "@/features/incidents/hooks/use-incidents-query";
import { useResolveIncident } from "@/features/incidents/hooks/use-resolve-incident";
import { useSeedIncidents } from "@/features/incidents/hooks/use-seed-incidents";
import type {
  CreateIncidentInput,
  CreateIncidentResponse,
  Incident,
  IncidentSeverity
} from "@/features/incidents/schemas/incident-schemas";
import { Badge } from "@/shared/components/primitives/badge";
import { Button } from "@/shared/components/primitives/button";
import { Card } from "@/shared/components/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/shared/components/primitives/dialog";
import { Input } from "@/shared/components/primitives/input";

type StatusFilter = "all" | "open" | "resolved";
type SortOrder = "newest" | "oldest" | "severity";
type SeverityFilter = "all" | IncidentSeverity;
type SeedBatchSize = "30" | "60" | "120";

const severityRank: Record<IncidentSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const openComposerEventName = "incindigo:open-composer";

const IncidentsPageComponent: FC = () => {
  const { data, isPending, isError, error } = useIncidentsQuery();
  const createIncidentMutation = useCreateIncident();
  const resolveIncidentMutation = useResolveIncident();
  const seedIncidentsMutation = useSeedIncidents();
  const stream = useIncidentStream();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchValue, setSearchValue] = useState("");
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [seedBatchSize, setSeedBatchSize] = useState<SeedBatchSize>("60");

  const incidents = useMemo(() => data ?? [], [data]);
  const normalizedSearch = useMemo(() => searchValue.trim().toLowerCase(), [searchValue]);

  const filteredIncidents = useMemo(() => {
    const filtered = incidents.filter((incident) => {
      if (statusFilter !== "all" && incident.status !== statusFilter) {
        return false;
      }
      if (severityFilter !== "all" && incident.severity !== severityFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const searchableValue = [
        incident.summary,
        incident.fingerprint,
        incident.source,
        incident.event_type
      ]
        .join(" ")
        .toLowerCase();

      return searchableValue.includes(normalizedSearch);
    });

    return filtered.sort((left, right) => {
      if (sortOrder === "severity") {
        return severityRank[right.severity] - severityRank[left.severity];
      }

      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      return sortOrder === "newest" ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [incidents, normalizedSearch, severityFilter, sortOrder, statusFilter]);

  const counts = useMemo(() => {
    const resolved = incidents.filter((incident) => incident.status === "resolved").length;
    return {
      total: incidents.length,
      resolved
    };
  }, [incidents]);

  const handleInspectIncident = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedIncident(null);
    }
  }, []);

  const handleCreateIncident = useCallback(
    async (input: CreateIncidentInput): Promise<CreateIncidentResponse> => {
      const response = await createIncidentMutation.mutateAsync(input);
      setComposerOpen(false);
      return response;
    },
    [createIncidentMutation]
  );

  const handleResolveIncident = useCallback(
    (incidentID: string) => {
      resolveIncidentMutation.mutate(incidentID);
    },
    [resolveIncidentMutation]
  );

  const handleSeedIncidents = useCallback(() => {
    seedIncidentsMutation.mutate(Number(seedBatchSize));
  }, [seedBatchSize, seedIncidentsMutation]);

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setSeverityFilter("all");
    setSortOrder("newest");
    setSearchValue("");
  }, []);

  const openComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);

  const scrollToFilters = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById("incident-filters")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, []);

  const hasActiveFilters =
    statusFilter !== "all" ||
    severityFilter !== "all" ||
    sortOrder !== "newest" ||
    searchValue !== "";

  const handleComposerOpenChange = useCallback((open: boolean) => {
    setComposerOpen(open);
  }, []);

  const streamStatus = useMemo(() => {
    if (stream.connectionState === "open") {
      return {
        tone: "low" as const,
        label: "Stream connected",
        detail: "Live updates active"
      };
    }
    if (stream.connectionState === "connecting") {
      return {
        tone: "medium" as const,
        label: "Stream connecting",
        detail: "Attempting to establish SSE session"
      };
    }
    return {
      tone: "critical" as const,
      label: "Stream disconnected",
      detail: "Reconnect pending"
    };
  }, [stream.connectionState]);

  useEffect(() => {
    const handleOpenComposer = () => {
      setComposerOpen(true);
    };

    window.addEventListener(openComposerEventName, handleOpenComposer);
    if (window.sessionStorage.getItem("incindigo_open_composer") === "1") {
      window.sessionStorage.removeItem("incindigo_open_composer");
      queueMicrotask(() => {
        handleOpenComposer();
      });
    }

    return () => {
      window.removeEventListener(openComposerEventName, handleOpenComposer);
    };
  }, []);

  return (
    <section className="space-y-6 pb-24 xl:pb-0">
      <Card className="overflow-hidden border-indigo-300/40 bg-gradient-to-r from-indigo-950/65 via-slate-900 to-slate-900">
        <div className="space-y-3">
          <p className="font-mono text-xs tracking-[0.2em] text-indigo-300 uppercase">
            Realtime Incident Command
          </p>
          <h1 className="font-display text-3xl font-semibold text-slate-50 sm:text-4xl">
            Incident Command Deck
          </h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Keep creation and filtering within reach while scanning large incident volumes. This
            board is optimized for rapid triage, bulk load testing, and historical resolution
            review.
          </p>
        </div>
      </Card>

      <Card className="sticky top-20 z-20 border-slate-700/90 bg-slate-950/95 backdrop-blur-xl xl:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={openComposer}>
            Create
          </Button>
          <Button variant="secondary" size="sm" onClick={scrollToFilters}>
            Filters
          </Button>
          <Badge tone="neutral">{filteredIncidents.length} shown</Badge>
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[5.5rem] xl:self-start 2xl:top-24">
          <Card className="space-y-2.5">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Signal className="size-4" />
              Connection
            </div>

            <div className="flex items-center justify-between gap-2">
              <Badge tone={streamStatus.tone}>{streamStatus.label}</Badge>
              <p className="text-xs text-slate-400">{streamStatus.detail}</p>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-2">
              <p className="text-xs text-slate-500">Last event</p>
              <p className="text-xs text-slate-300">
                {stream.lastEventAt ? new Date(stream.lastEventAt).toLocaleTimeString() : "No events yet"}
              </p>
            </div>
          </Card>

          <Card className="space-y-2.5">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sparkles className="size-4" />
              Demo Data
            </div>
            <p className="text-xs text-slate-500">Seed incidents into the live board.</p>
            <div className="inline-flex w-full items-center gap-2">
              <select
                aria-label="Seed count"
                className="focus:border-brand-300 focus:ring-brand-400/40 h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 text-xs text-slate-100 transition outline-none focus:ring-2"
                value={seedBatchSize}
                onChange={(event) => setSeedBatchSize(event.target.value as SeedBatchSize)}
              >
                <option value="30">30 incidents</option>
                <option value="60">60 incidents</option>
                <option value="120">120 incidents</option>
              </select>
              <Button
                variant="secondary"
                size="sm"
                className="min-w-24 justify-center"
                onClick={handleSeedIncidents}
                disabled={seedIncidentsMutation.isPending}
              >
                <Sparkles className="size-4" />
                {seedIncidentsMutation.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </Card>

          <Card id="incident-filters" className="scroll-mt-24 space-y-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
              <SlidersHorizontal className="size-4" />
              Filters
            </div>
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-200">{filteredIncidents.length}</span> of{" "}
              <span className="font-semibold text-slate-200">{counts.total}</span>
            </p>

            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Search incidents"
                  className="pl-9"
                  placeholder="Search incidents"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
              </div>

              <select
                aria-label="Status filter"
                className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="open">Open only</option>
                <option value="resolved">Resolved only</option>
              </select>

              <select
                aria-label="Severity filter"
                className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
              >
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                aria-label="Sort order"
                className="focus:border-brand-300 focus:ring-brand-400/40 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 transition outline-none focus:ring-2"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="severity">Severity first</option>
              </select>
            </div>

            <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!hasActiveFilters}>
              Reset Filters
            </Button>
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          {isPending ? <IncidentsGridSkeleton /> : null}

          {isError ? (
            <Card className="border-rose-400/40 bg-rose-950/20 text-rose-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4" />
                <div>
                  <p className="text-sm font-semibold">Could not load incidents</p>
                  <p className="text-sm text-rose-200/90">
                    {error instanceof Error ? error.message : "Unknown error"}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {!isPending && !isError ? (
            filteredIncidents.length === 0 ? (
              <Card className="border-dashed text-center">
                <ListChecks className="mx-auto mb-3 size-6 text-slate-400" />
                <p className="mb-3 text-sm text-slate-300">No incidents matched the current filters.</p>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 min-[1700px]:grid-cols-4">
                {filteredIncidents.map((incident) => {
                  return (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      onInspect={handleInspectIncident}
                      onResolve={handleResolveIncident}
                      isResolving={resolveIncidentMutation.isPending}
                    />
                  );
                })}
              </div>
            )
          ) : null}

          {!isPending && !isError && counts.resolved > 0 ? (
            <Card className="border-emerald-400/20 bg-emerald-950/10">
              <p className="inline-flex items-center gap-2 text-sm text-emerald-200">
                <CheckCircle2 className="size-4" />
                Resolved incidents stay queryable and visible in historical filters.
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={isComposerOpen} onOpenChange={handleComposerOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl p-0">
          <div className="flex max-h-[88vh] flex-col">
            <div className="space-y-1 border-b border-slate-800 px-6 py-5">
              <DialogTitle className="font-display text-2xl font-semibold text-slate-50">
                Incident Composer
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                Trigger incidents without leaving the live board.
              </DialogDescription>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <CreateIncidentForm
                onCreate={handleCreateIncident}
                isSubmitting={createIncidentMutation.isPending}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <IncidentDetailDialog incident={selectedIncident} onOpenChange={handleDialogOpenChange} />
    </section>
  );
};

export const IncidentsPage = memo(IncidentsPageComponent);
