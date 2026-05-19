// CIRO - Multi-Agent System with Trace Logging

import { CRISIS_TYPES, RESOURCES, CITY } from './data.js';

const traces = [];
export function getTraces() { return traces; }

function addTrace(agent, type, message, confidence = null, data = null) {
  const entry = { id: traces.length + 1, agent, type, message, confidence, data, timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
  traces.push(entry);
  return entry;
}

// ========== SIGNAL FUSION AGENT ==========
export class SignalFusionAgent {
  constructor() { this.name = 'Signal Fusion'; this.id = 'fusion'; }
  fuse(signals) {
    addTrace(this.id, 'trace-fusion', `Ingesting ${signals.length} raw signals for multi-source fusion...`);
    const byLocation = {};
    for (const s of signals) {
      if (s.location === 'System') continue;
      if (!byLocation[s.location]) byLocation[s.location] = [];
      byLocation[s.location].push(s);
    }
    const clusters = [];
    for (const [loc, sigs] of Object.entries(byLocation)) {
      const avgCred = sigs.reduce((a, s) => a + (s.credibility || 0.5), 0) / sigs.length;
      const sourceTypes = [...new Set(sigs.map(s => s.type))];
      const sourceDiv = sourceTypes.length / 6;
      const urgMap = { critical: 4, high: 3, medium: 2, low: 1, warning: 2.5 };
      const avgUrg = sigs.reduce((a, s) => a + (urgMap[s.urgency] || 2), 0) / sigs.length;
      const velocity = sigs.filter(s => s.type === 'social').reduce((a, s) => a + (s.mentionVelocity || 0), 0);
      const contradictions = this.detectContradictions(sigs);
      const geoConf = sigs.reduce((a, s) => a + (s.geolocationConf || 0.5), 0) / sigs.length;
      let confidence = (avgCred * 0.3 + sourceDiv * 0.25 + geoConf * 0.2 + Math.min(avgUrg / 4, 1) * 0.25);
      if (contradictions.length > 0) confidence *= 0.7;
      confidence = Math.min(confidence, 0.98);
      const sysAlerts = signals.filter(s => s.isSystemAlert);
      if (sysAlerts.length > 0) { confidence *= 0.85; addTrace(this.id, 'trace-fusion', `⚠️ Degraded mode: ${sysAlerts.length} API failure(s). Confidence reduced.`, confidence); }
      const cluster = { location: loc, signals: sigs, sourceTypes, avgCredibility: avgCred, sourceDiversity: sourceDiv, avgUrgency: avgUrg, mentionVelocity: velocity, contradictions, geoConfidence: geoConf, confidence: Math.round(confidence * 100) / 100, signalCount: sigs.length, sysAlerts };
      clusters.push(cluster);
      addTrace(this.id, 'trace-fusion', `Cluster [${loc}]: ${sigs.length} signals, ${sourceTypes.length} sources, cred=${avgCred.toFixed(2)}, urgency=${avgUrg.toFixed(1)}, contradictions=${contradictions.length}`, cluster.confidence);
    }
    addTrace(this.id, 'trace-fusion', `Fusion complete: ${clusters.length} location cluster(s) identified.`);
    return clusters;
  }
  detectContradictions(signals) {
    const contras = [];
    const texts = signals.map(s => s.text.toLowerCase());
    const hasFlood = texts.some(t => t.includes('flood') || t.includes('water logging'));
    const hasWaterMain = texts.some(t => t.includes('water main') || t.includes('burst') || t.includes('pipe'));
    if (hasFlood && hasWaterMain) contras.push({ type: 'cause-conflict', desc: 'Flood vs Water Main burst — conflicting cause hypotheses' });
    const hasDanger = texts.some(t => t.includes('explosion') || t.includes('blast'));
    const hasNormal = signals.some(s => s.type === 'sensor' && s.sensorReading < s.sensorThreshold);
    if (hasDanger && hasNormal) contras.push({ type: 'sensor-social-conflict', desc: 'Social media reports danger but sensors show normal readings' });
    return contras;
  }
}

// ========== CRISIS CLASSIFIER AGENT ==========
export class CrisisClassifierAgent {
  constructor() { this.name = 'Crisis Classifier'; this.id = 'classifier'; }
  classify(cluster) {
    addTrace(this.id, 'trace-classify', `Classifying crisis at ${cluster.location}...`);
    const allText = cluster.signals.map(s => s.text.toLowerCase()).join(' ');
    const checks = [
      { key: 'flood', words: ['flood','water logging','submerged','waterlogged','rain','nullah'], weight: 1 },
      { key: 'heatwave', words: ['heat','hot','temperature','collapsed','heat exhaustion','heatwave'], weight: 1 },
      { key: 'accident', words: ['accident','crash','collision','injured','casualties'], weight: 1 },
      { key: 'powerOutage', words: ['power','electricity','outage','blackout','generator'], weight: 0.8 },
      { key: 'protest', words: ['protest','rally','demonstration','riot'], weight: 1 },
      { key: 'disease', words: ['disease','sick','outbreak','fever','epidemic'], weight: 1 },
      { key: 'waterMain', words: ['water main','burst pipe','pipe visible','broken pipe'], weight: 1.2 },
    ];
    const scores = {};
    for (const c of checks) scores[c.key] = c.words.reduce((a, w) => a + (allText.split(w).length - 1) * c.weight, 0);
    for (const s of cluster.signals.filter(s => s.type === 'sensor')) {
      if (s.text.toLowerCase().includes('water level') && s.sensorReading > s.sensorThreshold) scores.flood = (scores.flood || 0) + 3;
      if (s.text.toLowerCase().includes('temperature') && s.sensorReading > s.sensorThreshold) scores.heatwave = (scores.heatwave || 0) + 3;
      if (s.text.toLowerCase().includes('gas')) scores.infrastructure = (scores.infrastructure || 0) + 3;
    }
    let maxKey = 'infrastructure', maxVal = 0;
    for (const [k, v] of Object.entries(scores)) { if (v > maxVal) { maxVal = v; maxKey = k; } }
    const type = maxKey;
    const score = Math.min(maxVal / 10, 1);
    let altHypothesis = null;
    if (cluster.contradictions.length > 0) {
      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 1 && sorted[1][1] > 0) {
        altHypothesis = { type: sorted[1][0], score: Math.min(sorted[1][1] / 10, 1) };
        addTrace(this.id, 'trace-classify', `⚠️ Contradiction: Primary=${CRISIS_TYPES[type]?.label || type}, Alt=${CRISIS_TYPES[altHypothesis.type]?.label || altHypothesis.type}`, score);
      }
    }
    const sev = this.calcSeverity(cluster);
    const result = { id: 'CR-' + Date.now().toString(36).toUpperCase(), type, typeInfo: CRISIS_TYPES[type] || CRISIS_TYPES.infrastructure, confidence: Math.round(cluster.confidence * score * 100) / 100, severity: sev.level, severityScore: sev.score, location: cluster.location, coords: CITY.sectors[cluster.location] || { lat: 34.0151, lng: 71.5249 }, altHypothesis, contradictions: cluster.contradictions, signalCount: cluster.signalCount, sourceTypes: cluster.sourceTypes, timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'active', cluster };
    addTrace(this.id, 'trace-classify', `✅ ${result.typeInfo.icon} ${result.typeInfo.label} at ${cluster.location} | Severity: ${sev.level.toUpperCase()} | Confidence: ${(result.confidence * 100).toFixed(0)}%`, result.confidence);
    return result;
  }
  calcSeverity(cluster) {
    let score = cluster.avgUrgency / 4 + Math.min(cluster.signalCount / 10, 0.3) + cluster.sourceDiversity * 0.2;
    if (cluster.signals.some(s => s.type === 'sensor' && s.sensorReading > s.sensorThreshold)) score += 0.15;
    score = Math.min(score, 1);
    return { score: Math.round(score * 100) / 100, level: score > 0.8 ? 'critical' : score > 0.6 ? 'high' : score > 0.35 ? 'medium' : 'low' };
  }
}

