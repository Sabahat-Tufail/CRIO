// CIRO Backend Server - Express + WebSocket
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { CONFIG } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3001;

// ==================== IN-MEMORY STATE ====================
let state = {
  signals: [],
  crises: [],
  allocations: [],
  simulations: [],
  stakeholderMessages: [],
  verifications: [],
  agentTraces: [],
  threatLevel: 'LOW',
  resources: getDefaultResources(),
  activeScenario: null,
  weather: { temp: 24, condition: 'Clear', humidity: 55, wind: 3.2 },
  aiCommander: {
    summary: 'Awaiting operational signals to perform real-time urban disaster assessment...',
    actions: ['Standby for signal intelligence processing'],
    escalationPrediction: 'No active threats detected. Risk level: Nominal.',
    confidence: 1.0,
    forecast: 'System monitoring: Hayatabad, University Town, Saddar, Karkhano, G.T. Road, Charsadda.'
  }
};

function getDefaultResources() {
  return {
    ambulances: { icon: '🚑', total: 24, available: 24, label: 'Ambulances', color: '#ff3d57' },
    police: { icon: '🚔', total: 40, available: 40, label: 'Police Units', color: '#42a5f5' },
    rescue: { icon: '🚒', total: 16, available: 16, label: 'Rescue Teams', color: '#ffa726' },
    shelters: { icon: '🏠', total: 8, available: 8, label: 'Shelters', color: '#4caf50' },
    generators: { icon: '⚡', total: 20, available: 20, label: 'Generators', color: '#ffd54f' },
    waterTankers: { icon: '💧', total: 12, available: 12, label: 'Water Tankers', color: '#26c6da' },
    fieldTeams: { icon: '👷', total: 30, available: 30, label: 'Field Teams', color: '#ab47bc' },
    drones: { icon: '📡', total: 10, available: 10, label: 'Survey Drones', color: '#78909c' }
  };
}

// Persist state to file (simple JSON persistence)
const STATE_FILE = path.join(__dirname, 'state.json');
function saveState() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch (e) { /* ignore */ }
}
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      state = {
        ...state,
        ...loaded,
        weather: loaded.weather || state.weather,
        aiCommander: loaded.aiCommander || state.aiCommander
      };
      console.log('📂 Loaded saved state');
    }
  } catch (e) { console.log('Starting with fresh state'); }
}

