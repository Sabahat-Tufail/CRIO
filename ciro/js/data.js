// CIRO - Mock Data, Signal Generators, Scenarios & Resources

export const CITY = {
  name: 'Peshawar',
  center: [34.0151, 71.5249],
  zoom: 12,
  sectors: {
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
  }
};

export const RESOURCES = {
  ambulances:    { icon: '🚑', total: 24, available: 24, label: 'Ambulances', color: '#ff3d57' },
  police:        { icon: '🚔', total: 40, available: 40, label: 'Police Units', color: '#42a5f5' },
  rescue:        { icon: '🚒', total: 16, available: 16, label: 'Rescue Teams', color: '#ffa726' },
  shelters:      { icon: '🏠', total: 8,  available: 8,  label: 'Shelters', color: '#4caf50' },
  generators:    { icon: '⚡', total: 20, available: 20, label: 'Generators', color: '#ffd54f' },
  waterTankers:  { icon: '💧', total: 12, available: 12, label: 'Water Tankers', color: '#26c6da' },
  fieldTeams:    { icon: '👷', total: 30, available: 30, label: 'Field Teams', color: '#ab47bc' },
  drones:        { icon: '📡', total: 10, available: 10, label: 'Survey Drones', color: '#78909c' }
};

export const CRISIS_TYPES = {
  flood:        { icon: '🌊', label: 'Urban Flooding', color: '#42a5f5' },
  heatwave:     { icon: '🔥', label: 'Heat Emergency', color: '#ff7043' },
  accident:     { icon: '💥', label: 'Major Accident', color: '#ff3d57' },
  infrastructure:{ icon: '🏗️', label: 'Infrastructure Failure', color: '#ffa726' },
  powerOutage:  { icon: '⚡', label: 'Power Outage', color: '#ffd54f' },
  protest:      { icon: '📢', label: 'Public Disorder', color: '#ab47bc' },
  disease:      { icon: '🦠', label: 'Disease Cluster', color: '#4caf50' },
  waterMain:    { icon: '💧', label: 'Water Main Burst', color: '#26c6da' }
};

let signalId = 0;
const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

function extractTags(text) {
  const kw = ['flood','rain','water','heat','hot','accident','crash','fire','power','outage','protest','sick','blocked','stuck','help','emergency','road','broken'];
  return kw.filter(k => text.toLowerCase().includes(k));
}

export function generateSocialSignal(text, location, urgency = 'medium') {
  return { id: ++signalId, type: 'social', icon: '🐦', source: 'Social Media', text, location, urgency, timestamp: ts(), credibility: urgency === 'high' ? 0.6 : 0.45, geolocationConf: 0.5 + Math.random() * 0.3, mentionVelocity: Math.floor(5 + Math.random() * 50), tags: extractTags(text) };
}
export function generateWeatherSignal(condition, location, severity = 'warning') {
  return { id: ++signalId, type: 'weather', icon: '🌧️', source: 'Weather API', text: condition, location, urgency: severity === 'extreme' ? 'critical' : severity, timestamp: ts(), credibility: 0.92, geolocationConf: 0.95, tags: ['weather', severity] };
}
export function generateTrafficSignal(desc, location, congestion = 70) {
  return { id: ++signalId, type: 'traffic', icon: '🚗', source: 'Traffic API', text: desc, location, urgency: congestion > 85 ? 'high' : 'medium', timestamp: ts(), credibility: 0.88, geolocationConf: 0.9, congestionLevel: congestion, tags: ['traffic', 'congestion'] };
}
export function generateEmergencySignal(desc, location, callFreq = 5) {
  return { id: ++signalId, type: 'emergency', icon: '📞', source: 'Emergency Calls', text: desc, location, urgency: callFreq > 10 ? 'critical' : callFreq > 5 ? 'high' : 'medium', timestamp: ts(), credibility: 0.85, callFrequency: callFreq, geolocationConf: 0.7, tags: ['emergency', 'calls'] };
}
export function generateSensorSignal(desc, location, reading, threshold) {
  const exceeded = reading > threshold;
  return { id: ++signalId, type: 'sensor', icon: '📊', source: 'IoT Sensor', text: `${desc} — Reading: ${reading} (Threshold: ${threshold})`, location, urgency: exceeded ? 'high' : 'low', timestamp: ts(), credibility: 0.95, geolocationConf: 0.98, sensorReading: reading, sensorThreshold: threshold, tags: ['sensor', exceeded ? 'exceeded' : 'normal'] };
}
export function generateFieldReport(desc, location, verified = false) {
  return { id: ++signalId, type: 'field', icon: '📋', source: 'Field Report', text: desc, location, urgency: 'high', timestamp: ts(), credibility: verified ? 0.9 : 0.7, geolocationConf: 0.85, verified, tags: ['field', verified ? 'verified' : 'unverified'] };
}