// ========== SEVERITY PREDICTOR AGENT ==========
export class SeverityPredictorAgent {
  constructor() { this.name = 'Severity Predictor'; this.id = 'predictor'; }
  predict(crisis) {
    addTrace(this.id, 'trace-predict', `Predicting evolution for ${crisis.typeInfo.label} at ${crisis.location}...`);
    const sector = CITY.sectors[crisis.location] || { pop: 30000 };
    const mult = { critical: 1, high: 0.7, medium: 0.4, low: 0.15 }[crisis.severity] || 0.3;
    const prediction = { affectedRadius: Math.round((0.5 + mult * 2.5) * 10) / 10, affectedPopulation: Math.round(sector.pop * mult), estimatedDuration: Math.round(1 + mult * 8) + ' hours', peakImpactTime: Math.round(0.5 + mult * 2) + ' hours from now', spreadRisk: mult > 0.6 ? 'HIGH' : mult > 0.3 ? 'MODERATE' : 'LOW', uncertaintyRange: `±${Math.round((1 - crisis.confidence) * 30)}%`, vulnerablePopulation: Math.round(sector.pop * mult * 0.25), cascadeRisk: crisis.severity === 'critical' ? ['Traffic gridlock', 'Hospital overflow', 'Power cascade'] : crisis.severity === 'high' ? ['Traffic disruption', 'Service strain'] : ['Minor disruption'] };
    addTrace(this.id, 'trace-predict', `📊 Radius=${prediction.affectedRadius}km, Pop=${prediction.affectedPopulation.toLocaleString()}, Duration=${prediction.estimatedDuration}, Spread=${prediction.spreadRisk}`, crisis.confidence);
    return { ...crisis, prediction };
  }
}

