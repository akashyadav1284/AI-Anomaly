import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Wifi, Radio, Unplug, RefreshCw, Globe, X, Check, ArrowRight } from 'lucide-react';

export function normalizePhysicalData(raw: any) {
  if (!raw) return {};
  const src = raw.sensors || raw.features || raw;

  // Accel X (support accel_x, x, ax, accelX, a_x)
  const rawAx = src.accel_x ?? src.x ?? src.ax ?? src.accelX ?? src.a_x;
  const ax = rawAx !== undefined && rawAx !== null && !isNaN(Number(rawAx)) ? Number(rawAx) : undefined;

  // Accel Y (support accel_y, y, ay, accelY, a_y)
  const rawAy = src.accel_y ?? src.y ?? src.ay ?? src.accelY ?? src.a_y;
  const ay = rawAy !== undefined && rawAy !== null && !isNaN(Number(rawAy)) ? Number(rawAy) : undefined;

  // Accel Z (support accel_z, z, az, accelZ, a_z)
  const rawAz = src.accel_z ?? src.z ?? src.az ?? src.accelZ ?? src.a_z;
  const az = rawAz !== undefined && rawAz !== null && !isNaN(Number(rawAz)) ? Number(rawAz) : undefined;

  // Gyro X
  const rawGx = src.gyro_x ?? src.gx ?? src.gyroX ?? src.g_x;
  const gx = rawGx !== undefined && rawGx !== null && !isNaN(Number(rawGx)) ? Number(rawGx) : 0;

  // Gyro Y
  const rawGy = src.gyro_y ?? src.gy ?? src.gyroY ?? src.g_y;
  const gy = rawGy !== undefined && rawGy !== null && !isNaN(Number(rawGy)) ? Number(rawGy) : 0;

  // Gyro Z
  const rawGz = src.gyro_z ?? src.gz ?? src.gyroZ ?? src.g_z;
  const gz = rawGz !== undefined && rawGz !== null && !isNaN(Number(rawGz)) ? Number(rawGz) : 0;

  // Temperature
  const rawTemp = src.temperature ?? src.temp ?? src.t ?? src.temp_c;
  const temp = rawTemp !== undefined && rawTemp !== null && !isNaN(Number(rawTemp)) ? Number(rawTemp) : undefined;

  // Humidity
  const rawHum = src.humidity ?? src.hum ?? src.h ?? src.humidity_percent;
  const hum = rawHum !== undefined && rawHum !== null && !isNaN(Number(rawHum)) ? Number(rawHum) : undefined;

  // Acceleration Magnitude
  let mag = src.acceleration_magnitude ?? src.mag;
  if (mag === undefined && ax !== undefined && ay !== undefined && az !== undefined) {
    mag = Math.sqrt(ax * ax + ay * ay + az * az);
  }

  // Vibration RMS
  let vib = src.vibration_rms ?? src.vibration ?? src.vib;
  if (vib === undefined && mag !== undefined) {
    vib = Math.abs(mag - 9.80665);
  }

  return {
    accel_x: ax,
    accel_y: ay,
    accel_z: az,
    gyro_x: gx,
    gyro_y: gy,
    gyro_z: gz,
    temperature: temp,
    humidity: hum,
    acceleration_magnitude: mag !== undefined ? Number(Number(mag).toFixed(3)) : undefined,
    vibration_rms: vib !== undefined ? Number(Number(vib).toFixed(4)) : undefined,
  };
}

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
    return localStorage.getItem('esp32_direct_ip') || '10.164.5.169';
  });
  const [inputIp, setInputIp] = useState<string>(() => {
    return localStorage.getItem('esp32_direct_ip') || '10.164.5.169';
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Standby — enter ESP32 Wi-Fi IP and click Connect');
  const [packetCount, setPacketCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const failCountRef = useRef<number>(0);

  const connectToEsp32 = async (ipToUse?: string) => {
    let targetIp = (ipToUse || inputIp || espIp).trim();
    if (!targetIp) {
      setStatusMessage('Please enter a valid ESP32 Wi-Fi IP address.');
      return;
    }

    // Clean IP string (remove any accidental http:// or trailing slashes)
    targetIp = targetIp.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();

    setIsConnecting(true);
    setStatusMessage(`Connecting to http://${targetIp}/data...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`http://${targetIp}/data`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`ESP32 returned HTTP status ${res.status}`);
      }

      const initialData = await res.json();
      localStorage.setItem('esp32_direct_ip', targetIp);
      setEspIp(targetIp);
      setInputIp(targetIp);
      setIsConnected(true);
      setIsConnecting(false);
      failCountRef.current = 0;
      setPacketCount((c) => c + 1);
      setLastPacketTime(new Date().toLocaleTimeString());
      setStatusMessage(`Connected & Streaming live from http://${targetIp}/data`);

      if (onIpChanged) onIpChanged(targetIp);
      if (onDirectTelemetry) {
        const normalized = normalizePhysicalData(initialData);
        onDirectTelemetry({
          event_type: 'telemetry',
          source: 'physical',
          device_id: initialData.device_id || `ESP32_${targetIp.replace(/\./g, '_')}`,
          features: normalized,
          timestamp: new Date().toISOString(),
        });
      }

      startPolling(targetIp);
    } catch (err: any) {
      setIsConnecting(false);
      setIsConnected(false);
      const isMixedContent =
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        (err.name === 'TypeError' || err.message?.includes('Failed to fetch'));

      if (isMixedContent) {
        setStatusMessage(
          `Browser mixed-content warning: On HTTPS websites, browsers restrict local HTTP. Click 'Site Settings' -> 'Insecure Content' -> 'Allow' or open via http://`
        );
      } else {
        setStatusMessage(`Connection failed to ${targetIp}: ${err.message || 'ESP32 unreachable'}. Ensure device is powered on same hotspot.`);
      }
    }
  };

  const startPolling = (targetIp: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Stream live readings every 80ms (12.5 Hz high-speed motion tracking)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);

        const res = await fetch(`http://${targetIp}/data`, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          failCountRef.current = 0;
          setPacketCount((c) => c + 1);
          setLastPacketTime(new Date().toLocaleTimeString());
          setIsConnected(true);

          if (onDirectTelemetry) {
            const normalized = normalizePhysicalData(data);
            onDirectTelemetry({
              event_type: 'telemetry',
              source: 'physical',
              device_id: data.device_id || `ESP32_${targetIp.replace(/\./g, '_')}`,
              features: normalized,
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
          setStatusMessage(`Lost connection to http://${targetIp}/data. Retrying...`);
        }
      }
    }, 80);
  };

  const disconnectEsp32 = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setStatusMessage('Disconnected cleanly by user.');
  };

  const handleClearIp = () => {
    setInputIp('');
    localStorage.removeItem('esp32_direct_ip');
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
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Left Info & Status */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold tracking-wide">
                Local Network Hub Module
              </h3>
              <Badge
                variant={isConnected ? 'success' : 'outline'}
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 border-slate-700 text-slate-200"
              >
                {isConnected ? 'ONLINE & STREAMING (12.5 HZ)' : 'DISCONNECTED'}
              </Badge>
              {isConnected && (
                <span className="text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" /> {espIp}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Connect your ESP32 + MPU6050 directly over your 2.4 GHz hotspot to stream real-time motion and environmental telemetry.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-slate-300">
              <span className="text-slate-400 font-sans">Status:</span>
              <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                {isConnected
                  ? `🟢 Streaming active from http://${espIp}/data`
                  : statusMessage}
              </span>
              {isConnected && (
                <span className="text-slate-400">
                  | Packets: <span className="text-emerald-300 font-semibold">{packetCount}</span> (Last: {lastPacketTime})
                </span>
              )}
            </div>
          </div>

          {/* Right: Dedicated ESP32 IP Entry Bar & Actions */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* IP Address Input Bar */}
            <div className="relative flex items-center">
              <div className="absolute left-2.5 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                placeholder="Enter ESP32 IP (e.g. 192.168.43.100)"
                value={inputIp}
                onChange={(e) => setInputIp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isConnecting && !isConnected) {
                    connectToEsp32(inputIp);
                  }
                }}
                disabled={isConnected || isConnecting}
                className={`h-9 pl-8 pr-7 text-xs font-mono rounded-lg border transition-all w-full sm:w-64 focus:outline-none ${
                  isConnected
                    ? 'bg-slate-950/80 border-emerald-500/50 text-emerald-300 font-semibold cursor-not-allowed'
                    : 'bg-slate-950/90 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                }`}
              />
              {inputIp && !isConnected && !isConnecting && (
                <button
                  type="button"
                  onClick={handleClearIp}
                  className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                  title="Clear IP"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Connect / Disconnect Buttons */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={disconnectEsp32}
                  className="h-9 text-xs font-medium bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectToEsp32(inputIp)}
                  disabled={isConnecting || !inputIp.trim()}
                  className="h-9 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Radio className="w-3.5 h-3.5" />
                      Connect via WiFi
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