// ==================== WEBSOCKET ====================
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`🔌 Client connected (${clients.size} total)`);

  // Send current state to new client
  ws.send(JSON.stringify({ type: 'init', data: state }));

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      handleWSMessage(ws, parsed);
    } catch (e) { console.error('WS parse error:', e.message); }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 Client disconnected (${clients.size} total)`);
  });
});

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function handleWSMessage(ws, msg) {
  switch (msg.type) {
    case 'run-scenario':
      runScenarioOnServer(msg.scenarioId);
      break;
    case 'ingest-signal':
      ingestSignal(msg.signal);
      break;
    case 'run-pipeline':
      runPipeline();
      break;
    case 'reset':
      resetState();
      broadcast('reset', null);
      break;
    case 'live-stream':
      startLiveStreamOnServer();
      break;
  }
}

// ==================== REST API ====================

// Get full state
app.get('/api/state', (req, res) => {
  res.json(state);
});

// Get signals
app.get('/api/signals', (req, res) => {
  const { type, location, limit } = req.query;
  let signals = [...state.signals];
  if (type) signals = signals.filter(s => s.type === type);
  if (location) signals = signals.filter(s => s.location === location);
  if (limit) signals = signals.slice(-parseInt(limit));
  res.json(signals);
});

// Post a new signal
app.post('/api/signals', (req, res) => {
  const signal = { id: uuidv4(), ...req.body, timestamp: new Date().toISOString() };
  ingestSignal(signal);
  res.status(201).json(signal);
});

// Get active crises
app.get('/api/crises', (req, res) => {
  res.json(state.crises);
});

// Get crisis by ID
app.get('/api/crises/:id', (req, res) => {
  const crisis = state.crises.find(c => c.id === req.params.id);
  if (!crisis) return res.status(404).json({ error: 'Crisis not found' });
  const alloc = state.allocations.find(a => a.crisisId === crisis.id);
  const verif = state.verifications.find(v => v.crisisId === crisis.id);
  const sim = state.simulations.find(s => s.crisisId === crisis.id);
  res.json({ ...crisis, allocation: alloc, verification: verif, simulation: sim });
});

// Get resources
app.get('/api/resources', (req, res) => {
  res.json(state.resources);
});

// Get agent traces
app.get('/api/traces', (req, res) => {
  const { agent, limit } = req.query;
  let traces = [...state.agentTraces];
  if (agent) traces = traces.filter(t => t.agent === agent);
  if (limit) traces = traces.slice(-parseInt(limit));
  res.json(traces);
});

// Get stakeholder messages
app.get('/api/stakeholder-messages', (req, res) => {
  res.json(state.stakeholderMessages);
});

// Run a scenario
app.post('/api/scenarios/:id/run', (req, res) => {
  const scenarioId = req.params.id;
  runScenarioOnServer(scenarioId);
  res.json({ status: 'started', scenarioId });
});

// Run pipeline manually
app.post('/api/pipeline/run', (req, res) => {
  runPipeline();
  res.json({ status: 'started' });
});

// Reset state
app.post('/api/reset', (req, res) => {
  resetState();
  broadcast('reset', null);
  res.json({ status: 'reset' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), clients: clients.size, crises: state.crises.length, signals: state.signals.length });
});

// ==================== SERVER-SIDE AGENT PIPELINE ====================

const CRISIS_TYPES = {
  flood: { icon: '🌊', label: 'Urban Flooding', color: '#42a5f5' },
  heatwave: { icon: '🔥', label: 'Heat Emergency', color: '#ff7043' },
  accident: { icon: '💥', label: 'Major Accident', color: '#ff3d57' },
  infrastructure: { icon: '🏗️', label: 'Infrastructure Failure', color: '#ffa726' },
  powerOutage: { icon: '⚡', label: 'Power Outage', color: '#ffd54f' },
  protest: { icon: '📢', label: 'Public Disorder', color: '#ab47bc' },
  disease: { icon: '🦠', label: 'Disease Cluster', color: '#4caf50' },
  waterMain: { icon: '💧', label: 'Water Main Burst', color: '#26c6da' }
};

const CITY_SECTORS = {
  'Hayatabad Phase 1': { lat: 33.9870, lng: 71.4360, pop: 45000 },
  'Hayatabad Phase 5': { lat: 33.9920, lng: 71.4150, pop: 38000 },
  'University Town': { lat: 33.9950, lng: 71.4880, pop: 52000 },
  'Board Bazaar': { lat: 34.0000, lng: 71.4700, pop: 41000 },
  'Saddar': { lat: 34.0080, lng: 71.5300, pop: 35000 },
  'Karkhano': { lat: 33.9980, lng: 71.4250, pop: 29000 },
  'Khyber Bazaar': { lat: 34.0120, lng: 71.5650, pop: 55000 },
  'Ring Road': { lat: 33.9750, lng: 71.5450, pop: 48000 },
  'G.T. Road': { lat: 34.0150, lng: 71.5800, pop: 62000 },
  'Warsak Road': { lat: 34.0450, lng: 71.5120, pop: 37000 },
  'Khyber Road': { lat: 34.0180, lng: 71.5350, pop: 25000 },
  'Charsadda': { lat: 34.1500, lng: 71.7300, pop: 120000 }
};

function addTrace(agent, type, message, confidence = null) {
  const trace = { id: state.agentTraces.length + 1, agent, type, message, confidence, timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) };
  state.agentTraces.push(trace);
  broadcast('trace', trace);
  return trace;
}

let pipelineDebounceTimeout = null;
function ingestSignal(signal) {
  state.signals.push(signal);
  broadcast('signal', signal);

  // Automatically trigger multi-agent pipeline on real-time data streams
  if (!state.activeScenario) {
    if (pipelineDebounceTimeout) clearTimeout(pipelineDebounceTimeout);
    pipelineDebounceTimeout = setTimeout(() => {
      console.log('🔄 Real-Time Signal Ingested: Triggering Multi-Agent Pipeline...');
      runPipeline();
    }, 1000);
  }
}

function resetState() {
  state = {
    signals: [],
    crises: [],
    allocations: [],
    simulations: [],
    stakeholderMessages: [],
    verifications: [],
    agentTraces: [],
    threatLevel: 'LOW',
    resources: getDefaultResources(),
    activeScenario: null,
    weather: { temp: 24, condition: 'Clear', humidity: 55, wind: 3.2 },
    aiCommander: {
      summary: 'Awaiting operational signals to perform real-time urban disaster assessment...',
      actions: ['Standby for signal intelligence processing'],
      escalationPrediction: 'No active threats detected. Risk level: Nominal.',
      confidence: 1.0,
      forecast: 'System monitoring: Hayatabad, University Town, Saddar, Karkhano, G.T. Road, Charsadda.'
    }
  };
  saveState();
}

async function runPipeline() {
  broadcast('pipeline-start', null);

  // Agent 1: Signal Fusion
  broadcast('agent-busy', 'fusion');
  addTrace('fusion', 'trace-fusion', `Ingesting ${state.signals.length} signals...`);
  const clusters = fuseSignals(state.signals);
  broadcast('agent-idle', 'fusion');
  broadcast('traces', state.agentTraces);

  // Agent 2: Classification
  broadcast('agent-busy', 'classifier');
  state.crises = clusters.map(c => classifyCrisis(c));
  broadcast('agent-idle', 'classifier');
  broadcast('crises', state.crises);
  broadcast('traces', state.agentTraces);

  // Agent 3: Prediction
  broadcast('agent-busy', 'predictor');
  state.crises = state.crises.map(c => predictSeverity(c));
  broadcast('agent-idle', 'predictor');
  broadcast('crises', state.crises);
  broadcast('traces', state.agentTraces);

  // Agent 4: Allocation
  broadcast('agent-busy', 'allocator');
  state.resources = getDefaultResources();
  state.allocations = allocateResources(state.crises, state.resources);
  broadcast('agent-idle', 'allocator');
  broadcast('resources', state.resources);
  broadcast('allocations', state.allocations);
  broadcast('traces', state.agentTraces);

  // Agent 5: Simulation
  broadcast('agent-busy', 'simulator');
  state.simulations = state.crises.map((c, i) => simulateImpact(c, state.allocations[i]));
  broadcast('agent-idle', 'simulator');
  broadcast('simulations', state.simulations);
  broadcast('traces', state.agentTraces);

  // Agent 6: Notification
  broadcast('agent-busy', 'notifier');
  state.stakeholderMessages = [];
  for (const crisis of state.crises) state.stakeholderMessages.push(...generateNotifications(crisis));
  broadcast('agent-idle', 'notifier');
  broadcast('stakeholder-messages', state.stakeholderMessages);
  broadcast('traces', state.agentTraces);

  // Agent 7: Verification
  broadcast('agent-busy', 'verifier');
  state.verifications = state.crises.map(c => verifyCrisis(c));
  broadcast('agent-idle', 'verifier');
  broadcast('verifications', state.verifications);
  broadcast('crises', state.crises);
  broadcast('traces', state.agentTraces);

  // Threat level
  const maxSev = state.crises.reduce((m, c) => Math.max(m, { critical: 4, high: 3, medium: 2, low: 1 }[c.severity] || 0), 0);
  state.threatLevel = { 4: 'CRITICAL', 3: 'HIGH', 2: 'MODERATE', 1: 'LOW' }[maxSev] || 'LOW';
  broadcast('threat-level', state.threatLevel);
  broadcast('pipeline-complete', { crises: state.crises, allocations: state.allocations, simulations: state.simulations });

  saveState();
}

// ---- Agent implementations (server-side mirrors of frontend agents) ----

function fuseSignals(signals) {
  const byLoc = {};
  for (const s of signals) {
    if (s.location === 'System') continue;
    if (!byLoc[s.location]) byLoc[s.location] = [];
    byLoc[s.location].push(s);
  }
  const clusters = [];
  for (const [loc, sigs] of Object.entries(byLoc)) {
    const avgCred = sigs.reduce((a, s) => a + (s.credibility || 0.5), 0) / sigs.length;
    const sourceTypes = [...new Set(sigs.map(s => s.type))];
    const avgUrg = sigs.reduce((a, s) => a + ({ critical: 4, high: 3, medium: 2, low: 1, warning: 2.5 }[s.urgency] || 2), 0) / sigs.length;
    let confidence = Math.min((avgCred * 0.3 + (sourceTypes.length / 6) * 0.25 + 0.7 * 0.2 + Math.min(avgUrg / 4, 1) * 0.25), 0.98);
    const texts = sigs.map(s => s.text.toLowerCase());
    const contradictions = [];
    if (texts.some(t => t.includes('flood')) && texts.some(t => t.includes('water main') || t.includes('pipe'))) {
      contradictions.push({ type: 'cause-conflict', desc: 'Flood vs Water Main — conflicting hypotheses' });
      confidence *= 0.7;
    }
    if (texts.some(t => t.includes('explosion')) && sigs.some(s => s.type === 'sensor' && s.sensorReading < s.sensorThreshold)) {
      contradictions.push({ type: 'sensor-social-conflict', desc: 'Social reports danger but sensors normal' });
      confidence *= 0.7;
    }
    clusters.push({ location: loc, signals: sigs, sourceTypes, avgCredibility: avgCred, avgUrgency: avgUrg, sourceDiversity: sourceTypes.length / 6, contradictions, confidence: Math.round(confidence * 100) / 100, signalCount: sigs.length });
    addTrace('fusion', 'trace-fusion', `Cluster [${loc}]: ${sigs.length} signals, ${sourceTypes.length} sources, cred=${avgCred.toFixed(2)}`, confidence);
  }
  addTrace('fusion', 'trace-fusion', `Fusion: ${clusters.length} cluster(s).`);
  return clusters;
}

function classifyCrisis(cluster) {
  addTrace('classifier', 'trace-classify', `Classifying ${cluster.location}...`);
  const allText = cluster.signals.map(s => s.text.toLowerCase()).join(' ');
  const scores = {};
  const checks = [
    { key: 'flood', words: ['flood', 'water logging', 'rain', 'nullah'] },
    { key: 'heatwave', words: ['heat', 'hot', 'temperature', 'collapsed', 'heatwave'] },
    { key: 'accident', words: ['accident', 'crash', 'collision'] },
    { key: 'powerOutage', words: ['power', 'electricity', 'outage', 'blackout'] },
    { key: 'waterMain', words: ['water main', 'burst pipe', 'pipe visible'] },
    { key: 'infrastructure', words: ['gas', 'leak', 'chemical'] },
  ];
  for (const c of checks) scores[c.key] = c.words.reduce((a, w) => a + (allText.split(w).length - 1), 0);
  for (const s of cluster.signals.filter(s => s.type === 'sensor' && s.sensorReading > s.sensorThreshold)) {
    if (s.text.toLowerCase().includes('water')) scores.flood = (scores.flood || 0) + 3;
    if (s.text.toLowerCase().includes('temp')) scores.heatwave = (scores.heatwave || 0) + 3;
    if (s.text.toLowerCase().includes('gas')) scores.infrastructure = (scores.infrastructure || 0) + 3;
  }
  let type = 'infrastructure', maxVal = 0;
  for (const [k, v] of Object.entries(scores)) { if (v > maxVal) { maxVal = v; type = k; } }
  const sevScore = Math.min(cluster.avgUrgency / 4 + Math.min(cluster.signalCount / 10, 0.3) + cluster.sourceDiversity * 0.2, 1);
  const severity = sevScore > 0.8 ? 'critical' : sevScore > 0.6 ? 'high' : sevScore > 0.35 ? 'medium' : 'low';
  const crisis = { id: 'CR-' + uuidv4().substring(0, 8).toUpperCase(), type, typeInfo: CRISIS_TYPES[type] || CRISIS_TYPES.infrastructure, confidence: Math.round(cluster.confidence * Math.min(maxVal / 10, 1) * 100) / 100, severity, severityScore: sevScore, location: cluster.location, coords: CITY_SECTORS[cluster.location] || { lat: 34.0151, lng: 71.5249 }, contradictions: cluster.contradictions, signalCount: cluster.signalCount, sourceTypes: cluster.sourceTypes, status: 'active', cluster };
  addTrace('classifier', 'trace-classify', `✅ ${crisis.typeInfo.icon} ${crisis.typeInfo.label} at ${cluster.location} | ${severity.toUpperCase()} | ${(crisis.confidence * 100).toFixed(0)}%`, crisis.confidence);
  return crisis;
}

function predictSeverity(crisis) {
  const sector = CITY_SECTORS[crisis.location] || { pop: 30000 };
  const mult = { critical: 1, high: 0.7, medium: 0.4, low: 0.15 }[crisis.severity] || 0.3;
  crisis.prediction = { affectedRadius: Math.round((0.5 + mult * 2.5) * 10) / 10, affectedPopulation: Math.round(sector.pop * mult), estimatedDuration: Math.round(1 + mult * 8) + ' hours', peakImpactTime: Math.round(0.5 + mult * 2) + ' hours', spreadRisk: mult > 0.6 ? 'HIGH' : mult > 0.3 ? 'MODERATE' : 'LOW', uncertaintyRange: `±${Math.round((1 - crisis.confidence) * 30)}%` };
  addTrace('predictor', 'trace-predict', `📊 ${crisis.location}: Radius=${crisis.prediction.affectedRadius}km, Pop=${crisis.prediction.affectedPopulation.toLocaleString()}`, crisis.confidence);
  return crisis;
}

function allocateResources(crises, resources) {
  addTrace('allocator', 'trace-allocate', `Allocating for ${crises.length} crises...`);
  const sorted = [...crises].sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0));
  const allocs = [];
  const avail = {};
  for (const [k, v] of Object.entries(resources)) avail[k] = v.available;
  const needsMap = { flood: { ambulances: 3, rescue: 4, police: 3, fieldTeams: 4 }, heatwave: { ambulances: 4, fieldTeams: 5, waterTankers: 3, shelters: 2, generators: 3 }, waterMain: { rescue: 2, waterTankers: 4, fieldTeams: 3 }, infrastructure: { rescue: 3, fieldTeams: 3, generators: 2 } };
  for (const crisis of sorted) {
    const needs = needsMap[crisis.type] || needsMap.infrastructure;
    const mult = crisis.severity === 'critical' ? 1.5 : crisis.severity === 'high' ? 1.2 : 1;
    const alloc = { crisisId: crisis.id, location: crisis.location, resources: {}, tradeoffs: [] };
    for (const [res, qty] of Object.entries(needs)) {
      const need = Math.ceil(qty * mult), have = avail[res] || 0, assigned = Math.min(need, have);
      if (assigned > 0) { alloc.resources[res] = assigned; avail[res] -= assigned; }
      if (assigned < need) alloc.tradeoffs.push(`${resources[res]?.label}: need ${need}, got ${assigned}`);
    }
    allocs.push(alloc);
    addTrace('allocator', 'trace-allocate', `📦 ${crisis.location}: ${Object.entries(alloc.resources).map(([k, v]) => `${v} ${resources[k]?.label || k}`).join(', ')}`);
  }
  for (const [k, v] of Object.entries(avail)) resources[k].available = v;
  return allocs;
}

function simulateImpact(crisis, allocation) {
  const actions = [
    { action: 'Emergency Dispatch', icon: '🚨', before: { desc: 'No resources on-site', metric: 'N/A' }, after: { desc: 'Teams deployed', metric: `ETA: ${8 + Math.floor(Math.random() * 7)} min` }, improvement: 'Full coverage', cost: `${Object.values(allocation?.resources || {}).reduce((a, b) => a + b, 0)} units`, sideEffects: ['Reduced reserves'] },
    { action: 'Public Alert', icon: '📢', before: { desc: 'Public unaware', metric: 'Info gap: HIGH' }, after: { desc: 'Alert broadcast', metric: 'Coverage: ~85%' }, improvement: 'Informed population', cost: 'SMS costs', sideEffects: ['Increased helpline calls'] }
  ];
  addTrace('simulator', 'trace-simulate', `🧪 ${crisis.location}: ${actions.length} actions modeled.`);
  return { crisisId: crisis.id, location: crisis.location, actions };
}

function generateNotifications(crisis) {
  const loc = crisis.location, sev = crisis.severity.toUpperCase(), type = crisis.typeInfo.label;
  addTrace('notifier', 'trace-notify', `📢 ${crisis.location}: 6 notifications generated.`);
  return [
    { recipient: 'Public', icon: '📱', priority: 'URGENT', priorityColor: '#ff3d57', body: `⚠️ ${sev}: ${type} in ${loc}. Avoid area. Emergency: 1122.` },
    { recipient: 'Emergency Services', icon: '🚒', priority: 'CRITICAL', priorityColor: '#ff3d57', body: `DISPATCH — ${type} at ${loc}. Severity: ${sev}.` },
    { recipient: 'Hospitals', icon: '🏥', priority: 'HIGH', priorityColor: '#ffa726', body: `ADVISORY — Prepare for ${type} casualties from ${loc}.` },
    { recipient: 'Utilities', icon: '🔌', priority: 'HIGH', priorityColor: '#ffa726', body: `ALERT — Check infrastructure impact at ${loc}.` },
    { recipient: 'Transport', icon: '🚌', priority: 'MEDIUM', priorityColor: '#ffd54f', body: `Reroute traffic around ${loc}.` },
    { recipient: 'Media', icon: '📺', priority: 'INFO', priorityColor: '#42a5f5', body: `SITREP — ${type} at ${loc}. Confidence: ${(crisis.confidence * 100).toFixed(0)}%.` }
  ];
}

function verifyCrisis(crisis) {
  const result = { crisisId: crisis.id, action: 'confirm', details: '' };
  if (crisis.contradictions?.length > 0) {
    const c = crisis.contradictions[0];
    if (c.type === 'cause-conflict') {
      const field = crisis.cluster?.signals?.find(s => s.type === 'field' && s.verified);
      if (field && (field.text.toLowerCase().includes('water main') || field.text.toLowerCase().includes('burst'))) {
        result.action = 'reclassify'; result.newType = 'waterMain';
        result.details = 'Field confirms water main burst. Reclassifying.';
        crisis.type = 'waterMain'; crisis.typeInfo = CRISIS_TYPES.waterMain; crisis.status = 'reclassified';
        addTrace('verifier', 'trace-verify', `⚠️ RECLASSIFIED: → Water Main Burst`);
      }
    } else if (c.type === 'sensor-social-conflict') {
      const field = crisis.cluster?.signals?.find(s => s.type === 'field' && s.verified);
      if (field) {
        result.action = 'downgrade'; result.details = 'Social media exaggerated. Downgrading.';
        crisis.severity = 'low'; crisis.status = 'downgraded';
        addTrace('verifier', 'trace-verify', `✅ FALSE ALARM detected. Downgraded.`);
      }
    }
  } else {
    addTrace('verifier', 'trace-verify', `✅ ${crisis.location}: Confirmed.`);
  }
  return result;
}

// ==================== SCENARIO RUNNER ====================
async function runScenarioOnServer(scenarioId) {
  resetState();
  state.activeScenario = scenarioId;
  broadcast('scenario-start', { id: scenarioId });

  const scenarios = await import('./scenarios.js');
  const scenario = scenarios.default[scenarioId];
  if (!scenario) { broadcast('error', { message: 'Unknown scenario' }); return; }

  // Ingest signals with delays
  for (const signalFn of scenario.signals) {
    await new Promise(r => setTimeout(r, 600));
    const signal = signalFn();
    ingestSignal(signal);
  }

  await new Promise(r => setTimeout(r, 500));
  await runPipeline();
}

async function startLiveStreamOnServer() {
  console.log('📡 Starting Live Stream Mode: Fetching current real-time weather and news...');
  resetState();
  lastWeatherText = '';
  fetchedArticles.clear();
  broadcast('scenario-start', { name: '📡 LIVE REAL-TIME DATA STREAM', id: 'live-stream' });
  
  // Instantly poll Weather and News endpoints to get current live data!
  await updateWeather();
  await updateNews();
}

// ==================== WEATHER, NEWS & AI COMMANDER LOOPS ====================
let lastWeatherText = '';
async function updateWeather() {
  try {
    if (!CONFIG.OPENWEATHER_API_KEY || CONFIG.OPENWEATHER_API_KEY.includes('YOUR_')) {
      // Return fallback weather
      state.weather = { temp: 24, condition: 'Clear', humidity: 55, wind: 3.2 };
      broadcast('weather-update', state.weather);
      return;
    }
    const url = `https://api.openweathermap.org/data/2.5/weather?q=Peshawar&appid=${CONFIG.OPENWEATHER_API_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather HTTP error: ${res.status}`);
    const data = await res.json();

    const condition = data.weather[0].main;
    const temp = Math.round(data.main.temp);
    const humidity = data.main.humidity;
    const wind = data.wind.speed;

    state.weather = { temp, condition, humidity, wind };
    broadcast('weather-update', state.weather);

    const weatherText = `IoT Station: Peshawar reports ${condition}. Temperature: ${temp}°C, Humidity: ${humidity}%, Wind: ${wind}m/s.`;
    if (weatherText !== lastWeatherText) {
      lastWeatherText = weatherText;
      const urgency = ['Rain', 'Thunderstorm', 'Snow', 'Extreme'].includes(condition) ? 'high' : 'low';
      ingestSignal({
        id: 'WEATH-' + uuidv4().substring(0, 8),
        type: 'weather',
        icon: '🌧️',
        source: 'Weather IoT Station',
        text: weatherText,
        location: 'Peshawar',
        urgency,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        credibility: 0.96,
        geolocationConf: 0.98,
        tags: ['weather', condition.toLowerCase()]
      });
    }
  } catch (err) {
    console.error('Weather update error:', err.message);
  }
}