// ========== RESOURCE ALLOCATOR AGENT ==========
export class ResourceAllocatorAgent {
  constructor() { this.name = 'Resource Allocator'; this.id = 'allocator'; this.allocations = []; }
  allocate(crises, resources) {
    addTrace(this.id, 'trace-allocate', `Optimizing allocation for ${crises.length} active crisis/crises...`);
    const sorted = [...crises].sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0));
    const allocs = [];
    const available = {};
    for (const [k, v] of Object.entries(resources)) available[k] = v.available;
    for (const crisis of sorted) {
      const needs = this.assessNeeds(crisis);
      const allocation = { crisisId: crisis.id, location: crisis.location, type: crisis.type, resources: {}, tradeoffs: [] };
      for (const [res, qty] of Object.entries(needs)) {
        const avail = available[res] || 0;
        const assigned = Math.min(qty, avail);
        if (assigned > 0) { allocation.resources[res] = assigned; available[res] -= assigned; }
        if (assigned < qty) allocation.tradeoffs.push(`${resources[res]?.label || res}: need ${qty}, got ${assigned}`);
      }
      allocs.push(allocation);
      const resStr = Object.entries(allocation.resources).map(([k, v]) => `${resources[k]?.icon || ''} ${v} ${resources[k]?.label || k}`).join(', ');
      addTrace(this.id, 'trace-allocate', `📦 ${crisis.location} (${crisis.severity}): ${resStr || 'No resources'}`, null);
      if (allocation.tradeoffs.length > 0) addTrace(this.id, 'trace-allocate', `⚖️ Trade-offs: ${allocation.tradeoffs.join('; ')}`);
    }
    for (const [k, v] of Object.entries(available)) resources[k].available = v;
    this.allocations = allocs;
    addTrace(this.id, 'trace-allocate', `✅ Allocation complete across ${allocs.length} crisis/crises.`);
    return allocs;
  }
  assessNeeds(crisis) {
    const base = { flood: { ambulances: 3, rescue: 4, police: 3, waterTankers: 2, fieldTeams: 4, drones: 2 }, heatwave: { ambulances: 4, fieldTeams: 5, waterTankers: 3, shelters: 2, generators: 3 }, accident: { ambulances: 4, police: 5, rescue: 2, fieldTeams: 2 }, infrastructure: { rescue: 3, police: 2, fieldTeams: 3, generators: 2 }, powerOutage: { generators: 5, fieldTeams: 3, police: 2 }, protest: { police: 8, ambulances: 2, fieldTeams: 3 }, disease: { ambulances: 5, fieldTeams: 6, shelters: 1 }, waterMain: { rescue: 2, waterTankers: 4, fieldTeams: 3, police: 2 } };
    const needs = base[crisis.type] || base.infrastructure;
    const mult = crisis.severity === 'critical' ? 1.5 : crisis.severity === 'high' ? 1.2 : 1;
    const scaled = {};
    for (const [k, v] of Object.entries(needs)) scaled[k] = Math.ceil(v * mult);
    return scaled;
  }
}

