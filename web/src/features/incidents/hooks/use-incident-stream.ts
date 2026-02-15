import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getIncidentEventSourceURL,
  incidentQueryKey,
  parseTimelineEvent
} from "@/features/incidents/api/incidents-api";
import { upsertIncident } from "@/features/incidents/lib/incidents";
import type { Incident, TimelineEvent } from "@/features/incidents/schemas/incident-schemas";

type UseIncidentStreamOptions = {
  onEvent?: (event: TimelineEvent) => void;
};

type StreamConnectionState = "connecting" | "open" | "closed";

export const useIncidentStream = (options: UseIncidentStreamOptions = {}) => {
  const queryClient = useQueryClient();
  const { onEvent } = options;
  const [connectionState, setConnectionState] = useState<StreamConnectionState>("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const onEventRef = useRef<UseIncidentStreamOptions["onEvent"]>(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;
    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      setConnectionState("connecting");
      const source = new EventSource(getIncidentEventSourceURL());
      eventSource = source;

      const handleOpen = () => {
        reconnectAttempts = 0;
        setConnectionState("open");
      };

      const handleError = () => {
        if (disposed) {
          return;
        }

        setConnectionState("connecting");

        if (source.readyState !== EventSource.CLOSED) {
          return;
        }

        source.close();
        reconnectAttempts += 1;
        const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 4), 12_000);
        clearReconnectTimer();
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, delay);
      };

      const handleTimeline = (event: MessageEvent<string>) => {
        const parsed = parseTimelineEvent(event.data);
        if (!parsed) {
          return;
        }

        setLastEventAt(parsed.occurred_at);
        onEventRef.current?.(parsed);

        queryClient.setQueryData<Incident[]>(incidentQueryKey, (current = []) => {
          return upsertIncident(current, parsed.incident);
        });
      };

      source.addEventListener("open", handleOpen as EventListener);
      source.addEventListener("error", handleError as EventListener);
      source.addEventListener("timeline", handleTimeline as EventListener);
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      if (eventSource) {
        eventSource.close();
      }
      setConnectionState("closed");
    };
  }, [queryClient]);

  return {
    connectionState,
    isConnected: connectionState === "open",
    lastEventAt
  };
};