const fetchedArticles = new Set();
async function updateNews() {
  try {
    if (!CONFIG.NEWS_API_KEY || CONFIG.NEWS_API_KEY.includes('YOUR_')) return;
    const url = `https://newsapi.org/v2/everything?q=Peshawar%20AND%20(flood%20OR%20heatwave%20OR%20accident%20OR%20emergency%20OR%20disaster%20OR%20weather%20OR%20crisis)&sortBy=publishedAt&pageSize=3&apiKey=${CONFIG.NEWS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NewsAPI HTTP error: ${res.status}`);
    const data = await res.json();

    if (data.articles && data.articles.length > 0) {
      for (const article of data.articles) {
        if (fetchedArticles.has(article.url)) continue;
        fetchedArticles.add(article.url);

        let location = 'Peshawar';
        for (const sec of Object.keys(CITY_SECTORS)) {
          if (article.title.includes(sec) || (article.description && article.description.includes(sec))) {
            location = sec;
            break;
          }
        }

        ingestSignal({
          id: 'NEWS-' + uuidv4().substring(0, 8),
          type: 'social',
          icon: '📰',
          source: article.source.name || 'Breaking News',
          text: article.title + ' - ' + (article.description || ''),
          location,
          urgency: 'high',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          credibility: 0.90,
          geolocationConf: 0.85,
          tags: ['news', 'breaking']
        });
      }
    }
  } catch (err) {
    console.error('News update error:', err.message);
  }
}

