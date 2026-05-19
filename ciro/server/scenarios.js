// Server-side scenarios - generates signal objects for each scenario
let signalId = 1000;
const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

function social(text, location, urgency = 'medium') {
  return { id: ++signalId, type: 'social', icon: '🐦', source: 'Social Media', text, location, urgency, timestamp: ts(), credibility: urgency === 'high' ? 0.6 : 0.45, geolocationConf: 0.5 + Math.random() * 0.3, mentionVelocity: Math.floor(5 + Math.random() * 50), tags: [] };
}
function weather(text, location, severity = 'warning') {
  return { id: ++signalId, type: 'weather', icon: '🌧️', source: 'Weather API', text, location, urgency: severity === 'extreme' ? 'critical' : severity, timestamp: ts(), credibility: 0.92, geolocationConf: 0.95, tags: ['weather'] };
}
function traffic(text, location, congestion = 70) {
  return { id: ++signalId, type: 'traffic', icon: '🚗', source: 'Traffic API', text, location, urgency: congestion > 85 ? 'high' : 'medium', timestamp: ts(), credibility: 0.88, geolocationConf: 0.9, tags: ['traffic'] };
}
function emergency(text, location, freq = 5) {
  return { id: ++signalId, type: 'emergency', icon: '📞', source: 'Emergency Calls', text, location, urgency: freq > 10 ? 'critical' : freq > 5 ? 'high' : 'medium', timestamp: ts(), credibility: 0.85, geolocationConf: 0.7, tags: ['emergency'] };
}
function sensor(text, location, reading, threshold) {
  return { id: ++signalId, type: 'sensor', icon: '📊', source: 'IoT Sensor', text: `${text} — Reading: ${reading} (Threshold: ${threshold})`, location, urgency: reading > threshold ? 'high' : 'low', timestamp: ts(), credibility: 0.95, geolocationConf: 0.98, sensorReading: reading, sensorThreshold: threshold, tags: ['sensor'] };
}
function field(text, location, verified = false) {
  return { id: ++signalId, type: 'field', icon: '📋', source: 'Field Report', text, location, urgency: 'high', timestamp: ts(), credibility: verified ? 0.9 : 0.7, geolocationConf: 0.85, verified, tags: ['field'] };
}

