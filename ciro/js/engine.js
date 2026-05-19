// CIRO - Orchestration Engine

import { RESOURCES } from './data.js';
import { SignalFusionAgent, CrisisClassifierAgent, SeverityPredictorAgent, ResourceAllocatorAgent, ImpactSimulatorAgent, StakeholderNotifierAgent, VerificationAgent, getTraces } from './agents.js';
import { client } from './api-client.js';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export class CIROEngine {
  constructor() {
    this.signals = [];
    this.crises = [];
    this.allocations = [];
    this.simulations = [];
    this.stakeholderMessages = [];
    this.verifications = [];
    this.resources = JSON.parse(JSON.stringify(RESOURCES));
    this.listeners = {};
    this.fusionAgent = new SignalFusionAgent();
    this.classifierAgent = new CrisisClassifierAgent();
    this.predictorAgent = new SeverityPredictorAgent();
    this.allocatorAgent = new ResourceAllocatorAgent();
    this.simulatorAgent = new ImpactSimulatorAgent();
    this.notifierAgent = new StakeholderNotifierAgent();
    this.verifierAgent = new VerificationAgent();
    this.backendConnected = false;

    // Connect to WebSocket server and set up proxy listeners if online
    client.connect().then(() => {
      console.log('⚡ CIROEngine: Connected to backend server. Activating live pipelines.');
      this.backendConnected = true;
      this.emit('backend-connected', true);

      client.on('signal', (s) => {
        this.signals.push(s);
        this.emit('signal', s);
      });
      client.on('crises', (crises) => {
        this.crises = crises;
        this.emit('crises', crises);
      });
      client.on('resources', (res) => {
        this.resources = res;
        this.emit('resources', res);
      });
      client.on('allocations', (allocs) => {
        this.allocations = allocs;
        this.emit('allocations', allocs);
      });
      client.on('simulations', (sims) => {
        this.simulations = sims;
        this.emit('simulations', sims);
      });
      client.on('stakeholder-messages', (msgs) => {
        this.stakeholderMessages = msgs;
        this.emit('stakeholder-messages', msgs);
      });
      client.on('verifications', (verifs) => {
        this.verifications = verifs;
        this.emit('verifications', verifs);
      });
      client.on('traces', (traces) => {
        this.emit('traces', traces);
      });
      client.on('agent-busy', (id) => this.emit('agent-busy', id));
      client.on('agent-idle', (id) => this.emit('agent-idle', id));
      client.on('threat-level', (level) => this.emit('threat-level', level));
      client.on('scenario-start', (sc) => this.emit('scenario-start', sc));
      client.on('reset', () => {
        this.signals = [];
        this.crises = [];
        this.allocations = [];
        this.simulations = [];
        this.emit('reset', null);
      });
      client.on('pipeline-complete', (data) => {
        this.crises = data.crises;
        this.allocations = data.allocations;
        this.simulations = data.simulations;
        this.emit('pipeline-complete', data);
      });

      // Special real-time loops
      client.on('weather-update', (data) => this.emit('weather-update', data));
      client.on('ai-commander-update', (data) => this.emit('ai-commander-update', data));
      client.on('agent-chat', (data) => this.emit('agent-chat', data));
    }).catch((err) => {
      console.log('⚠️ CIROEngine: Server offline. Running in local simulation mode.', err.message);
      this.backendConnected = false;
    });

    client.on('connected', (connected) => {
      this.backendConnected = connected;
      this.emit('backend-connected', connected);
    });
  }

  on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); }
  emit(event, data) { (this.listeners[event] || []).forEach(cb => cb(data)); }
  resetResources() { this.resources = JSON.parse(JSON.stringify(RESOURCES)); }
  
  ingestSignal(signal) {
    if (this.backendConnected) {
      client.send('ingest-signal', { signal });
    } else {
      this.signals.push(signal);
      this.emit('signal', signal);
    }
  }

  async runPipeline() {
    if (this.backendConnected) {
      client.send('run-pipeline', {});
    } else {
      this.emit('pipeline-start', null);
      // 1: Fusion
      this.emit('agent-busy', 'fusion'); await delay(400);
      const clusters = this.fusionAgent.fuse(this.signals);
      this.emit('agent-idle', 'fusion'); this.emit('traces', getTraces());
      // 2: Classification
      this.emit('agent-busy', 'classifier'); await delay(400);
      const newCrises = clusters.map(c => this.classifierAgent.classify(c));
      this.emit('agent-idle', 'classifier'); this.emit('traces', getTraces());
      // 3: Prediction
      this.emit('agent-busy', 'predictor'); await delay(400);
      this.crises = newCrises.map(c => this.predictorAgent.predict(c));
      this.emit('agent-idle', 'predictor'); this.emit('crises', this.crises); this.emit('traces', getTraces());
      // 4: Allocation
      this.emit('agent-busy', 'allocator'); await delay(400);
      this.resetResources();
      this.allocations = this.allocatorAgent.allocate(this.crises, this.resources);
      this.emit('agent-idle', 'allocator'); this.emit('resources', this.resources); this.emit('allocations', this.allocations); this.emit('traces', getTraces());
      // 5: Simulation
      this.emit('agent-busy', 'simulator'); await delay(400);
      this.simulations = this.crises.map((c, i) => this.simulatorAgent.simulate(c, this.allocations[i]));
      this.emit('agent-idle', 'simulator'); this.emit('simulations', this.simulations); this.emit('traces', getTraces());
      // 6: Notification
      this.emit('agent-busy', 'notifier'); await delay(300);
      this.stakeholderMessages = [];
      for (const crisis of this.crises) this.stakeholderMessages.push(...this.notifierAgent.notify(crisis));
      this.emit('agent-idle', 'notifier'); this.emit('stakeholder-messages', this.stakeholderMessages); this.emit('traces', getTraces());
      // 7: Verification
      this.emit('agent-busy', 'verifier'); await delay(500);
      this.verifications = [];
      for (const crisis of this.crises) {
        const v = this.verifierAgent.verify(crisis);
        this.verifications.push(v);
        if (v.action === 'reclassify' && v.newType) {
          const c = this.crises.find(cr => cr.id === v.crisisId);
          if (c) { const { CRISIS_TYPES } = await import('./data.js'); c.type = v.newType; c.typeInfo = CRISIS_TYPES[v.newType] || c.typeInfo; c.status = 'reclassified'; }
        }
        if (v.action === 'downgrade') {
          const c = this.crises.find(cr => cr.id === v.crisisId);
          if (c) { c.severity = 'low'; c.status = 'downgraded'; c.confidence *= 0.5; }
        }
      }
      this.emit('agent-idle', 'verifier'); this.emit('verifications', this.verifications); this.emit('crises', this.crises); this.emit('traces', getTraces());
      // Threat level
      const maxSev = this.crises.reduce((max, c) => Math.max(max, { critical: 4, high: 3, medium: 2, low: 1 }[c.severity] || 0), 0);
      this.emit('threat-level', { 4: 'CRITICAL', 3: 'HIGH', 2: 'MODERATE', 1: 'LOW' }[maxSev] || 'LOW');
      this.emit('pipeline-complete', { crises: this.crises, allocations: this.allocations, simulations: this.simulations, verifications: this.verifications });
    }
  }

  async runScenario(scenario) {
    if (this.backendConnected) {
      client.send('run-scenario', { scenarioId: scenario.id });
    } else {
      this.signals = []; this.crises = []; this.allocations = []; this.simulations = [];
      this.stakeholderMessages = []; this.verifications = [];
      this.resetResources(); getTraces().length = 0;
      this.emit('reset', null); this.emit('scenario-start', scenario);
      for (let i = 0; i < scenario.signals.length; i++) {
        await delay(600);
        this.ingestSignal(scenario.signals[i]());
      }
      await delay(500);
      await this.runPipeline();
    }
  }

  async runLiveStream() {
    if (this.backendConnected) {
      client.send('live-stream', {});
    } else {
      this.signals = []; this.crises = []; this.allocations = []; this.simulations = [];
      this.stakeholderMessages = []; this.verifications = [];
      this.resetResources(); getTraces().length = 0;
      this.emit('reset', null);
      this.emit('scenario-start', { name: '📡 LIVE REAL-TIME DATA STREAM (LOCAL DEMO)', id: 'live-stream' });
      // Ingest a mock real-time weather and news signal for local mode fallback
      this.ingestSignal({
        id: 'L-WEATH-1',
        type: 'weather',
        icon: '🌧️',
        source: 'Weather API',
        text: 'IoT Station: Peshawar reports Light Rain. Temperature: 26°C, Humidity: 65%, Wind: 4.5m/s.',
        location: 'Hayatabad Phase 1',
        urgency: 'low',
        timestamp: new Date().toLocaleTimeString(),
        credibility: 0.96,
        geolocationConf: 0.98,
        tags: ['weather', 'rain']
      });
      await delay(800);
      this.ingestSignal({
        id: 'L-NEWS-1',
        type: 'social',
        icon: '📰',
        source: 'Breaking News',
        text: 'Peshawar Traffic Police rerouting flow on Jamrud Road near Hayatabad due to minor drainage blockage.',
        location: 'Hayatabad Phase 1',
        urgency: 'medium',
        timestamp: new Date().toLocaleTimeString(),
        credibility: 0.90,
        geolocationConf: 0.85,
        tags: ['traffic', 'news']
      });
      await delay(500);
      await this.runPipeline();
    }
  }
}
