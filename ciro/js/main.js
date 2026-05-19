// CIRO - Main Entry Point & UI Controller

import { CITY, SCENARIOS, AGENTS, RESOURCES as RES_DEFS } from './data.js';
import { CIROEngine } from './engine.js';

const engine = new CIROEngine();
let map, markers = [], circles = [];
let resourceChart = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initLoadingScreen();
  // Show app immediately (loading screen overlays it with z-index)
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('app').style.opacity = '0';

  setTimeout(() => {
    try {
      initMap();
      initResourceChart();
      initAgentGrid();
      initResourceList();
      initTabs();
      initScenarioModal();
      initNotificationPanel();
      initMobileNav();
      initModalCloses();
      wireEngine();
    } catch (err) {
      console.error('CIRO Init Error:', err);
    }
    hideLoading();
  }, 800);
});

// ==================== LOADING SCREEN ====================
function initLoadingScreen() {
  const bar = document.getElementById('loading-bar-fill');
  const status = document.getElementById('loading-status');
  const msgs = ['Initializing agent network...', 'Connecting signal sources...', 'Loading map data...', 'Calibrating sensors...', 'System ready.'];
  let p = 0;
  const iv = setInterval(() => {
    p += 20;
    bar.style.width = p + '%';
    status.textContent = msgs[Math.min(Math.floor(p / 25), msgs.length - 1)];
    if (p >= 100) clearInterval(iv);
  }, 400);
}

function hideLoading() {
  setTimeout(() => {
    document.getElementById('app').style.opacity = '1';
    document.getElementById('app').style.transition = 'opacity 0.5s';
    document.getElementById('loading-screen').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      if (map) map.invalidateSize();
    }, 600);
  }, 1800);
}

// ==================== MAP ====================
function initMap() {
  map = L.map('map', { zoomControl: false, attributionControl: false }).setView(CITY.center, CITY.zoom);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd'
  }).addTo(map);
  for (const [name, s] of Object.entries(CITY.sectors)) {
    L.circleMarker([s.lat, s.lng], { radius: 4, color: '#475569', fillColor: '#475569', fillOpacity: 0.5, weight: 1 })
      .bindTooltip(name, { permanent: false, direction: 'top' }).addTo(map);
  }
}