async function updateAICommander() {
  try {
    const prompt = `You are the AI Incident Commander for CIRO (Crisis Intelligence & Response Orchestrator), a futuristic smart city crisis control platform.
    Analyze the current city state and provide:
    1. Executive Sitrep: direct, high-level summary of active crises.
    2. Recommended actions: 2-3 specific, actionable recommendations.
    3. 30-min escalation forecast: brief analysis of spreading/cascading risks.
    4. Infrastructure & metrics forecast: brief forecast of power, drainage, or hospital load.
    5. Confidence score: float between 0.0 and 1.0.

    CURRENT STATE:
    Active Crises: ${JSON.stringify(state.crises.map(c => ({ id: c.id, type: c.typeInfo.label, location: c.location, severity: c.severity, status: c.status })))}
    Available Resources: ${JSON.stringify(state.resources)}
    Weather: Temp: ${state.weather.temp}°C, Condition: ${state.weather.condition}, Humidity: ${state.weather.humidity}%, Wind: ${state.weather.wind} m/s
    Latest Signals: ${JSON.stringify(state.signals.slice(-8).map(s => ({ source: s.source, text: s.text, location: s.location })))}

    You must respond ONLY with a valid, clean JSON object matching this schema. DO NOT include markdown tags like \`\`\`json or \`\`\`:
    {
      "summary": "Direct, executive crisis sitrep summary.",
      "actions": ["Directive action item 1", "Directive action item 2"],
      "escalationPrediction": "A brief analysis of risk/escalation inside 30 minutes.",
      "confidence": 0.95,
      "forecast": "Flooding peak/weather severity or infrastructure failure forecast."
    }`;

    let parsedResult = null;

    if (CONFIG.OPENAI_API_KEY && !CONFIG.OPENAI_API_KEY.includes('YOUR_')) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      if (response.ok) {
        const result = await response.json();
        let content = result.choices[0].message.content.trim();
        if (content.startsWith('```')) {
          content = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        parsedResult = JSON.parse(content);
      } else {
        console.warn('OpenAI API call failed, using heuristic.');
      }
    }

    if (!parsedResult) {
      parsedResult = getHeuristicAICommanderState();
    }

    state.aiCommander = parsedResult;
    broadcast('ai-commander-update', state.aiCommander);
  } catch (err) {
    console.error('AI Commander update error:', err.message);
    state.aiCommander = getHeuristicAICommanderState();
    broadcast('ai-commander-update', state.aiCommander);
  }
}