// ========== IMPACT SIMULATOR AGENT ==========
export class ImpactSimulatorAgent {
  constructor() { this.name = 'Impact Simulator'; this.id = 'simulator'; }
  simulate(crisis, allocation) {
    addTrace(this.id, 'trace-simulate', `Simulating response for ${crisis.location}...`);
    const actions = [];
    const type = crisis.type;
    if (['flood', 'accident', 'waterMain', 'protest'].includes(type)) {
      actions.push({ action: 'Traffic Rerouting', icon: '🚗', before: { desc: `Severe congestion through ${crisis.location}`, metric: 'Travel: 45+ min' }, after: { desc: `Diverted via alternate routes`, metric: 'Travel: ~20 min' }, improvement: '55% travel time reduction', cost: '+30% load on bypass roads', sideEffects: ['Minor bypass congestion', 'Delivery delays'] });
    }
    if (allocation?.resources) {
      const resNames = Object.entries(allocation.resources).map(([k, v]) => `${v} ${RESOURCES[k]?.label || k}`).join(', ');
      actions.push({ action: 'Emergency Dispatch', icon: '🚨', before: { desc: 'No resources on-site', metric: 'Response: N/A' }, after: { desc: `Deployed: ${resNames}`, metric: `ETA: ${8 + Math.floor(Math.random() * 7)} min` }, improvement: 'Full area coverage', cost: `${Object.values(allocation.resources).reduce((a, b) => a + b, 0)} units deployed`, sideEffects: ['Reduced reserve capacity'] });
    }
    if (['flood', 'heatwave', 'accident', 'disease'].includes(type)) {
      actions.push({ action: 'Hospital Preparation', icon: '🏥', before: { desc: 'Normal operations', metric: 'Capacity: 72%' }, after: { desc: 'Emergency ward activated', metric: 'Reserved 15% for crisis' }, improvement: 'Ready for 50 patients', cost: '12 procedures deferred', sideEffects: ['Delayed elective surgeries'] });
    }
    actions.push({ action: 'Public Alert', icon: '📢', before: { desc: 'Public unaware', metric: 'Info gap: HIGH' }, after: { desc: `SMS/radio/social alert for ${crisis.location}`, metric: 'Coverage: ~85%' }, improvement: 'Population can take action', cost: 'SMS costs, potential anxiety', sideEffects: ['Increased helpline calls'] });
    for (const a of actions) addTrace(this.id, 'trace-simulate', `🧪 ${a.icon} ${a.action}: ${a.improvement}`);
    addTrace(this.id, 'trace-simulate', `✅ ${actions.length} response actions modeled.`);
    return { crisisId: crisis.id, location: crisis.location, actions };
  }
}

