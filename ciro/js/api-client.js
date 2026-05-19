// CIRO - Backend API Client
// Connects frontend to Express + WebSocket backend

const API_BASE = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

class CIROClient {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // ==================== WebSocket ====================
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('🔌 Connected to CIRO backend');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.emit(msg.type, msg.data);
          } catch (e) {
            console.error('WS message parse error:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('🔌 Disconnected from backend');
          this.connected = false;
          this.emit('connected', false);
          this.tryReconnect();
        };

        this.ws.onerror = (err) => {
          console.warn('WS error - backend may not be running');
          this.connected = false;
          reject(err);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached. Using local mode.');
      this.emit('fallback-local', true);
      return;
    }
    this.reconnectAttempts++;
    console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
    setTimeout(() => this.connect().catch(() => {}), 2000 * this.reconnectAttempts);
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  // ==================== Event System ====================
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ==================== REST API ====================
  async getState() {
    const res = await fetch(`${API_BASE}/state`);
    return res.json();
  }

  async getSignals(filters = {}) {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/signals?${params}`);
    return res.json();
  }

  async postSignal(signal) {
    const res = await fetch(`${API_BASE}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signal)
    });
    return res.json();
  }

  async getCrises() {
    const res = await fetch(`${API_BASE}/crises`);
    return res.json();
  }

  async getCrisis(id) {
    const res = await fetch(`${API_BASE}/crises/${id}`);
    return res.json();
  }

  async getResources() {
    const res = await fetch(`${API_BASE}/resources`);
    return res.json();
  }

  async getTraces(filters = {}) {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/traces?${params}`);
    return res.json();
  }

  async getStakeholderMessages() {
    const res = await fetch(`${API_BASE}/stakeholder-messages`);
    return res.json();
  }

  async runScenario(scenarioId) {
    // Prefer WebSocket for real-time updates
    if (this.connected) {
      this.send('run-scenario', { scenarioId });
      return { status: 'started-ws', scenarioId };
    }
    // Fallback to REST
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/run`, { method: 'POST' });
    return res.json();
  }

  async runPipeline() {
    if (this.connected) {
      this.send('run-pipeline', {});
      return;
    }
    await fetch(`${API_BASE}/pipeline/run`, { method: 'POST' });
  }

  async reset() {
    if (this.connected) {
      this.send('reset', {});
      return;
    }
    await fetch(`${API_BASE}/reset`, { method: 'POST' });
  }

  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  }
}

// Export singleton
export const client = new CIROClient();
export default client;
