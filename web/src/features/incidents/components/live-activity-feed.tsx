import { Activity, Bot, CheckCircle2, Repeat, Sparkles } from "lucide-react";
import { memo, useMemo, type FC } from "react";
import { Badge } from "@/shared/components/primitives/badge";
import { Card } from "@/shared/components/primitives/card";
import type { TimelineEvent } from "@/features/incidents/schemas/incident-schemas";

type LiveActivityFeedProps = {
  events: TimelineEvent[];
  connectionState?: "connecting" | "open" | "closed";
  lastEventAt?: string | null;
};

const eventTone = (
  eventType: TimelineEvent["event_type"]
): "critical" | "high" | "medium" | "low" => {
  switch (eventType) {
    case "resolved":
    case "auto_resolved":
      return "low";
    case "cancelled":
      return "critical";
    case "deduplicated":
      return "medium";
    case "created":
      return "high";
  }
};

const eventLabel = (eventType: TimelineEvent["event_type"]): string => {
  if (eventType === "created") {
    return "Created";
  }
  if (eventType === "deduplicated") {
    return "Deduplicated";
  }
  if (eventType === "resolved") {
    return "Resolved";
  }
  if (eventType === "cancelled") {
    return "Cancelled";
  }
  return "Auto-resolved";
};

const eventIcon = (eventType: TimelineEvent["event_type"]): FC<{ className?: string }> => {
  if (eventType === "resolved") {
    return CheckCircle2;
  }
  if (eventType === "auto_resolved") {
    return Bot;
  }
  if (eventType === "cancelled") {
    return CheckCircle2;
  }
  if (eventType === "deduplicated") {
    return Repeat;
  }
  return Sparkles;
};

const LiveActivityFeedComponent: FC<LiveActivityFeedProps> = ({
  connectionState = "connecting",
  events,
  lastEventAt = null
}) => {
  const displayEvents = useMemo(() => events.slice(0, 10), [events]);
  const connectionMeta = useMemo(() => {
    if (connectionState === "open") {
      return {
        label: "Stream connected",
        tone: "low" as const
      };
    }

    if (connectionState === "connecting") {
      return {
        label: "Stream connecting",
        tone: "medium" as const
      };
    }

    return {
      label: "Stream disconnected",
      tone: "critical" as const
    };
  }, [connectionState]);

  return (
    <Card className="space-y-3 border-slate-700/90 bg-slate-900/60">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Activity className="size-4" />
          Live Activity
        </p>
        <Badge tone="neutral">{displayEvents.length} recent</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={connectionMeta.tone}>{connectionMeta.label}</Badge>
        <p className="text-xs text-slate-400">
          {lastEventAt
            ? `Last event at ${new Date(lastEventAt).toLocaleTimeString()}`
            : "Waiting for timeline events"}
        </p>
      </div>

      {displayEvents.length === 0 ? (
        <p className="text-sm text-slate-400">
          No stream events yet. Create or resolve incidents to populate this feed.
        </p>
      ) : (
        <div className="space-y-2">
          {displayEvents.map((event, index) => {
            const Icon = eventIcon(event.event_type);
            return (
              <div
                key={`${event.occurred_at}-${event.incident.id}-${index}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {event.incident.summary}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {event.incident.source} | {event.incident.event_type}
                  </p>
                </div>
                <div className="inline-flex flex-col items-end gap-1">
                  <Badge tone={eventTone(event.event_type)}>
                    <span className="inline-flex items-center gap-1">
                      <Icon className="size-3.5" />
                      {eventLabel(event.event_type)}
                    </span>
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {new Date(event.occurred_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const LiveActivityFeed = memo(LiveActivityFeedComponent);