function updateMapCrises(crises) {
  markers.forEach(m => map.removeLayer(m));
  circles.forEach(c => map.removeLayer(c));
  markers = []; circles = [];
  const colors = { critical: '#ff3d57', high: '#ffa726', medium: '#ffd54f', low: '#42a5f5' };
  for (const crisis of crises) {
    const c = crisis.coords, color = colors[crisis.severity] || '#42a5f5';
    const radius = (crisis.prediction?.affectedRadius || 1) * 400;
    circles.push(L.circle([c.lat, c.lng], { radius, color, fillColor: color, fillOpacity: 0.12, weight: 1.5, dashArray: '5 5' }).addTo(map));
    const icon = L.divIcon({ className: 'crisis-map-marker', html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 16px ${color}80;border:2px solid ${color};animation:pulse 2s infinite">${crisis.typeInfo.icon}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] });
    const marker = L.marker([c.lat, c.lng], { icon }).addTo(map);
    marker.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:180px"><strong>${crisis.typeInfo.icon} ${crisis.typeInfo.label}</strong><br/>Location: ${crisis.location}<br/>Severity: <span style="color:${color};font-weight:700">${crisis.severity.toUpperCase()}</span><br/>Confidence: ${(crisis.confidence * 100).toFixed(0)}%</div>`);
    markers.push(marker);

    // Smooth resource dispatches
    const alloc = engine.allocations.find(a => a.crisisId === crisis.id);
    if (alloc) {
      Object.entries(alloc.resources).forEach(([key, count]) => {
        if (count > 0) {
          const resDef = RES_DEFS[key] || { icon: '🚑' };
          animateResourceDispatch(c, resDef.icon);
        }
      });
    }
  }
  if (crises.length > 0) map.fitBounds(crises.map(c => [c.coords.lat, c.coords.lng]), { padding: [60, 60], maxZoom: 13 });
}

// ==================== CHARTS ====================
function initResourceChart() {
  const ctx = document.getElementById('resource-chart');
  if (!ctx || typeof Chart === 'undefined') return;
  const resArr = Object.values(RES_DEFS);
  const totalAvail = resArr.reduce((a, r) => a + r.available, 0);
  const totalAll = resArr.reduce((a, r) => a + r.total, 0);

  // Center text plugin
  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      const { ctx: c, width, height } = chart;
      const dataset = chart.data.datasets[0];
      const total = dataset.data.reduce((a, b) => a + b, 0);
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const cx = width / 2, cy = height / 2;
      c.font = '700 22px Inter, sans-serif';
      c.fillStyle = '#f1f5f9';
      c.fillText(total, cx, cy - 8);
      c.font = '500 9px Inter, sans-serif';
      c.fillStyle = '#64748b';
      c.fillText('AVAILABLE', cx, cy + 10);
      c.restore();
    }
  };

  resourceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: resArr.map(r => r.label),
      datasets: [{
        data: resArr.map(r => r.available),
        backgroundColor: resArr.map(r => r.color + '55'),
        borderColor: resArr.map(r => r.color),
        borderWidth: 2,
        hoverBackgroundColor: resArr.map(r => r.color + '90'),
        hoverBorderWidth: 3,
        spacing: 2,
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      layout: { padding: 4 },
      animation: { animateRotate: true, duration: 800 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,14,26,0.9)',
          titleFont: { family: 'Inter', weight: '600', size: 12 },
          bodyFont: { family: 'Inter', size: 11 },
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: function(ctx) {
              const r = resArr[ctx.dataIndex];
              return ` ${r.icon} ${r.label}: ${r.available}/${r.total}`;
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });

  // Build custom legend below chart
  buildChartLegend(resArr);
}

function buildChartLegend(resArr) {
  let legendEl = document.getElementById('resource-chart-legend');
  if (!legendEl) {
    legendEl = document.createElement('div');
    legendEl.id = 'resource-chart-legend';
    legendEl.className = 'resource-chart-legend';
    document.getElementById('resource-summary').appendChild(legendEl);
  }
  legendEl.innerHTML = resArr.map(r => {
    const pct = Math.round(r.available / r.total * 100);
    return `<div class="chart-legend-item"><span class="chart-legend-dot" style="background:${r.color};box-shadow:0 0 6px ${r.color}60"></span><span class="chart-legend-label">${r.icon} ${r.label}</span><span class="chart-legend-value">${r.available}<span class="chart-legend-total">/${r.total}</span></span></div>`;
  }).join('');
}

function updateResourceChart(resources) {
  if (!resourceChart) return;
  const resArr = Object.values(resources);
  resourceChart.data.datasets[0].data = resArr.map(r => r.available);
  resourceChart.update('active');
  buildChartLegend(resArr);
}

// ==================== RESOURCE LIST ====================
function initResourceList() { renderResources(RES_DEFS); }
function renderResources(resources) {
  const el = document.getElementById('resource-list');
  el.innerHTML = Object.entries(resources).map(([k, r]) => {
    const pct = (r.available / r.total * 100);
    const barColor = pct > 60 ? '#10b981' : pct > 30 ? '#ffa726' : '#ff3d57';
    const warningText = pct <= 30 ? '<span style="color:#ff3d57;font-size:9px;font-weight:700;margin-left:8px;animation:pulse 1s infinite">⚠️ EXHAUSTION RISK</span>' : '';
    const routeStatus = pct < 100 ? '<span style="color:#10b981;font-size:9px;font-weight:600;margin-left:auto">⚡ ROUTE OPTIMIZED</span>' : '';
    return `
      <div class="resource-item">
        <div class="resource-info">
          <span class="resource-icon">${r.icon}</span>
          <div style="flex: 1;">
            <div class="resource-name" style="display:flex;align-items:center">${r.label} ${warningText} ${routeStatus}</div>
            <div class="resource-detail">${r.available}/${r.total} units available</div>
          </div>
        </div>
        <div class="resource-bar">
          <div class="resource-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>`;
  }).join('');
}

// ==================== AGENT GRID ====================
function initAgentGrid() {
  document.getElementById('agent-status-grid').innerHTML = AGENTS.map(a => `<div class="agent-chip" id="agent-chip-${a.id}"><div class="agent-dot"></div><span>${a.icon} ${a.name}</span></div>`).join('');
}

// ==================== TABS ====================
function initTabs() {
  document.querySelectorAll('.panel-tabs').forEach(tabs => {
    tabs.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const panel = tabs.closest('.panel') || tabs.closest('.panel-left') || tabs.closest('.panel-right') || tabs.parentElement;
        tabs.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        // Find sibling tab-contents
        const parent = tabs.parentElement;
        parent.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  });
}

// ==================== SIGNAL FEED ====================
function addSignalToFeed(signal) {
  const feed = document.getElementById('signal-feed');
  if (feed.querySelector('.empty-state')) feed.innerHTML = '';
  const credClass = signal.credibility > 0.8 ? 'cred-high' : signal.credibility > 0.5 ? 'cred-medium' : 'cred-low';
  const credLabel = signal.credibility > 0.8 ? 'HIGH' : signal.credibility > 0.5 ? 'MED' : 'LOW';
  const card = document.createElement('div');
  card.className = 'signal-card';
  card.dataset.type = signal.type;
  card.innerHTML = `<div class="signal-header"><span class="signal-source source-${signal.type}">${signal.icon} ${signal.source}</span><span class="signal-time">${signal.timestamp}</span></div><div class="signal-body">${signal.text}</div><div class="signal-meta"><span class="signal-tag">📍 ${signal.location}</span><span class="signal-credibility ${credClass}">Cred: ${credLabel}</span>${signal.tags ? signal.tags.map(t => `<span class="signal-tag">${t}</span>`).join('') : ''}</div>`;
  feed.prepend(card);
  document.getElementById('signal-count').textContent = feed.children.length;
  document.getElementById('stat-signals-processed').textContent = feed.children.length;
  applySignalFilter();
}
function applySignalFilter() {
  const active = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
  document.querySelectorAll('.signal-card').forEach(c => { c.style.display = (active === 'all' || c.dataset.type === active) ? '' : 'none'; });
}

// ==================== CRISIS LIST ====================
function renderCrises(crises) {
  const el = document.getElementById('crisis-list');
  if (!crises.length) { el.innerHTML = '<div class="empty-state"><span class="empty-icon">✅</span><p>No active crises</p></div>'; return; }
  el.innerHTML = crises.map(c => `<div class="crisis-card severity-${c.severity}" data-id="${c.id}"><div class="crisis-title">${c.typeInfo.icon} ${c.typeInfo.label} <span class="crisis-type-badge" style="background:${c.typeInfo.color}20;color:${c.typeInfo.color}">${c.severity.toUpperCase()}</span>${c.status === 'reclassified' ? '<span class="crisis-type-badge" style="background:#ffa72620;color:#ffa726">RECLASSIFIED</span>' : ''}${c.status === 'downgraded' ? '<span class="crisis-type-badge" style="background:#4caf5020;color:#4caf50">DOWNGRADED</span>' : ''}</div><div class="crisis-stats"><div class="crisis-stat">📍 <strong>${c.location}</strong></div><div class="crisis-stat">🎯 <strong>${(c.confidence * 100).toFixed(0)}%</strong></div><div class="crisis-stat">👥 <strong>${c.prediction?.affectedPopulation?.toLocaleString() || '—'}</strong></div><div class="crisis-stat">⏱️ <strong>${c.prediction?.estimatedDuration || '—'}</strong></div></div>${c.contradictions?.length > 0 ? `<div style="margin-top:6px;font-size:11px;color:#ffa726">⚠️ ${c.contradictions[0].desc}</div>` : ''}<div class="crisis-actions"><button class="crisis-btn btn-primary" onclick="window.showCrisisDetail('${c.id}')">Details</button><button class="crisis-btn" onclick="window.showStakeholderModal()">📢 Messages</button></div></div>`).join('');
  document.getElementById('crisis-count').textContent = crises.length;
  document.querySelector('#active-crises-count .count-number').textContent = crises.length;
}

// ==================== TRACES ====================
function renderTraces(traces) {
  const el = document.getElementById('trace-timeline');
  const colors = { 'trace-fusion': '#42a5f5', 'trace-classify': '#ffa726', 'trace-predict': '#ab47bc', 'trace-allocate': '#4caf50', 'trace-simulate': '#ff7043', 'trace-notify': '#26c6da', 'trace-verify': '#ff3d57' };
  const labels = { fusion: '🔗 FUSION', classifier: '🏷️ CLASSIFIER', predictor: '📈 PREDICTOR', allocator: '📦 ALLOCATOR', simulator: '🧪 SIMULATOR', notifier: '📢 NOTIFIER', verifier: '🔍 VERIFIER' };
  el.innerHTML = traces.slice(-30).map(t => `<div class="trace-entry ${t.type}"><div class="trace-agent" style="color:${colors[t.type] || '#94a3b8'}">${labels[t.agent] || t.agent}</div><div class="trace-msg">${t.message}${t.confidence !== null ? `<span class="trace-confidence" style="background:${t.confidence > 0.7 ? 'rgba(76,175,80,0.2)' : t.confidence > 0.4 ? 'rgba(255,167,38,0.2)' : 'rgba(255,61,87,0.2)'}">${(t.confidence * 100).toFixed(0)}%</span>` : ''}</div><div class="trace-time">${t.timestamp}</div></div>`).join('');
  el.scrollTop = el.scrollHeight;
}

// ==================== SIMULATION ====================
function renderSimulations(sims) {
  const el = document.getElementById('simulation-container');
  if (!sims?.length) return;
  el.innerHTML = sims.map(sim => `<div style="margin-bottom:12px"><h4 style="font-size:13px;margin-bottom:8px">📍 ${sim.location}</h4>${sim.actions.map(a => `<div class="sim-card"><div class="sim-title">${a.icon} ${a.action}</div><div class="sim-grid"><div class="sim-before"><div class="sim-label">Before</div>${a.before.desc}<br/><strong>${a.before.metric}</strong></div><div class="sim-arrow">→</div><div class="sim-after"><div class="sim-label">After</div>${a.after.desc}<br/><strong>${a.after.metric}</strong></div></div><div class="sim-effects"><div class="sim-effect">📈 <strong>Improvement:</strong> ${a.improvement}</div><div class="sim-effect">💰 <strong>Cost:</strong> ${a.cost}</div>${a.sideEffects.map(se => `<div class="sim-effect">⚠️ ${se}</div>`).join('')}</div></div>`).join('')}</div>`).join('');
}

// ==================== SCENARIO MODAL ====================
function initScenarioModal() {
  const grid = document.getElementById('scenario-grid');
  grid.innerHTML = SCENARIOS.map(s => `<div class="scenario-card" data-id="${s.id}"><div class="scenario-icon">${s.icon}</div><div class="scenario-name">${s.name}</div><div class="scenario-desc">${s.desc}</div><div class="scenario-tags">${s.tags.map(t => `<span class="scenario-tag">${t}</span>`).join('')}</div></div>`).join('');
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.scenario-card');
    if (!card) return;
    const scenario = SCENARIOS.find(s => s.id === card.dataset.id);
    if (scenario) { document.getElementById('scenario-modal').classList.add('hidden'); engine.runScenario(scenario); }
  });
  document.getElementById('btn-run-scenario').addEventListener('click', () => {
    document.getElementById('scenario-modal').classList.remove('hidden');
  });
  const btnLiveStream = document.getElementById('btn-live-stream');
  if (btnLiveStream) {
    btnLiveStream.addEventListener('click', () => {
      showToast('Live Core Stream', 'Connecting to real-time weather and news grids...', '📡');
      engine.runLiveStream();
    });
  }
}