function getHeuristicAICommanderState() {
  const activeCrises = state.crises;
  let summary = '';
  let actions = [];
  let escalation = '';
  let forecast = '';
  let confidence = 0.95;

  if (activeCrises.length === 0) {
    summary = "Peshawar sector operations are nominal. Weather conditions are monitored. No active critical signals detected.";
    actions = [
      "Maintain active sensor polling on Hayatabad Nullah level detectors",
      "Monitor social media grids for public anomalies"
    ];
    escalation = "Nominal operations. Low probability of crisis onset within the next 30 minutes.";
    forecast = "Weather forecast: Moderate temperatures, low rain probability. Infrastructure grids functional.";
  } else {
    const mainCrisis = activeCrises[0];
    summary = `CRITICAL ALERT: Coordinated emergency response active for ${mainCrisis.typeInfo.label} in ${mainCrisis.location}. Signal fusion has isolated a ${mainCrisis.severity} level threat.`;
    actions = [
      `Dispatch dedicated emergency personnel to ${mainCrisis.location} immediately.`,
      `Establish safety corridor around ${mainCrisis.location} and reroute traffic.`,
      `Notify secondary response units to standby for cascade support.`
    ];
    if (activeCrises.length > 1) {
      const second = activeCrises[1];
      summary += ` Compound risk active: ${second.typeInfo.label} in ${second.location}. Multi-sector coordination activated.`;
      actions.push(`Deploy secondary units to ${second.location} to address compound risks.`);
      escalation = `WARNING: Dual threat scenario. Compound hazard risks. High resource utilization detected. High probability of evacuation delay.`;
    } else {
      escalation = `Risk projection: Severe local disruption at ${mainCrisis.location}. High probability of containment if resources arrive on schedule.`;
    }
    forecast = `Peak incident duration estimated at ${mainCrisis.prediction?.estimatedDuration || '4 hours'}. Water level sensors and traffic data indicating stabilization.`;
    confidence = mainCrisis.confidence;
  }

  return { summary, actions, escalationPrediction: escalation, confidence, forecast };
}

