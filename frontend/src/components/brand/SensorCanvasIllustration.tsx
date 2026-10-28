import { useRef, useEffect } from 'react';

interface SensorCanvasIllustrationProps {
  className?: string;
}

export function SensorCanvasIllustration({ className = '' }: SensorCanvasIllustrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || 400;
      height = canvas.height = canvas.parentElement?.clientHeight || 400;
    };
    window.addEventListener('resize', handleResize);

    const nodes = [
      { x: 0.25, y: 0.35, r: 4, pulse: 0, label: 'Node-01' },
      { x: 0.5, y: 0.22, r: 5, pulse: 1, label: 'Node-02' },
      { x: 0.75, y: 0.38, r: 4, pulse: 2, label: 'Node-03' },
      { x: 0.35, y: 0.65, r: 4.5, pulse: 3, label: 'Gateway' },
      { x: 0.68, y: 0.72, r: 4, pulse: 4, label: 'Node-04' },
      { x: 0.5, y: 0.48, r: 6.5, pulse: 0.5, isCore: true, label: 'Anomaly Hub' },
    ];

    let t = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      t += 0.02;

      // Draw faint waveform
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 3) {
        const normX = x / width;
        const wave = Math.sin(normX * 12 + t * 2) * 18 * Math.sin(normX * Math.PI);
        const y = height * 0.85 + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Inter-node connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const x1 = n1.x * width;
          const y1 = n1.y * height;
          const x2 = n2.x * width;
          const y2 = n2.y * height;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = 'rgba(37, 99, 235, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Data pulse moving along link
          const pulseProgress = (t * 0.4 + (i + j) * 0.2) % 1;
          const px = x1 + (x2 - x1) * pulseProgress;
          const py = y1 + (y2 - y1) * pulseProgress;

          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(37, 99, 235, 0.45)';
          ctx.fill();
        }
      }

      // Draw Nodes
      nodes.forEach((n) => {
        const x = n.x * width;
        const y = n.y * height;

        // Pulse ring
        const ringScale = (Math.sin(t * 2 + n.pulse) + 1) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, n.r + ringScale * 8, 0, Math.PI * 2);
        ctx.strokeStyle = n.isCore ? 'rgba(37, 99, 235, 0.2)' : 'rgba(16, 185, 129, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Solid Node Core
        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.isCore ? '#2563EB' : '#10B981';
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(x, y, n.r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className={`w-full h-full pointer-events-none ${className}`} />;
}
