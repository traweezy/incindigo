import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Search,
  Signal,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { memo, useCallback, useMemo, useState, type FC } from "react";
import { toast } from "sonner";
import { useAuthSession } from "@/features/auth/lib/auth-session";
import { IncidentCard } from "@/features/incidents/components/incident-card";
import { IncidentDetailDialog } from "@/features/incidents/components/incident-detail-dialog";
import { IncidentsGridSkeleton } from "@/features/incidents/components/incidents-grid-skeleton";
import { useCancelIncident } from "@/features/incidents/hooks/use-cancel-incident";
import { useIncidentStream } from "@/features/incidents/hooks/use-incident-stream";
import { useIncidentsQuery } from "@/features/incidents/hooks/use-incidents-query";
import { useResolveIncident } from "@/features/incidents/hooks/use-resolve-incident";
import { useSeedIncidents } from "@/features/incidents/hooks/use-seed-incidents";
import type {
  Incident,
  IncidentSeverity
} from "@/features/incidents/schemas/incident-schemas";
import { runbookMatchesIncident } from "@/features/runbooks/lib/runbook-match";
import { useRunbooksQuery } from "@/features/runbooks/hooks/use-runbooks-query";
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
import { TextArea } from "@/shared/components/primitives/textarea";

type StatusFilter = "all" | "open" | "resolved" | "cancelled";
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
  const runbooksQuery = useRunbooksQuery();
  const authSession = useAuthSession();
  const resolveIncidentMutation = useResolveIncident();
  const cancelIncidentMutation = useCancelIncident();
  const seedIncidentsMutation = useSeedIncidents();
  const stream = useIncidentStream();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchValue, setSearchValue] = useState("");
  const [seedBatchSize, setSeedBatchSize] = useState<SeedBatchSize>("60");
  const [incidentToCancel, setIncidentToCancel] = useState<Incident | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const incidents = useMemo(() => data ?? [], [data]);
  const runbooks = useMemo(() => runbooksQuery.data ?? [], [runbooksQuery.data]);
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
    const cancelled = incidents.filter((incident) => incident.status === "cancelled").length;
    return {
      total: incidents.length,
      resolved,
      cancelled
    };
  }, [incidents]);

  const runbookMatchesByIncident = useMemo(() => {
    const map = new Map<string, typeof runbooks>();
    for (const incident of incidents) {
      const matches = runbooks.filter((runbook) => runbookMatchesIncident(runbook, incident));
      map.set(incident.id, matches);
    }
    return map;
  }, [incidents, runbooks]);

  const handleInspectIncident = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedIncident(null);
    }
  }, []);

  const handleResolveIncident = useCallback(
    (incidentID: string) => {
      resolveIncidentMutation.mutate(incidentID);
    },
    [resolveIncidentMutation]
  );

  const handleCancelIncident = useCallback(
    (incidentID: string) => {
      const incident = incidents.find((item) => item.id === incidentID);
      if (!incident) {
        toast.error("Unable to locate incident");
        return;
      }
      setIncidentToCancel(incident);
      setCancelReason("False positive");
    },
    [incidents]
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
    window.dispatchEvent(new Event(openComposerEventName));
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

  const handleCancelDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setIncidentToCancel(null);
      setCancelReason("");
    }
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!incidentToCancel) {
      return;
    }

    const normalizedReason = cancelReason.trim();
    if (normalizedReason.length < 3) {
      toast.error("Cancellation reason must be at least 3 characters.");
      return;
    }

    try {
      await cancelIncidentMutation.mutateAsync({
        incidentID: incidentToCancel.id,
        reason: normalizedReason,
        cancelledBy: authSession?.email ?? "operator@incindigo.dev"
      });
      setIncidentToCancel(null);
      setCancelReason("");
    } catch {
      // handled by mutation onError
    }
  }, [authSession, cancelIncidentMutation, cancelReason, incidentToCancel]);

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

  const selectedIncidentRunbooks = useMemo(() => {
    if (!selectedIncident) {
      return [];
    }
    return runbookMatchesByIncident.get(selectedIncident.id) ?? [];
  }, [runbookMatchesByIncident, selectedIncident]);

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
                <option value="cancelled">Cancelled only</option>
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
                      onCancel={handleCancelIncident}
                      isResolving={
                        resolveIncidentMutation.isPending &&
                        resolveIncidentMutation.variables === incident.id
                      }
                      isCancelling={
                        cancelIncidentMutation.isPending &&
                        cancelIncidentMutation.variables.incidentID === incident.id
                      }
                      runbookMatchCount={runbookMatchesByIncident.get(incident.id)?.length ?? 0}
                    />
                  );
                })}
              </div>
            )
          ) : null}

          {!isPending && !isError && (counts.resolved > 0 || counts.cancelled > 0) ? (
            <Card className="border-emerald-400/20 bg-emerald-950/10">
              <p className="inline-flex items-center gap-2 text-sm text-emerald-200">
                <CheckCircle2 className="size-4" />
                Closed incidents (resolved/cancelled) stay queryable and visible in historical filters.
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      <IncidentDetailDialog
        incident={selectedIncident}
        matchedRunbooks={selectedIncidentRunbooks}
        onOpenChange={handleDialogOpenChange}
      />

      <Dialog open={Boolean(incidentToCancel)} onOpenChange={handleCancelDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="space-y-4">
            <DialogTitle className="font-display text-xl font-semibold text-slate-100">
              Cancel Incident
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-300">
              Mark this incident as cancelled for false positives or invalid alerts.
            </DialogDescription>

            {incidentToCancel ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-300">
                <p className="font-semibold text-slate-100">{incidentToCancel.summary}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {incidentToCancel.source} • {incidentToCancel.event_type}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-200">Cancellation reason</p>
              <TextArea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="False positive, duplicate alert, invalid monitor..."
              />
              <p className="text-xs text-slate-500">Minimum 3 characters.</p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => handleCancelDialogOpenChange(false)}>
                Keep Open
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void handleConfirmCancel();
                }}
                disabled={cancelIncidentMutation.isPending || cancelReason.trim().length < 3}
              >
                {cancelIncidentMutation.isPending ? "Cancelling..." : "Cancel Incident"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export const IncidentsPage = memo(IncidentsPageComponent);
