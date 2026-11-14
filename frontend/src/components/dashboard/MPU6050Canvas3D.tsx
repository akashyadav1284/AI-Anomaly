import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  RotateCcw,
  Pause,
  Play,
} from 'lucide-react';

export interface MPU6050Telemetry {
  accel_x: number; // m/s²
  accel_y: number; // m/s²
  accel_z: number; // m/s²
  gyro_x: number;  // deg/s
  gyro_y: number;  // deg/s
  gyro_z: number;  // deg/s
  accel_magnitude?: number;
  vibration_rms?: number;
  timestamp?: string;
}

interface MPU6050Canvas3DProps {
  telemetry: MPU6050Telemetry | null;
  isStreaming?: boolean;
}

export function MPU6050Canvas3D({ telemetry, isStreaming = false }: MPU6050Canvas3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'fusion' | 'accel' | 'gyro'>('fusion');
  const [isPaused, setIsPaused] = useState(false);
  const [displayAngles, setDisplayAngles] = useState({ pitch: 0, roll: 0, yaw: 0 });
  const smoothingSpeed = 0.25;

  // Orientation state estimates (radians)
  const orientationRef = useRef<{ pitch: number; roll: number; yaw: number }>({
    pitch: 0,
    roll: 0,
    yaw: 0,
  });

  const lastTimeRef = useRef<number>(Date.now());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sensorGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);

  // Mouse drag Orbit control state
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 4, radius: 6.5 });

  // Update Complementary Filter sensor fusion
  useEffect(() => {
    if (!telemetry || isPaused) return;

    const now = Date.now();
    const dt = Math.max(0.001, (now - lastTimeRef.current) / 1000.0);
    lastTimeRef.current = now;

    // Convert raw accel to pitch/roll angles (radians)
    const ax = telemetry.accel_x ?? 0;
    const ay = telemetry.accel_y ?? 0;
    const az = telemetry.accel_z ?? 9.81;

    // Pitch (around X axis) & Roll (around Y axis) from accelerometer
    const accelPitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az));
    const accelRoll = Math.atan2(ay, az);

    // Gyroscope angular velocities (deg/s -> rad/s)
    const gx = ((telemetry.gyro_x ?? 0) * Math.PI) / 180.0;
    const gy = ((telemetry.gyro_y ?? 0) * Math.PI) / 180.0;
    const gz = ((telemetry.gyro_z ?? 0) * Math.PI) / 180.0;

    const hasActiveGyro = Math.abs(gx) > 0.001 || Math.abs(gy) > 0.001 || Math.abs(gz) > 0.001;

    if (viewMode === 'accel' || !hasActiveGyro) {
      // Direct accelerometer attitude tracking (immediate 1-to-1 tilt response)
      orientationRef.current.pitch = accelPitch;
      orientationRef.current.roll = accelRoll;
    } else if (viewMode === 'gyro') {
      orientationRef.current.pitch += gx * dt;
      orientationRef.current.roll += gy * dt;
      orientationRef.current.yaw += gz * dt;
    } else {
      // Complementary filter
      const alpha = 0.88;
      orientationRef.current.pitch =
        alpha * (orientationRef.current.pitch + gy * dt) + (1.0 - alpha) * accelPitch;
      orientationRef.current.roll =
        alpha * (orientationRef.current.roll + gx * dt) + (1.0 - alpha) * accelRoll;
      orientationRef.current.yaw += gz * dt;
    }

    // Update state for live UI degree readout
    setDisplayAngles({
      pitch: Number(((orientationRef.current.pitch * 180) / Math.PI).toFixed(1)),
      roll: Number(((orientationRef.current.roll * 180) / Math.PI).toFixed(1)),
      yaw: Number(((orientationRef.current.yaw * 180) / Math.PI).toFixed(1)),
    });
  }, [telemetry, viewMode, isPaused]);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 380;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 0.8, 10);
    pointLight.position.set(-4, 3, 2);
    scene.add(pointLight);

    // 5. Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x94a3b8, 0xe2e8f0);
    grid.position.y = -1.8;
    scene.add(grid);

    // 6. Coordinate Axes
    const axesGroup = new THREE.Group();
    // X - Red
    const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 2.2, 0xef4444, 0.3, 0.15);
    // Y - Green
    const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 2.2, 0x10b981, 0.3, 0.15);
    // Z - Blue
    const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 2.2, 0x3b82f6, 0.3, 0.15);
    axesGroup.add(arrowX, arrowY, arrowZ);
    scene.add(axesGroup);

    // 7. MPU6050 Sensor Board Model (PCB)
    const sensorGroup = new THREE.Group();

    // PCB Main Board (Blue FR4 PCB)
    const pcbGeo = new THREE.BoxGeometry(2.6, 0.15, 3.4);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // Navy / Royal Blue
      roughness: 0.3,
      metalness: 0.2,
    });
    const pcb = new THREE.Mesh(pcbGeo, pcbMat);
    pcb.castShadow = true;
    pcb.receiveShadow = true;
    sensorGroup.add(pcb);

    // MPU6050 QFN IC Chip (Central dark grey chip)
    const chipGeo = new THREE.BoxGeometry(0.9, 0.12, 0.9);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // Matte Black
      roughness: 0.2,
      metalness: 0.6,
    });
    const chip = new THREE.Mesh(chipGeo, chipMat);
    chip.position.set(0, 0.12, 0);
    sensorGroup.add(chip);

    // Gold Pin Headers (8 pins on side)
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    for (let i = -3.5; i <= 3.5; i += 1) {
      const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(-1.15, 0.15, (i * 0.35));
      sensorGroup.add(pin);
    }

    // Power Indicator LED (Red SMD diode)
    const ledGeo = new THREE.BoxGeometry(0.15, 0.08, 0.15);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.9,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0.9, 0.1, -1.2);
    sensorGroup.add(led);

    // Surface Mount Decoupling Capacitors
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
    const cap1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.12), capMat);
    cap1.position.set(0.65, 0.1, 0.4);
    sensorGroup.add(cap1);

    scene.add(sensorGroup);
    sensorGroupRef.current = sensorGroup;

    // Animation Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (sensorGroupRef.current) {
        // Smoothly interpolate rotation toward orientation estimate
        const targetPitch = orientationRef.current.pitch;
        const targetRoll = orientationRef.current.roll;
        const targetYaw = orientationRef.current.yaw;

        sensorGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          sensorGroupRef.current.rotation.x,
          targetPitch,
          smoothingSpeed
        );
        sensorGroupRef.current.rotation.z = THREE.MathUtils.lerp(
          sensorGroupRef.current.rotation.z,
          targetRoll,
          smoothingSpeed
        );
        sensorGroupRef.current.rotation.y = THREE.MathUtils.lerp(
          sensorGroupRef.current.rotation.y,
          targetYaw,
          smoothingSpeed
        );
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 380;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  function updateCameraPosition() {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraAngleRef.current;
    cameraRef.current.position.x = radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = radius * Math.cos(phi);
    cameraRef.current.position.z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(0, 0, 0);
  }

  // Mouse Interaction handlers for Orbiting
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    cameraAngleRef.current.theta -= deltaX * 0.008;
    cameraAngleRef.current.phi = Math.max(
      0.1,
      Math.min(Math.PI / 2 - 0.05, cameraAngleRef.current.phi - deltaY * 0.008)
    );
    updateCameraPosition();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    cameraAngleRef.current.radius = Math.max(
      3.5,
      Math.min(12.0, cameraAngleRef.current.radius + e.deltaY * 0.005)
    );
    updateCameraPosition();
  };

  const handleResetOrientation = () => {
    orientationRef.current = { pitch: 0, roll: 0, yaw: 0 };
    if (sensorGroupRef.current) {
      sensorGroupRef.current.rotation.set(0, 0, 0);
    }
    cameraAngleRef.current = { theta: Math.PI / 4, phi: Math.PI / 4, radius: 6.5 };
    setDisplayAngles({ pitch: 0, roll: 0, yaw: 0 });
    updateCameraPosition();
  };

  // Convert current Euler angles to degrees for display
  const pitchDeg = displayAngles.pitch.toFixed(1);
  const rollDeg = displayAngles.roll.toFixed(1);
  const yawDeg = displayAngles.yaw.toFixed(1);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-white shadow-card flex flex-col lg:flex-row">
      {/* 3D WebGL Viewport Container */}
      <div
        className="relative flex-1 h-80 sm:h-96 lg:h-[430px] cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div ref={mountRef} className="w-full h-full" />

        {/* Viewport Overlay Controls */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
          <Badge
            variant={isStreaming ? 'success' : 'secondary'}
            className="text-[10px] font-mono tracking-wider"
          >
            {isStreaming ? 'LIVE 3D ORIENTATION' : 'AWAITING HARDWARE'}
          </Badge>
          <span className="text-[11px] font-mono text-slate-500 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-200">
            PITCH: {pitchDeg}° | ROLL: {rollDeg}° | YAW: {yawDeg}°
          </span>
        </div>

        {/* Axis Orientation Legend */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200 text-[11px] font-mono text-slate-600 shadow-sm">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded-full bg-red-500" /> X (Roll)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded-full bg-emerald-500" /> Y (Pitch)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded-full bg-blue-500" /> Z (Yaw)
          </span>
        </div>

        {/* Control Action Toolbar */}
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetOrientation}
            className="text-xs h-7 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-slate-50"
            title="Reset to 0° origin"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-600" /> Reset View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPaused((prev) => !prev)}
            className="text-xs h-7 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-slate-50"
            title={isPaused ? 'Resume animation' : 'Pause animation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-slate-600" />}
          </Button>
        </div>
      </div>

      {/* Numerical Axis HUD & Fusion Diagnostics Side Panel */}
      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 tracking-tight uppercase">
                Sensor Fusion Engine
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-white">
                Complementary Filter
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Fuses high-frequency angular rates from gyroscope with gravity acceleration vectors from accelerometer.
            </p>
          </div>

          {/* Fusion Mode Toggle */}
          <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('fusion')}
              className={`py-1 rounded-md text-[11px] transition-all ${
                viewMode === 'fusion' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fused Filter
            </button>
            <button
              onClick={() => setViewMode('accel')}
              className={`py-1 rounded-md text-[11px] transition-all ${
                viewMode === 'accel' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Accel Only
            </button>
            <button
              onClick={() => setViewMode('gyro')}
              className={`py-1 rounded-md text-[11px] transition-all ${
                viewMode === 'gyro' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gyro Rate
            </button>
          </div>

          {/* Accelerometer Readings */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm space-y-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tri-Axial Accelerometer (m/s²)
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded bg-red-50/60 border border-red-100">
                <span className="text-[10px] font-mono text-red-600 font-bold">X</span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                  {telemetry?.accel_x !== undefined ? telemetry.accel_x.toFixed(2) : '--'}
                </p>
              </div>
              <div className="p-1.5 rounded bg-emerald-50/60 border border-emerald-100">
                <span className="text-[10px] font-mono text-emerald-600 font-bold">Y</span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                  {telemetry?.accel_y !== undefined ? telemetry.accel_y.toFixed(2) : '--'}
                </p>
              </div>
              <div className="p-1.5 rounded bg-blue-50/60 border border-blue-100">
                <span className="text-[10px] font-mono text-blue-600 font-bold">Z</span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                  {telemetry?.accel_z !== undefined ? telemetry.accel_z.toFixed(2) : '--'}
                </p>
              </div>
            </div>
          </div>

          {/* Gyroscope Readings */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm space-y-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tri-Axial Gyroscope (°/s)
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-mono text-slate-500 font-bold">GX</span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                  {telemetry?.gyro_x !== undefined ? telemetry.gyro_x.toFixed(1) : '--'}
                </p>
              </div>
              <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-mono text-slate-500 font-bold">GY</span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                  {telemetry?.gyro_y !== undefined ? telemetry.gyro_y.toFixed(1) : '--'}
                </p>
              </div>
              <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-mono text-slate-500 font-bold">GZ</span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                  {telemetry?.gyro_z !== undefined ? telemetry.gyro_z.toFixed(1) : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Physics Vectors & Interaction Tip */}
        <div className="pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Click & drag to orbit • Scroll to zoom</span>
          <span className="font-mono text-indigo-600 font-semibold">
            {telemetry?.accel_magnitude !== undefined ? `${telemetry.accel_magnitude.toFixed(2)} m/s²` : '9.81 m/s²'}
          </span>
        </div>
      </div>
    </div>
  );
}
