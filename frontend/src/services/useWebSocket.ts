import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import { WsSimulatorMessage, WsTelemetryEvent, WsAnomalyAlertEvent } from '../types/api';

export interface UseWebSocketReturn {
  isConnected: boolean;
  telemetryStream: WsTelemetryEvent[];
  anomalyAlerts: WsAnomalyAlertEvent[];
  latestTelemetry: WsTelemetryEvent | null;
  latestAnomaly: WsAnomalyAlertEvent | null;
  connectionError: string | null;
  clearAlerts: () => void;
  reconnect: () => void;
}

export function useSimulatorWebSocket(maxBuffer: number = 60): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [telemetryStream, setTelemetryStream] = useState<WsTelemetryEvent[]>([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState<WsAnomalyAlertEvent[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<WsTelemetryEvent | null>(null);
  const [latestAnomaly, setLatestAnomaly] = useState<WsAnomalyAlertEvent | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const clearAlerts = useCallback(() => {
    setAnomalyAlerts([]);
    setLatestAnomaly(null);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const url = apiService.getWsTelemetryUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const msg = JSON.parse(event.data) as WsSimulatorMessage;
          if (msg.event_type === 'telemetry') {
            setLatestTelemetry(msg);
            setTelemetryStream((prev) => {
              const next = [...prev, msg];
              return next.length > maxBuffer ? next.slice(-maxBuffer) : next;
            });
          } else if (msg.event_type === 'anomaly_alert') {
            setLatestAnomaly(msg);
            setAnomalyAlerts((prev) => [msg, ...prev.slice(0, 19)]);
          }
        } catch {
          // ignore non-json or malformed
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setConnectionError('WebSocket stream connection failed.');
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        // Automatic reconnect attempt after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            if (isMountedRef.current) connect();
          }, 3000);
        }
      };
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'WebSocket initialization failed');
    }
  }, [maxBuffer]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    telemetryStream,
    anomalyAlerts,
    latestTelemetry,
    latestAnomaly,
    connectionError,
    clearAlerts,
    reconnect: connect,
  };
}