const scenarios = {
  'dual-crisis': {
    name: 'Dual Crisis: Flood + Heatwave',
    signals: [
      () => social('Streets flooded in Hayatabad Phase 1 Markaz! Water everywhere!', 'Hayatabad Phase 1', 'high'),
      () => social('Heavy rain causing water logging near Hayatabad Phase 1.', 'Hayatabad Phase 1', 'high'),
      () => weather('EXTREME RAINFALL: 85mm/hr. Flash flood risk HIGH for Hayatabad Phase 1.', 'Hayatabad Phase 1', 'extreme'),
      () => traffic('Severe congestion near Hayatabad. Speed 5km/h.', 'Hayatabad Phase 1', 92),
      () => emergency('Multiple flood calls from Hayatabad. Elderly trapped.', 'Hayatabad Phase 1', 14),
      () => sensor('Water level sensor Hayatabad Nullah', 'Hayatabad Phase 1', 4.2, 2.5),
      () => field('CONFLICTING: Burst water main at Hayatabad, NOT flood. Pipe visible.', 'Hayatabad Phase 1', false),
      () => social('So hot in G.T. Road! Neighbor collapsed. No electricity!', 'G.T. Road', 'high'),
      () => weather('HEAT ADVISORY: 46°C in G.T. Road. Dangerously high.', 'G.T. Road', 'extreme'),
      () => emergency('Heat-related calls from G.T. Road. 6 heat exhaustion cases.', 'G.T. Road', 8),
      () => sensor('Temperature sensor G.T. Road', 'G.T. Road', 47.2, 42),
      () => social('No water, no electricity in G.T. Road! People dying!', 'G.T. Road', 'critical'),
    ]
  },
  'conflicting-signals': {
    name: 'Conflicting Signal Analysis',
    signals: [
      () => social('BREAKING: Explosion in Khyber Road! Smoke visible!', 'Khyber Road', 'critical'),
      () => social('Explosion in Khyber Road! Loud bang!', 'Khyber Road', 'critical'),
      () => social('Massive blast in Khyber Road. Unconfirmed casualties.', 'Khyber Road', 'critical'),
      () => sensor('Seismic sensor Khyber Road', 'Khyber Road', 0.3, 2.0),
      () => sensor('Air quality Khyber Road', 'Khyber Road', 45, 150),
      () => traffic('Normal traffic in Khyber Road.', 'Khyber Road', 35),
      () => emergency('2 calls about loud noise. Callers uncertain.', 'Khyber Road', 2),
      () => field('VERIFIED: Transformer explosion. Small fire contained. No casualties.', 'Khyber Road', true),
    ]
  },
  'api-failure': {
    name: 'Degraded Mode: API Failures',
    signals: [
      () => social('Roads flooding near Saddar!', 'Saddar', 'high'),
      () => social('Water entering shops in Saddar!', 'Saddar', 'critical'),
      () => emergency('Increased calls from Saddar. Waterlogging.', 'Saddar', 9),
      () => ({ id: ++signalId, type: 'system', icon: '⚠️', source: 'System', text: 'Weather API TIMEOUT.', location: 'System', urgency: 'warning', timestamp: ts(), credibility: 0.5, isSystemAlert: true, tags: [] }),
      () => ({ id: ++signalId, type: 'system', icon: '⚠️', source: 'System', text: 'Traffic API rate limited.', location: 'System', urgency: 'warning', timestamp: ts(), credibility: 0.4, isSystemAlert: true, tags: [] }),
      () => sensor('Water level Saddar', 'Saddar', 3.8, 2.5),
      () => field('Confirmed waterlogging Saddar Markaz. Depth ~2ft.', 'Saddar', true),
    ]
  },
  'cascade-evacuation': {
    name: 'Evacuation Cascade',
    signals: [
      () => sensor('Gas leak Warsak Road industrial', 'Warsak Road', 850, 200),
      () => emergency('Gas smell Warsak Road. Workers evacuating.', 'Warsak Road', 18),
      () => social('Gas leak Warsak Road! Evacuating!', 'Warsak Road', 'critical'),
      () => field('HAZMAT confirms gas leak. Evacuation 1.5km.', 'Warsak Road', true),
      () => traffic('CRITICAL congestion Warsak Road exits.', 'Warsak Road', 98),
      () => social('Stuck in Warsak Road traffic!', 'Warsak Road', 'high'),
      () => traffic('Congestion spreading to University Town, Khyber Bazaar.', 'University Town', 85),
    ]
  },
  'cinematic-hackathon': {
    name: '🏆 Hackathon Cinematic Demo',
    signals: [
      () => weather('URGENT: Torrential cloudburst warning for Peshawar Hayatabad Phase 1. Extreme precipitation expected.', 'Hayatabad Phase 1', 'extreme'),
      () => social('Winds are picking up in Hayatabad, sky is pitch black! Extreme rain starting! #PeshawarStorm', 'Hayatabad Phase 1', 'medium'),
      () => sensor('Hayatabad Nullah Drainage Sensor', 'Hayatabad Phase 1', 1.8, 2.5),
      () => emergency('Citizen report: Hayatabad sector streets are starting to accumulate heavy water.', 'Hayatabad Phase 1', 4),
      () => social('OMG Hayatabad Markaz is completely flooded! Cars are submerged! People are trapped!', 'Hayatabad Phase 1', 'high'),
      () => traffic('Jamrud Road near Hayatabad is completely gridlocked. Congestion 99%.', 'Hayatabad Phase 1', 98),
      () => sensor('Hayatabad Nullah Drainage Sensor', 'Hayatabad Phase 1', 4.8, 2.5),
      () => social('Flash flooding has hit Hayatabad houses! Basement apartments are filled with water! We need help!', 'Hayatabad Phase 1', 'critical'),
      () => field('HAZMAT & First Responder: Rapid boundary expansion of waterlogging observed. Nullah overflowing. Need immediate evacuations.', 'Hayatabad Phase 1', true)
    ]
  }
};

export default scenarios;
