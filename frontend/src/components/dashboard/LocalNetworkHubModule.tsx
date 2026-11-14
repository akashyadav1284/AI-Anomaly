import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Wifi, Radio, Unplug, Cloud, HelpCircle } from 'lucide-react';

interface LocalNetworkHubModuleProps {
  onDirectTelemetry?: (data: any) => void;
  isCloudStreaming?: boolean;
}

export function LocalNetworkHubModule({
  onDirectTelemetry,
  isCloudStreaming = false,
}: LocalNetworkHubModuleProps) {
  const [espIp, setEspIp] = useState<string>(() => {
    return localStorage.getItem('esp32_direct_ip') || '';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Standby');
  const [packetCount, setPacketCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  const connectToEsp32 = (ipToConnect?: string) => {
    let ip = ipToConnect || espIp;
    if (!ip) {
      const promptIp = window.prompt(
        'Enter the ESP32 WiFi IP Address printed on the Serial Monitor or OLED screen:',
        '10.164.5.169'
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
        setStatusMessage(`Connected & Streaming directly over Local Wi-Fi (${ip})`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setPacketCount((c) => c + 1);
          if (onDirectTelemetry) {
            onDirectTelemetry(data);
          }
        } catch {
          // ignore non-json
        }
      };

      ws.onerror = () => {
        setIsConnecting(false);
        if (isHttps) {
          setStatusMessage(
            `Browser blocked direct ws:// on HTTPS (Mixed Content policy). Use Cloud Ingestion or test via http://localhost.`
          );
        } else {
          setStatusMessage(
            `Unable to reach ws://${ip}:81. Ensure PC and ESP32 are on the exact same Wi-Fi subnet.`
          );
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    } catch (e: any) {
      setIsConnecting(false);
      setStatusMessage(`Connection error: ${e.message || 'Mixed Content / Security blocked'}`);
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
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold tracking-wide">
                Hardware Wi-Fi Telemetry Hub
              </h3>
              {isConnected ? (
                <Badge className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DIRECT LOCAL (0ms LAG)
                </Badge>
              ) : isCloudStreaming ? (
                <Badge className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Cloud className="w-3 h-3" /> CLOUD STREAMING ACTIVE
                </Badge>
              ) : (
                <Badge className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-slate-700/60 text-slate-300 border border-slate-600">
                  AWAITING HARDWARE PACKETS
                </Badge>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Your physical ESP32 streams MPU6050 & DHT22 telemetry over Wi-Fi. It publishes directly to your secure cloud backend over HTTPS, which live-broadcasts to this dashboard via Secure WebSockets (WSS).
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Pipeline Status:</span>
              <span
                className={
                  isConnected || isCloudStreaming
                    ? 'text-emerald-400 font-medium'
                    : 'text-amber-400'
                }
              >
                {isConnected
                  ? `Direct Wi-Fi (${packetCount} packets)`
                  : isCloudStreaming
                  ? 'Cloud Ingestion Active (MongoDB + Live WSS)'
                  : statusMessage}
              </span>
            </div>

            {isHttps && !isConnected && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-800/80 p-1.5 rounded border border-slate-700/60 mt-1">
                <HelpCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span>
                  On HTTPS domains (Vercel), browsers block unencrypted <code className="text-slate-300 font-mono">ws://</code>. Flash the updated firmware so ESP32 posts to your Cloud Backend, which feeds this website seamlessly!
                </span>
              </div>
            )}
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
                Unpair Direct
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => connectToEsp32()}
                disabled={isConnecting}
                className="h-8 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 shadow-sm"
              >
                <Radio className="w-3.5 h-3.5 mr-1.5" />
                {isConnecting ? 'Connecting...' : 'Pair Local Wi-Fi IP'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
