import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Wifi, Radio, Unplug, RefreshCw } from 'lucide-react';

interface LocalNetworkHubModuleProps {
  onDirectTelemetry?: (data: any) => void;
  onIpChanged?: (ip: string) => void;
  isCloudStreaming?: boolean;
}

export function LocalNetworkHubModule({
  onDirectTelemetry,
  onIpChanged,
}: LocalNetworkHubModuleProps) {
  const [espIp, setEspIp] = useState<string>(() => {
    return localStorage.getItem('esp32_direct_ip') || '';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Disconnected');
  const [packetCount, setPacketCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const failCountRef = useRef<number>(0);

  const connectToEsp32 = async (ipToUse?: string) => {
    let ip = (ipToUse || espIp).trim();
    if (!ip) {
      const promptIp = window.prompt(
        'Enter the ESP32 WiFi IP Address printed on the OLED screen or Serial Monitor:',
        '192.168.43.100'
      );
      if (!promptIp) return;
      ip = promptIp.trim();
      setEspIp(ip);
    }

    setIsConnecting(true);
    setStatusMessage(`Connecting to http://${ip}/data...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`http://${ip}/data`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`ESP32 returned HTTP status ${res.status}`);
      }

      const initialData = await res.json();
      localStorage.setItem('esp32_direct_ip', ip);
      setEspIp(ip);
      setIsConnected(true);
      setIsConnecting(false);
      failCountRef.current = 0;
      setPacketCount((c) => c + 1);
      setLastPacketTime(new Date().toLocaleTimeString());
      setStatusMessage(`Connected & Streaming live from http://${ip}/data`);

      if (onIpChanged) onIpChanged(ip);
      if (onDirectTelemetry) {
        onDirectTelemetry({
          event_type: 'telemetry',
          source: 'physical',
          device_id: initialData.device_id || 'ESP32_PHYSICAL_01',
          features: initialData.sensors || initialData,
          timestamp: new Date().toISOString(),
        });
      }

      startPolling(ip);
    } catch (err: any) {
      setIsConnecting(false);
      setIsConnected(false);
      const isMixedContent =
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        (err.name === 'TypeError' || err.message?.includes('Failed to fetch'));

      if (isMixedContent) {
        setStatusMessage(
          `Browser mixed-content warning: On HTTPS websites, browsers restrict local HTTP. Click 'Allow Insecure Content' in browser site settings or open via http://`
        );
      } else {
        setStatusMessage(`Connection failed: ${err.message || 'ESP32 unreachable'}. Ensure your device is on the same hotspot.`);
      }
    }
  };

  const startPolling = (ip: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Stream live readings every 100ms (10 Hz high-speed motion tracking)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(`http://${ip}/data`, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          failCountRef.current = 0;
          setPacketCount((c) => c + 1);
          setLastPacketTime(new Date().toLocaleTimeString());
          setIsConnected(true);

          if (onDirectTelemetry) {
            onDirectTelemetry({
              event_type: 'telemetry',
              source: 'physical',
              device_id: data.device_id || 'ESP32_PHYSICAL_01',
              features: data.sensors || data,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          failCountRef.current += 1;
        }
      } catch {
        failCountRef.current += 1;
        if (failCountRef.current >= 15) {
          setIsConnected(false);
          setStatusMessage(`Lost connection to http://${ip}/data. Retrying...`);
        }
      }
    }, 100);
  };

  const disconnectEsp32 = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    localStorage.removeItem('esp32_direct_ip');
    setIsConnected(false);
    setIsConnecting(false);
    setStatusMessage('Disconnected cleanly by user.');
  };

  useEffect(() => {
    const savedIp = localStorage.getItem('esp32_direct_ip');
    if (savedIp && savedIp.includes('.')) {
      connectToEsp32(savedIp);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <Card className="border border-slate-200/90 shadow-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white select-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold tracking-wide">
                Local Network Hub Module
              </h3>
              <Badge
                variant={isConnected ? 'success' : 'outline'}
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 border-slate-700 text-slate-200"
              >
                {isConnected ? 'ONLINE & STREAMING (10 HZ)' : 'DISCONNECTED'}
              </Badge>
            </div>

            <p className="text-xs text-slate-400">
              Connect your ESP32 + MPU6050 directly over your 2.4 GHz hotspot to stream live numbers.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Status:</span>
              <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                {isConnected
                  ? `🟢 Connected & Streaming over Local WiFi Server (${espIp})`
                  : statusMessage}
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
                className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5"
              >
                {isConnecting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Radio className="w-3.5 h-3.5" />
                )}
                {isConnecting ? 'Connecting...' : 'Connect via WiFi'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