export const SCENARIOS = [
  {
    id: 'dual-crisis', name: 'Dual Crisis: Flood + Heatwave', icon: '🌊🔥',
    desc: 'Hayatabad Phase 1 flooding with conflicting water-main report, simultaneous heat emergency in G.T. Road.',
    tags: ['multi-crisis', 'conflicting signals', 'resource competition'],
    signals: [
      () => generateSocialSignal('OMG streets are flooded in Hayatabad Phase 1 Markaz! Water everywhere, cars stuck. #PeshawarFlood', 'Hayatabad Phase 1', 'high'),
      () => generateSocialSignal('Heavy rain causing water logging near Hayatabad Phase 1. Roads impassable!', 'Hayatabad Phase 1', 'high'),
      () => generateWeatherSignal('EXTREME RAINFALL WARNING: 85mm/hr recorded. Flash flood risk HIGH for University Town, Hayatabad.', 'Hayatabad Phase 1', 'extreme'),
      () => generateTrafficSignal('Severe congestion on Jamrud Road near Hayatabad. Speed dropped to 5km/h.', 'Hayatabad Phase 1', 92),
      () => generateEmergencySignal('Multiple calls: flooding and stranded vehicles in Hayatabad. 3 calls mention elderly trapped.', 'Hayatabad Phase 1', 14),
      () => generateSensorSignal('Water level sensor Hayatabad Nullah', 'Hayatabad Phase 1', 4.2, 2.5),
      () => generateFieldReport('CONFLICTING: Field team reports burst water main at Hayatabad, NOT rainfall flooding. Large pipe visible.', 'Hayatabad Phase 1', false),
      () => generateSocialSignal('So hot in G.T. Road! Neighbor collapsed. No electricity since morning. #HeatWave', 'G.T. Road', 'high'),
      () => generateWeatherSignal('HEAT ADVISORY: Temperature 46°C in G.T. Road, Ring Road. Heat index dangerously high.', 'G.T. Road', 'extreme'),
      () => generateEmergencySignal('Rising heat-related calls from G.T. Road. 6 heat exhaustion, 2 elderly collapses.', 'G.T. Road', 8),
      () => generateSensorSignal('Temperature sensor G.T. Road residential', 'G.T. Road', 47.2, 42),
      () => generateSocialSignal('No water, no electricity in G.T. Road! People dying in heat! #HeatEmergency', 'G.T. Road', 'critical'),
    ]
  },
  {
    id: 'conflicting-signals', name: 'Conflicting Signal Analysis', icon: '⚠️🔍',
    desc: 'Social media reports explosion in Khyber Road but sensors show nothing.',
    tags: ['false positive', 'verification', 'misinformation'],
    signals: [
      () => generateSocialSignal('BREAKING: Huge explosion in Khyber Road! Smoke visible! 🚨🚨', 'Khyber Road', 'critical'),
      () => generateSocialSignal('Explosion in Khyber Road! I heard a loud bang!', 'Khyber Road', 'critical'),
      () => generateSocialSignal('RT: Massive blast in Khyber Road. Unconfirmed casualties.', 'Khyber Road', 'critical'),
      () => generateSensorSignal('Seismic/acoustic sensor Khyber Road', 'Khyber Road', 0.3, 2.0),
      () => generateSensorSignal('Air quality sensor Khyber Road', 'Khyber Road', 45, 150),
      () => generateTrafficSignal('Normal traffic flow in Khyber Road. No anomalies.', 'Khyber Road', 35),
      () => generateEmergencySignal('2 calls about loud noise in Khyber Road. Callers uncertain.', 'Khyber Road', 2),
      () => generateFieldReport('Field team: VERIFIED transformer explosion at grid station. Small fire contained. No casualties. Social media exaggerated.', 'Khyber Road', true),
    ]
  },
  {
    id: 'api-failure', name: 'Degraded Mode: API Failures', icon: '🔌❌',
    desc: 'Weather and traffic APIs go down during an emerging crisis.',
    tags: ['robustness', 'fallback', 'degraded mode'],
    signals: [
      () => generateSocialSignal('Roads flooding near Saddar Markaz. Rain non-stop for 3 hours!', 'Saddar', 'high'),
      () => generateSocialSignal('Water entering shops in Saddar! Call rescue 1122!', 'Saddar', 'critical'),
      () => generateEmergencySignal('Increased calls from Saddar. Waterlogging and power failures.', 'Saddar', 9),
      () => ({ id: ++signalId, type: 'system', icon: '⚠️', source: 'System Alert', text: 'Weather API TIMEOUT — Using cached forecast from 2hrs ago.', location: 'System', urgency: 'warning', timestamp: ts(), credibility: 0.5, tags: ['api-failure'], isSystemAlert: true }),
      () => ({ id: ++signalId, type: 'system', icon: '⚠️', source: 'System Alert', text: 'Traffic API rate limit exceeded. Using historical patterns.', location: 'System', urgency: 'warning', timestamp: ts(), credibility: 0.4, tags: ['api-failure'], isSystemAlert: true }),
      () => generateSensorSignal('Water level sensor Saddar drain', 'Saddar', 3.8, 2.5),
      () => generateFieldReport('Confirmed waterlogging in Saddar Markaz. Depth ~2ft in low areas.', 'Saddar', true),
    ]
  },
  {
    id: 'cascade-evacuation', name: 'Evacuation Cascade', icon: '🚨🚗',
    desc: 'Public alert causes evacuation congestion requiring staged response.',
    tags: ['evacuation', 'congestion cascade', 'staged response'],
    signals: [
      () => generateSensorSignal('Gas leak detector Warsak Road industrial', 'Warsak Road', 850, 200),
      () => generateEmergencySignal('URGENT: Gas smell in Warsak Road area. Workers evacuating.', 'Warsak Road', 18),
      () => generateSocialSignal('Gas leak in Warsak Road! Factory area evacuating! Strong chemical smell!', 'Warsak Road', 'critical'),
      () => generateFieldReport('HAZMAT confirms gas leak at Warsak Road. Evacuation radius: 1.5km.', 'Warsak Road', true),
      () => generateTrafficSignal('CRITICAL congestion on Warsak Road exits. Emergency vehicles blocked.', 'Warsak Road', 98),
      () => generateSocialSignal('Stuck in traffic leaving Warsak Road! Nobody moving!', 'Warsak Road', 'high'),
      () => generateTrafficSignal('Congestion spreading to University Town and Khyber Bazaar. Travel times 4x normal.', 'University Town', 85),
    ]
  },
  {
    id: 'cinematic-hackathon', name: '🏆 Hackathon Cinematic Demo', icon: '🎬👑',
    desc: 'An ultra-immersive smart city crisis simulation. Shows full timeline of heavy storm -> social panic -> AI commander directives -> animated dispatch -> containment.',
    tags: ['cinematic', 'hackathon-winner', 'all-features'],
    signals: [
      () => generateWeatherSignal('URGENT: Torrential cloudburst warning for Peshawar Hayatabad Phase 1. Extreme precipitation expected.', 'Hayatabad Phase 1', 'extreme'),
      () => generateSocialSignal('Winds are picking up in Hayatabad, sky is pitch black! Extreme rain starting! #PeshawarStorm', 'Hayatabad Phase 1', 'medium'),
      () => generateSensorSignal('Hayatabad Nullah Drainage Sensor', 'Hayatabad Phase 1', 1.8, 2.5),
      () => generateEmergencySignal('Citizen report: Hayatabad sector streets are starting to accumulate heavy water.', 'Hayatabad Phase 1', 4),
      () => generateSocialSignal('OMG Hayatabad Markaz is completely flooded! Cars are submerged! People are trapped!', 'Hayatabad Phase 1', 'high'),
      () => generateTrafficSignal('Jamrud Road near Hayatabad is completely gridlocked. Congestion 99%.', 'Hayatabad Phase 1', 98),
      () => generateSensorSignal('Hayatabad Nullah Drainage Sensor', 'Hayatabad Phase 1', 4.8, 2.5),
      () => generateSocialSignal('Flash flooding has hit Hayatabad houses! Basement apartments are filled with water! We need help!', 'Hayatabad Phase 1', 'critical'),
      () => generateFieldReport('HAZMAT & First Responder: Rapid boundary expansion of waterlogging observed. Nullah overflowing. Need immediate evacuations.', 'Hayatabad Phase 1', true)
    ]
  }
];

export const AGENTS = [
  { id: 'fusion', name: 'Signal Fusion', icon: '🔗', status: 'idle' },
  { id: 'classifier', name: 'Crisis Classifier', icon: '🏷️', status: 'idle' },
  { id: 'predictor', name: 'Severity Predictor', icon: '📈', status: 'idle' },
  { id: 'allocator', name: 'Resource Allocator', icon: '📦', status: 'idle' },
  { id: 'simulator', name: 'Impact Simulator', icon: '🧪', status: 'idle' },
  { id: 'notifier', name: 'Stakeholder Notifier', icon: '📢', status: 'idle' },
  { id: 'verifier', name: 'Verification Agent', icon: '🔍', status: 'idle' },
];