// ==================== NOTIFICATIONS ====================
function initNotificationPanel() {
  document.getElementById('btn-notifications').addEventListener('click', () => { document.getElementById('notification-panel').classList.toggle('hidden'); });
  document.getElementById('notification-panel-close').addEventListener('click', () => { document.getElementById('notification-panel').classList.add('hidden'); });
}
let notifCount = 0;
function addNotification(title, body, type = 'info') {
  const list = document.getElementById('notification-list');
  if (list.querySelector('.empty-state')) list.innerHTML = '';
  const item = document.createElement('div');
  item.className = `notif-item notif-${type}`;
  item.innerHTML = `<div class="notif-title">${title}</div><div class="notif-body">${body}</div><div class="notif-time">${new Date().toLocaleTimeString()}</div>`;
  list.prepend(item);
  notifCount++;
  const badge = document.getElementById('notification-badge');
  badge.textContent = notifCount; badge.classList.remove('hidden');
}

// ==================== TOASTS ====================
function showToast(title, message, icon = '📢') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-text"><div class="toast-title">${title}</div>${message}</div>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 5000);
}

// ==================== MOBILE NAV ====================
function initMobileNav() {
  const panelLeft = document.getElementById('panel-left');
  const panelCenter = document.querySelector('.panel-center');
  const panelRight = document.getElementById('panel-right');
  const allPanels = [panelLeft, panelCenter, panelRight].filter(Boolean);

  function switchMobileView(view) {
    // Remove active from all panels
    allPanels.forEach(p => {
      p.classList.remove('mobile-active');
      p.classList.remove('mobile-visible');
    });

    if (view === 'map') {
      // Map is default, show center panel
      if (panelCenter) panelCenter.classList.add('mobile-active');
      setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    } else if (view === 'signals' || view === 'crises' || view === 'commander') {
      if (panelLeft) {
        panelLeft.classList.add('mobile-active');
        const tab = panelLeft.querySelector(`.panel-tab[data-tab="${view}"]`);
        if (tab) tab.click();
      }
    } else if (view === 'resources' || view === 'agents') {
      if (panelRight) {
        panelRight.classList.add('mobile-active');
        const tab = panelRight.querySelector(`.panel-tab[data-tab="${view}"]`);
        if (tab) tab.click();
      }
    }
  }

  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      switchMobileView(item.dataset.view);
    });
  });
}