// ========== STAKEHOLDER NOTIFIER AGENT ==========
export class StakeholderNotifierAgent {
  constructor() { this.name = 'Stakeholder Notifier'; this.id = 'notifier'; }
  notify(crisis) {
    addTrace(this.id, 'trace-notify', `Generating notifications for ${crisis.typeInfo.label} at ${crisis.location}...`);
    const loc = crisis.location, type = crisis.typeInfo.label, sev = crisis.severity.toUpperCase();
    const pop = crisis.prediction?.affectedPopulation?.toLocaleString() || 'Unknown';
    const messages = [
      { recipient: 'Public (SMS/Radio)', icon: '📱', priority: 'URGENT', priorityColor: '#ff3d57', body: `⚠️ ${sev} ALERT: ${type} in ${loc}. Avoid area. Emergency: 1122.` },
      { recipient: 'Emergency Services', icon: '🚒', priority: 'CRITICAL', priorityColor: '#ff3d57', body: `DISPATCH — ${type} at ${loc}\nSeverity: ${sev} | Affected: ${pop}\nCoordinate route clearance. Report every 15 min.` },
      { recipient: 'Hospitals (LRH, KTH, HMC)', icon: '🏥', priority: 'HIGH', priorityColor: '#ffa726', body: `MASS CASUALTY ADVISORY — ${type} at ${loc}\nPrepare emergency ward. Expected: 10-30 patients.` },
      { recipient: 'Utility Company', icon: '🔌', priority: 'HIGH', priorityColor: '#ffa726', body: `INFRASTRUCTURE ALERT — ${type} at ${loc}\nDispatch inspection team. Coordinate with emergency services.` },
      { recipient: 'Transport Authority', icon: '🚌', priority: 'MEDIUM', priorityColor: '#ffd54f', body: `TRAFFIC ADVISORY — Implement rerouting for ${loc}. Suspend transit through affected zone.` },
      { recipient: 'Command Center / Media', icon: '📺', priority: 'INFO', priorityColor: '#42a5f5', body: `SITREP — ${type} at ${loc}\nSeverity: ${sev} | Confidence: ${(crisis.confidence * 100).toFixed(0)}%\nNext update in 30 min.` }
    ];
    addTrace(this.id, 'trace-notify', `✅ ${messages.length} stakeholder notifications generated.`);
    return messages;
  }
}

// ========== VERIFICATION AGENT ==========
export class VerificationAgent {
  constructor() { this.name = 'Verification Agent'; this.id = 'verifier'; }
  verify(crisis) {
    addTrace(this.id, 'trace-verify', `Verification protocol for ${crisis.location}...`);
    const result = { crisisId: crisis.id, verified: true, action: 'confirm', details: '' };
    if (crisis.contradictions && crisis.contradictions.length > 0) {
      const contra = crisis.contradictions[0];
      if (contra.type === 'cause-conflict') {
        const fieldVerified = crisis.cluster?.signals?.find(s => s.type === 'field' && s.verified);
        if (fieldVerified && (fieldVerified.text.toLowerCase().includes('water main') || fieldVerified.text.toLowerCase().includes('burst'))) {
          result.action = 'reclassify'; result.newType = 'waterMain';
          result.details = 'Field confirms water main burst, NOT flooding. Reclassifying and retracting flood alert.';
          addTrace(this.id, 'trace-verify', `⚠️ RECLASSIFICATION: → Water Main Burst. Alert retracted.`);
          addTrace(this.id, 'trace-verify', `📢 RETRACTION: Flood alert for ${crisis.location} RETRACTED. Utility notified.`);
        } else {
          result.action = 'escalate'; result.details = 'Conflicting signals. Dispatching verification team.';
          addTrace(this.id, 'trace-verify', `⏳ Escalation: field team dispatched for verification.`);
        }
      } else if (contra.type === 'sensor-social-conflict') {
        const fieldVerified = crisis.cluster?.signals?.find(s => s.type === 'field' && s.verified);
        if (fieldVerified) {
          result.action = 'downgrade'; result.details = 'Social media exaggerated. Actual: minor incident.';
          addTrace(this.id, 'trace-verify', `✅ FALSE ALARM: Social reports exaggerated. Downgrading.`);
          addTrace(this.id, 'trace-verify', `📢 CORRECTION: Alert for ${crisis.location} based on unverified social media. Actual incident minor.`);
        } else {
          result.action = 'escalate'; result.details = 'Social vs sensor conflict. Awaiting field verification.';
          addTrace(this.id, 'trace-verify', `⏳ Conflicting data. Awaiting verification.`);
        }
      }
    } else {
      addTrace(this.id, 'trace-verify', `✅ No contradictions. Classification confirmed.`);
    }
    return result;
  }
}
