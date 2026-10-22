import '@testing-library/jest-dom';

// Polyfill ResizeObserver for Recharts ResponsiveContainer in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill window.WebSocket in jsdom
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 1;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  constructor(public url: string) {
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
    }, 10);
  }
  send() {}
  close() {
    if (this.onclose) this.onclose(new CloseEvent('close'));
  }
}

global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