// Update mobile status bar
function updateMobileStatus(threatLevel, crisisCount) {
  const threatEl = document.getElementById('mobile-threat');
  const crisesEl = document.getElementById('mobile-crises-badge');
  if (threatEl) {
    threatEl.textContent = threatLevel || 'LOW';
    threatEl.className = 'mobile-threat threat-' + (threatLevel || 'low').toLowerCase();
  }
  if (crisesEl) {
    crisesEl.textContent = (crisisCount || 0) + ' Crises';
  }
}

// ==================== MODAL CLOSES ====================
function initModalCloses() {
  document.querySelectorAll('.modal-close').forEach(el => { el.addEventListener('click', () => { el.closest('.modal')?.classList.add('hidden'); }); });
  document.querySelectorAll('.modal-backdrop').forEach(el => { el.addEventListener('click', () => { el.closest('.modal')?.classList.add('hidden'); }); });
  document.querySelectorAll('.modal-content').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); }); });
}

// Filter chips
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-chip')) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active'); applySignalFilter();
  }
});

// ==================== CRISIS DETAIL ====================
window.showCrisisDetail = function(id) {
  const crisis = engine.crises.find(c => c.id === id);
  if (!crisis) return;
  document.getElementById('crisis-detail-title').textContent = `${crisis.typeInfo.icon} ${crisis.typeInfo.label} — ${crisis.location}`;
  const alloc = engine.allocations.find(a => a.crisisId === id);
  const verif = engine.verifications.find(v => v.crisisId === id);
  document.getElementById('crisis-detail-body').innerHTML = `<div class="detail-grid"><div class="detail-section"><h4>Classification</h4><div class="detail-row"><span>Type</span><span>${crisis.typeInfo.label}</span></div><div class="detail-row"><span>Severity</span><span style="color:${crisis.severity === 'critical' ? '#ff3d57' : '#ffa726'}">${crisis.severity.toUpperCase()}</span></div><div class="detail-row"><span>Confidence</span><span>${(crisis.confidence * 100).toFixed(0)}%</span></div><div class="detail-row"><span>Signals</span><span>${crisis.signalCount}</span></div><div class="detail-row"><span>Sources</span><span>${crisis.sourceTypes.join(', ')}</span></div><div class="detail-row"><span>Status</span><span>${crisis.status || 'active'}</span></div></div><div class="detail-section"><h4>Prediction</h4><div class="detail-row"><span>Radius</span><span>${crisis.prediction?.affectedRadius || '—'} km</span></div><div class="detail-row"><span>Population</span><span>${crisis.prediction?.affectedPopulation?.toLocaleString() || '—'}</span></div><div class="detail-row"><span>Duration</span><span>${crisis.prediction?.estimatedDuration || '—'}</span></div><div class="detail-row"><span>Peak</span><span>${crisis.prediction?.peakImpactTime || '—'}</span></div><div class="detail-row"><span>Spread Risk</span><span>${crisis.prediction?.spreadRisk || '—'}</span></div><div class="detail-row"><span>Uncertainty</span><span>${crisis.prediction?.uncertaintyRange || '—'}</span></div></div>${alloc ? `<div class="detail-section"><h4>Resources</h4>${Object.entries(alloc.resources).map(([k, v]) => `<div class="detail-row"><span>${engine.resources[k]?.icon || ''} ${engine.resources[k]?.label || k}</span><span>${v} units</span></div>`).join('')}${alloc.tradeoffs.length > 0 ? `<div style="margin-top:8px;font-size:11px;color:#ffa726">⚖️ ${alloc.tradeoffs.join('<br/>⚖️ ')}</div>` : ''}</div>` : ''}${verif ? `<div class="detail-section"><h4>Verification</h4><div class="detail-row"><span>Action</span><span>${verif.action}</span></div><div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${verif.details}</div></div>` : ''}${crisis.contradictions?.length > 0 ? `<div class="detail-section detail-full"><h4>⚠️ Contradictions</h4>${crisis.contradictions.map(c => `<div style="font-size:12px;color:#ffa726">${c.desc}</div>`).join('')}</div>` : ''}</div>`;
  document.getElementById('crisis-detail-modal').classList.remove('hidden');
};