async function runMultiAgentReasoning(crises) {
  if (crises.length === 0) return;
  const mainCrisis = crises[0];

  let dialog = [];
  if (mainCrisis.type === 'flood') {
    dialog = [
      { agent: 'Weather Intelligence', icon: '🌧️', msg: `Severe storm cell anchored over ${mainCrisis.location}. G.T. Road and Hayatabad Phase 1 sensors register 85mm/hr precipitation. Nullah drainage capacity exceeded by 240%.` },
      { agent: 'Social Intelligence', icon: '🐦', msg: `Panic velocity is rising in ${mainCrisis.location} social grids. 38 mentions of flooded basements and stranded vehicles in the last 4 minutes. Geolocation confirmed.` },
      { agent: 'Traffic & Transit', icon: '🚗', msg: `Jamrud Road is experiencing major gridlock. Speeds are down to 4km/h. Emergency response vehicles will face at least 12-minute transit delays unless rerouted.` },
      { agent: 'Medical Coordination', icon: '🏥', msg: `${mainCrisis.location} local health clinic reports water intrusion in ground level. Advising immediate redirection of emergency ambulances to University Town medical complex.` },
      { agent: 'Resource Optimization', icon: '📦', msg: `Acknowledging all inputs. Reallocating 4 Rescue Teams and 3 Ambulances to ${mainCrisis.location}. Police Unit 12 is diverted to establish a traffic blockade on Hayatabad exits.` }
    ];
  } else if (mainCrisis.type === 'heatwave') {
    dialog = [
      { agent: 'Weather Intelligence', icon: '🔥', msg: `Extreme thermal cell detected over ${mainCrisis.location}. Ambient temp is 47.2°C, heat index is 52.8°C. Humidity is 14%. Power grid load at critical maximum.` },
      { agent: 'Social Intelligence', icon: '🐦', msg: `Rising keyword frequency for 'heat exhaustion' and 'power failure' in G.T. Road digital hubs. Casualty rate estimated to rise by 15% per hour without action.` },
      { agent: 'Medical Coordination', icon: '🏥', msg: `Hospital heatward in ${mainCrisis.location} is at 95% capacity. Commencing mobilization of portable cooling shelters and temporary field clinics.` },
      { agent: 'Resource Optimization', icon: '📦', msg: `Dispatching 5 Field Teams and 3 Water Tankers to ${mainCrisis.location}. Directing portable power generators to G.T. Road clinics to ensure life support continuity.` }
    ];
  } else {
    dialog = [
      { agent: 'Social Intelligence', icon: '🐦', msg: `Signal spike detected. Multiple citizen posts reports anomalies in ${mainCrisis.location}. Requesting IoT confirmation.` },
      { agent: 'Weather Intelligence', icon: '🌧️', msg: `Validating atmospheric sensors. Temperature and wind are steady. No current storm cell detected in the immediate vicinity.` },
      { agent: 'Traffic & Transit', icon: '🚗', msg: `Grid speeds normal in ${mainCrisis.location}. Acoustic monitoring did not capture any sudden seismic or explosive soundwaves.` },
      { agent: 'Resource Optimization', icon: '📦', msg: `Field team report is verified. Transformer explosion confirmed but fire contained. Keeping 2 rescue units on standby. No additional resource diversion needed.` }
    ];
  }

  for (const line of dialog) {
    await new Promise(r => setTimeout(r, 1200));
    broadcast('agent-chat', {
      agent: line.agent,
      icon: line.icon,
      message: line.msg,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
    });
  }
}

// Wrap existing pipeline to run AI update and Chat after complete
const originalRunPipeline = runPipeline;
runPipeline = async function () {
  await originalRunPipeline();
  await updateAICommander();
  runMultiAgentReasoning(state.crises);
};

// ==================== START SERVER ====================
loadState();
server.listen(PORT, () => {
  console.log(`\n⚡ CIRO Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/health\n`);

  // Start polling loops
  updateWeather();
  updateNews();
  updateAICommander();

  setInterval(updateWeather, 30000);
  setInterval(updateNews, 60000);
  setInterval(updateAICommander, 15000);
});
