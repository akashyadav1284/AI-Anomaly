import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Wifi, Radio, Unplug } from 'lucide-react';

interface LocalNetworkHubModuleProps {
  onDirectTelemetry?: (data: any) => void;
}

export function LocalNetworkHubModule({ onDirectTelemetry }: LocalNetworkHubModuleProps) {
  const [espIp, setEspIp] = useState<string>(() => {
    return localStorage.getItem('esp32_direct_ip') || '';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Disconnected');
  const [lastPacketTime, setLastPacketTime] = useState<string | null>(null);
  const [packetCount, setPacketCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);

  const connectToEsp32 = (ipToConnect?: string) => {
    let ip = ipToConnect || espIp;
    if (!ip) {
      const promptIp = window.prompt(
        'Enter the ESP32 WiFi IP Address printed on the Serial Monitor or OLED screen:',
        '192.168.'
      );
      if (!promptIp) return;
      ip = promptIp.trim();
      setEspIp(ip);
    }

    localStorage.setItem('esp32_direct_ip', ip);
    setIsConnecting(true);
    setStatusMessage(`Connecting to ws://${ip}:81...`);

    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(`ws://${ip}:81`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setStatusMessage(`Connected & Streaming over Local WiFi Server (${ip})`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastPacketTime(new Date().toLocaleTimeString());
          setPacketCount((c) => c + 1);
          if (onDirectTelemetry) {
            onDirectTelemetry(data);
          }
        } catch {
          // ignore non-json heartbeats
        }
      };

      ws.onerror = () => {
        setIsConnecting(false);
        setStatusMessage(`Connection failed to ws://${ip}:81. Ensure you are on the same WiFi network.`);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusMessage('Disconnected from ESP32');
      };
    } catch {
      setIsConnecting(false);
      setStatusMessage('WebSocket initialization failed');
    }
  };

  const disconnectEsp32 = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setStatusMessage('Disconnected');
  };

  useEffect(() => {
    // If an IP was previously stored and valid, connect automatically
    if (espIp && espIp.includes('.')) {
      connectToEsp32(espIp);
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <Card className="border border-slate-200/90 shadow-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white select-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-sm font-semibold tracking-wide">
                Local Network Hub Module
              </h3>
              <Badge
                variant={isConnected ? 'success' : 'outline'}
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 border-slate-700 text-slate-200"
              >
                {isConnected ? 'ONLINE (0ms LAG)' : 'DISCONNECTED'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Connect your ESP32 + MPU6050 directly over your WiFi network router to stream data safely.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Status:</span>
              <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-slate-300'}>
                {statusMessage}
              </span>
              {isConnected && (
                <span className="text-slate-400">
                  | Packets: <span className="text-emerald-300 font-semibold">{packetCount}</span> (Last: {lastPacketTime})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {isConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={disconnectEsp32}
                className="h-8 text-xs font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                <Unplug className="w-3.5 h-3.5 mr-1.5" />
                Unpair Device
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => connectToEsp32()}
                disabled={isConnecting}
                className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              >
                <Radio className="w-3.5 h-3.5 mr-1.5" />
                {isConnecting ? 'Connecting...' : 'Connect via WiFi'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