window.showStakeholderModal = function() {
  const el = document.getElementById('stakeholder-messages');
  const msgs = engine.stakeholderMessages;
  if (!msgs.length) { el.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>'; }
  else { el.innerHTML = msgs.map(m => `<div class="stakeholder-msg"><div class="stakeholder-header"><span class="stakeholder-icon">${m.icon}</span><span class="stakeholder-name">${m.recipient}</span><span class="stakeholder-priority" style="background:${m.priorityColor}20;color:${m.priorityColor}">${m.priority}</span></div><div class="stakeholder-body">${m.body}</div></div>`).join(''); }
  document.getElementById('stakeholder-modal').classList.remove('hidden');
};

// ==================== ENGINE EVENTS ====================
function wireEngine() {
  engine.on('signal', (s) => {
    addSignalToFeed(s);
    if (s.urgency === 'critical') { showToast('Critical Signal', `${s.source}: ${s.text.substring(0, 60)}...`, '🚨'); addNotification(`${s.source} — ${s.location}`, s.text, 'danger'); }
    else if (s.isSystemAlert) { showToast('System Alert', s.text.substring(0, 80), '⚠️'); addNotification('System Alert', s.text, 'warning'); }
  });
  engine.on('crises', (crises) => { renderCrises(crises); updateMobileStatus(null, crises.length); });
  engine.on('crises', updateMapCrises);
  engine.on('traces', renderTraces);
  engine.on('resources', (r) => { renderResources(r); updateResourceChart(r); });
  engine.on('simulations', renderSimulations);
  engine.on('agent-busy', (id) => { const el = document.getElementById('agent-chip-' + id); if (el) el.classList.add('busy'); });
  engine.on('agent-idle', (id) => { const el = document.getElementById('agent-chip-' + id); if (el) el.classList.remove('busy'); });
  engine.on('threat-level', (level) => { const el = document.getElementById('threat-value'); el.textContent = level; el.className = 'threat-value threat-' + level.toLowerCase(); updateMobileStatus(level, null); });
  engine.on('reset', () => {
    document.getElementById('signal-feed').innerHTML = '<div class="empty-state"><span class="empty-icon">📡</span><p>Awaiting signals...</p></div>';
    document.getElementById('signal-count').textContent = '0';
    document.getElementById('crisis-count').textContent = '0';
    document.getElementById('stat-signals-processed').textContent = '0';
    document.getElementById('stat-confidence-avg').textContent = '—';
    document.getElementById('stat-resources-deployed').textContent = '0';
    document.getElementById('stat-response-time').textContent = '—';
    document.getElementById('stat-population-affected').textContent = '0';
    renderCrises([]); updateMapCrises([]); renderResources(RES_DEFS);
    document.getElementById('trace-timeline').innerHTML = '';
    document.getElementById('simulation-container').innerHTML = '<div class="empty-state"><span class="empty-icon">📈</span><p>Run a scenario to see simulation</p></div>';
    notifCount = 0; document.getElementById('notification-badge').classList.add('hidden');
    updateMobileStatus('LOW', 0);

    // Reset AI Commander UI
    document.getElementById('commander-summary').textContent = 'Awaiting operational signals to perform real-time urban disaster assessment...';
    document.getElementById('commander-confidence').textContent = '—';
    document.getElementById('commander-actions').innerHTML = '<li>Standby for signal intelligence processing</li>';
    document.getElementById('commander-escalation').textContent = 'No active threats detected. Risk level: Nominal.';
    document.getElementById('commander-forecast').textContent = 'System monitoring: Hayatabad, University Town, Saddar, Karkhano, G.T. Road, Charsadda.';
    stopRainEffect();
  });
  engine.on('scenario-start', (s) => { showToast('Scenario Started', s.name, '🎯'); addNotification('Scenario', s.name, 'info'); });
  engine.on('pipeline-complete', (data) => {
    const crises = data.crises;
    if (crises.length > 0) {
      document.getElementById('stat-confidence-avg').textContent = (crises.reduce((a, c) => a + c.confidence, 0) / crises.length * 100).toFixed(0) + '%';
      document.getElementById('stat-population-affected').textContent = crises.reduce((a, c) => a + (c.prediction?.affectedPopulation || 0), 0).toLocaleString();
      document.getElementById('stat-resources-deployed').textContent = data.allocations.reduce((a, al) => a + Object.values(al.resources).reduce((s, v) => s + v, 0), 0);
      document.getElementById('stat-response-time').textContent = (8 + Math.floor(Math.random() * 7)) + ' min';
    }
    showToast('Pipeline Complete', `${crises.length} crises analyzed.`, '✅');
    addNotification('Complete', `${crises.length} crises processed.`, 'success');
  });

  // Wire new WebSocket events
  engine.on('weather-update', (weather) => {
    setWeatherCondition(weather);
  });
  engine.on('ai-commander-update', (data) => {
    updateAICommanderUI(data);
  });
  engine.on('agent-chat', (chat) => {
    addAgentChatMessage(chat);
  });
  engine.on('backend-connected', (connected) => {
    const badge = document.querySelector('.logo-badge');
    const statusText = document.querySelector('.system-status span');
    const statusDot = document.querySelector('.status-dot');
    if (connected) {
      if (badge) { badge.textContent = 'LIVE CORE'; badge.style.background = 'linear-gradient(135deg, #10b981, #059669)'; }
      if (statusText) statusText.textContent = 'All Systems Operational | Core Connected';
      if (statusDot) { statusDot.className = 'status-dot status-online'; statusDot.style.background = '#10b981'; }
    } else {
      if (badge) { badge.textContent = 'LIVE MOCK'; badge.style.background = 'linear-gradient(135deg, #ff3d57, #ff6b6b)'; }
      if (statusText) statusText.textContent = 'Degraded Mode | Local Simulation active';
      if (statusDot) { statusDot.className = 'status-dot status-offline'; statusDot.style.background = '#ff3d57'; }
    }
  });
}

// ==================== LIVE VISUAL HELPERS ====================
let rainCanvas = null;
let rainAnimFrame = null;
function setWeatherCondition(weather) {
  const systemStatusEl = document.querySelector('.system-status span');
  if (systemStatusEl) {
    systemStatusEl.innerHTML = `All Systems Operational | Peshawar Weather: ${weather.temp}°C, ${weather.condition}`;
  }
  
  if (['Rain', 'Thunderstorm', 'Drizzle'].includes(weather.condition)) {
    startRainEffect();
  } else {
    stopRainEffect();
  }
}

function startRainEffect() {
  if (rainCanvas) return;
  const container = document.getElementById('map-container');
  if (!container) return;
  rainCanvas = document.createElement('canvas');
  rainCanvas.className = 'rain-overlay';
  container.appendChild(rainCanvas);

  const ctx = rainCanvas.getContext('2d');
  let w = (rainCanvas.width = container.clientWidth);
  let h = (rainCanvas.height = container.clientHeight);

  window.addEventListener('resize', () => {
    if (rainCanvas) {
      w = rainCanvas.width = container.clientWidth;
      h = rainCanvas.height = container.clientHeight;
    }
  });

  const maxParts = 100;
  const particles = [];
  for (let i = 0; i < maxParts; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      l: Math.random() * 20 + 10,
      xs: -4 + Math.random() * 4 + 2,
      ys: Math.random() * 8 + 8
    });
  }

  function draw() {
    if (!rainCanvas) return;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(156,163,175,0.45)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < maxParts; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.xs, p.y + p.ys);
      ctx.stroke();

      p.x += p.xs;
      p.y += p.ys;
      if (p.x > w || p.y > h) {
        p.x = Math.random() * w;
        p.y = -20;
      }
    }
    rainAnimFrame = requestAnimationFrame(draw);
  }
  draw();
}

