import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Wifi, Radio, Unplug, Cloud, Cable, Sparkles, CheckCircle2 } from 'lucide-react';

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
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Standby');
  const [packetCount, setPacketCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);

  // WebSerial API (Connects ESP32 directly via USB in Chrome/Edge on HTTPS)
  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      alert(
        'Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.'
      );
      return;
    }

    try {
      setStatusMessage('Requesting USB Serial port...');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;
      setIsSerialConnected(true);
      setStatusMessage('USB Serial Connected! Reading MPU6050 frames at 115200 baud...');

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith('TELEMETRY_JSON:')) {
              try {
                const jsonStr = clean.replace('TELEMETRY_JSON:', '');
                const parsed = JSON.parse(jsonStr);
                setPacketCount((c) => c + 1);
                if (onDirectTelemetry) {
                  onDirectTelemetry({
                    event_type: 'telemetry',
                    source: 'physical',
                    device_id: parsed.device_id || 'ESP32_PHYSICAL_01',
                    features: parsed.sensors || parsed.features || {},
                    timestamp: new Date().toISOString(),
                  });
                }
              } catch {
                // partial chunk
              }
            }
          }
        }
      }
    } catch (err: any) {
      setIsSerialConnected(false);
      setStatusMessage(err?.name === 'NotFoundError' ? 'USB Port selection cancelled.' : `Serial error: ${err.message}`);
    }
  };

  const disconnectSerial = async () => {
    try {
      if (serialReaderRef.current) {
        await serialReaderRef.current.cancel();
        serialReaderRef.current = null;
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close();
        serialPortRef.current = null;
      }
    } catch (e) {
      console.warn('Error closing serial:', e);
    }
    setIsSerialConnected(false);
    setStatusMessage('USB Serial disconnected.');
  };

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
        setStatusMessage(`Connected directly over Local Wi-Fi (${ip})`);
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
        setStatusMessage(
          `Local ws:// was blocked by the browser on HTTPS or Wi-Fi router. Connect via USB Serial below or let ESP32 send via Wi-Fi to Cloud!`
        );
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
      if (wsRef.current) wsRef.current.close();
      if (serialReaderRef.current) serialReaderRef.current.cancel().catch(() => {});
    };
  }, []);

  const isLiveActive = isConnected || isSerialConnected || isCloudStreaming;

  return (
    <Card className="border border-slate-200/90 shadow-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white select-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold tracking-wide">
                Hardware Live Telemetry Hub
              </h3>
              {isSerialConnected ? (
                <Badge className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Cable className="w-3 h-3 text-emerald-400" /> USB SERIAL ACTIVE (115200 BAUD)
                </Badge>
              ) : isConnected ? (
                <Badge className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DIRECT LOCAL WI-FI (0ms LAG)
                </Badge>
              ) : isCloudStreaming ? (
                <Badge className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Cloud className="w-3 h-3 text-blue-400" /> CLOUD WI-FI ACTIVE (WSS)
                </Badge>
              ) : (
                <Badge className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-slate-700/60 text-slate-300 border border-slate-600">
                  AWAITING HARDWARE PACKETS
                </Badge>
              )}
            </div>

            <p className="text-xs text-slate-300">
              {isLiveActive ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hardware connected and streaming physical telemetry to 3D attitude viewport!
                </span>
              ) : (
                'Choose how you want to connect your ESP32 + MPU6050 + DHT22:'
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Pipeline Status:</span>
              <span
                className={
                  isLiveActive
                    ? 'text-emerald-400 font-medium'
                    : 'text-amber-400'
                }
              >
                {isSerialConnected
                  ? `USB Direct Serial (${packetCount} frames received)`
                  : isConnected
                  ? `Direct Wi-Fi (${packetCount} packets)`
                  : isCloudStreaming
                  ? 'Cloud Ingestion Active (ESP32 Wi-Fi -> Backend -> Website WSS)'
                  : statusMessage}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {/* 1. USB WebSerial Button (1-Click Instant Connection in Browser!) */}
            {isSerialConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={disconnectSerial}
                className="h-8 text-xs font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                <Unplug className="w-3.5 h-3.5 mr-1.5" />
                Unpair USB
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={connectSerial}
                className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5"
                title="Connect ESP32 directly via USB in Chrome/Edge with 1 click"
              >
                <Cable className="w-3.5 h-3.5" />
                <Sparkles className="w-3 h-3 text-emerald-200" />
                Connect via USB Serial
              </Button>
            )}

            {/* 2. Direct Wi-Fi IP button */}
            {isConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={disconnectEsp32}
                className="h-8 text-xs font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                <Unplug className="w-3.5 h-3.5 mr-1.5" />
                Unpair Wi-Fi
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => connectToEsp32()}
                disabled={isConnecting}
                className="h-8 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 shadow-sm"
              >
                <Radio className="w-3.5 h-3.5 mr-1.5" />
                Pair Local Wi-Fi
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
