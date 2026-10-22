import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/simulator/status')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'stopped',
            devices: ['sensor-01', 'sensor-02'],
            metrics: {
              generated_count: 120,
              inferred_count: 120,
              anomalies_detected: 4,
              persisted_count: 120,
              dropped_messages: 0,
              avg_latency_ms: 1.25,
              throughput_rps: 10.0,
            },
          }),
      });
    }
    if (url.includes('/health')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'ok',
            app_name: 'AI-Based IoT Sensor Anomaly Detection API',
            version: '0.1.0',
            environment: 'test',
            timestamp: new Date().toISOString(),
          }),
      });
    }
    if (url.includes('/ready')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'ready',
            timestamp: new Date().toISOString(),
            components: {
              api_server: { ready: true, message: 'FastAPI router active.' },
              database: { ready: true, message: 'MongoDB active.', details: { configured_target: 'iot_db' } },
            },
          }),
      });
    }
    if (url.includes('/anomalies')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            total: 0,
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });
  }));
});

describe('App Phase 6 Analytics Dashboard', () => {
  it('renders sidebar navigation with all 10 analytics modules', async () => {
    render(<App />);

    expect(screen.getByText(/IoT Anomaly Guard/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Live Monitoring/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sensor Explorer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anomaly Investigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dataset Explorer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Model Registry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simulation Center/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Model Research Lab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Experiment Compare/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reports & Config/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/System Operational Overview/i)).toBeInTheDocument();
    });
  });
});