function stopRainEffect() {
  if (rainCanvas) {
    if (rainAnimFrame) cancelAnimationFrame(rainAnimFrame);
    rainCanvas.remove();
    rainCanvas = null;
  }
}

function animateResourceDispatch(crisisCoord, resourceIcon) {
  const startCoord = { lat: 34.0151, lng: 71.5249 }; // Base dispatch coord (City Center)
  const markerIcon = L.divIcon({
    className: 'resource-path-marker',
    html: `<div style="font-size:18px; filter:drop-shadow(0 0 6px rgba(255,255,255,0.8)); animation:pulse 0.5s infinite alternate">${resourceIcon}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  
  const m = L.marker([startCoord.lat, startCoord.lng], { icon: markerIcon }).addTo(map);
  markers.push(m);

  let step = 0;
  const steps = 50;
  const interval = setInterval(() => {
    if (step >= steps || !map.hasLayer(m)) {
      clearInterval(interval);
      if (map.hasLayer(m)) map.removeLayer(m);
      return;
    }
    const ratio = step / steps;
    const curLat = startCoord.lat + (crisisCoord.lat - startCoord.lat) * ratio;
    const curLng = startCoord.lng + (crisisCoord.lng - startCoord.lng) * ratio;
    m.setLatLng([curLat, curLng]);
    step++;
  }, 40);
}

function updateAICommanderUI(data) {
  if (!data) return;
  const confEl = document.getElementById('commander-confidence');
  if (confEl) {
    confEl.textContent = typeof data.confidence === 'number' ? (data.confidence * 100).toFixed(0) + '%' : data.confidence;
  }

  typeText('commander-summary', data.summary);
  typeText('commander-escalation', data.escalationPrediction);
  typeText('commander-forecast', data.forecast || '');

  const actionsEl = document.getElementById('commander-actions');
  if (actionsEl && data.actions) {
    actionsEl.innerHTML = data.actions.map(action => `<li>${action}</li>`).join('');
  }
}

function addAgentChatMessage(chat) {
  const timeline = document.getElementById('trace-timeline');
  if (!timeline) return;
  if (timeline.querySelector('.empty-state')) timeline.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'trace-bubble';
  card.innerHTML = `
    <div class="trace-bubble-header">${chat.icon} ${chat.agent} — ${chat.timestamp}</div>
    <div class="trace-bubble-msg">${chat.message}</div>
  `;
  timeline.appendChild(card);
  timeline.scrollTop = timeline.scrollHeight;
}

function typeText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
}

