# CIRO — Crisis Intelligence & Response Orchestrator

> Multi-agent disaster management system for urban crisis detection, signal fusion, resource allocation, and coordinated emergency response.

## 🚀 Quick Start

```bash
# Navigate to the project
cd ciro

# Install dependencies
npm install

# Start development server
npm run dev
```

Then open `http://localhost:5173` in your browser.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CIRO Orchestration Engine                      │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────┐  │
│  │  Signal   │→│    Crisis     │→│   Severity    │→│ Resource  │  │
│  │  Fusion   │ │  Classifier   │ │  Predictor    │ │ Allocator │  │
│  │  Agent    │ │    Agent      │ │    Agent      │ │  Agent    │  │
│  └──────────┘ └──────────────┘ └───────────────┘ └──────────┘  │
│       ↓                                                ↓         │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐               │
│  │  Impact   │ │ Stakeholder  │ │ Verification  │               │
│  │ Simulator │ │  Notifier    │ │    Agent      │               │
│  │  Agent    │ │    Agent     │ │               │               │
│  └──────────┘ └──────────────┘ └───────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 7-Agent Pipeline

| Agent | Role | Key Actions |
|-------|------|-------------|
| 🔗 Signal Fusion | Ingests & fuses multi-source signals | Source credibility scoring, geolocation confidence, contradiction detection, mention velocity |
| 🏷️ Crisis Classifier | Classifies crisis type & severity | NLP keyword analysis, sensor data correlation, alternative hypothesis tracking |
| 📈 Severity Predictor | Predicts crisis evolution | Affected radius/population, duration, peak impact, spread risk, cascade effects |
| 📦 Resource Allocator | Optimizes constrained resources | Priority-based allocation, trade-off analysis, multi-crisis balancing |
| 🧪 Impact Simulator | Simulates response actions | Before/after modeling, side effect prediction, cost analysis |
| 📢 Stakeholder Notifier | Generates tailored messages | Public, emergency services, hospitals, utilities, transport, media |
| 🔍 Verification Agent | Handles false positives/negatives | Field verification, reclassification, alert retraction, escalation |

### Signal Sources (6 types)
1. **Social Media** — Citizen posts with urgency language detection
2. **Weather API** — Extreme weather alerts and forecasts
3. **Traffic API** — Congestion levels and route blockages
4. **Emergency Calls** — Call frequency and location clustering
5. **IoT Sensors** — Water level, temperature, gas, seismic readings
6. **Field Reports** — On-ground verification (verified/unverified)

## 🎯 Scenarios

### 1. Dual Crisis: Flood + Heatwave
- G-10 flooding with conflicting water-main hypothesis
- Simultaneous heat emergency in I-10
- Tests: multi-crisis coordination, resource competition, contradiction handling

### 2. Conflicting Signal Analysis
- Social media reports explosion but sensors show nothing
- Tests: false positive detection, misinformation handling, verification workflow

### 3. Degraded Mode: API Failures
- Weather and traffic APIs fail during emerging crisis
- Tests: fallback data sources, cached data usage, confidence reduction

### 4. Evacuation Cascade
- Gas leak triggers evacuation causing traffic gridlock
- Tests: cascade effect modeling, staged alerting, congestion management

## 📱 Mobile-First Design
- Responsive layout with bottom tab navigation on mobile
- Swipeable panels for signals, crises, resources, and agent traces
- Full-screen interactive map view
- Touch-optimized controls

## 🛠️ Technology Stack
- **Frontend**: Vanilla HTML/CSS/JS with ES Modules
- **Map**: Leaflet.js with CartoDB dark tiles
- **Charts**: Chart.js for resource visualization
- **Build**: Vite (dev server & bundler)
- **Fonts**: Inter + JetBrains Mono

## 📊 Data Stream Schemas

### Signal Schema
```json
{
  "id": 1,
  "type": "social|weather|traffic|emergency|sensor|field",
  "source": "Source Name",
  "text": "Signal content",
  "location": "Sector Name",
  "urgency": "low|medium|high|critical",
  "credibility": 0.0-1.0,
  "geolocationConf": 0.0-1.0,
  "timestamp": "HH:MM:SS",
  "tags": ["keyword1", "keyword2"]
}
```

### Crisis Schema
```json
{
  "id": "CR-XXXXX",
  "type": "flood|heatwave|accident|infrastructure|powerOutage|protest|disease|waterMain",
  "severity": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "location": "Sector Name",
  "prediction": {
    "affectedRadius": 1.5,
    "affectedPopulation": 25000,
    "estimatedDuration": "4 hours",
    "spreadRisk": "HIGH",
    "cascadeRisk": ["effect1", "effect2"]
  }
}
```

## ⚠️ Assumptions & Notes
- All data is **synthetic/mock** — no real personal or sensitive information
- City model based on Islamabad sectors (G-10, I-10, F-10, etc.)
- Signal generation uses realistic patterns but randomized values
- Agent processing includes artificial delays to visualize pipeline stages
- Resource quantities are illustrative, not based on real city data

## 🔒 Privacy & Safety
- No real citizen data is collected or displayed
- All social media posts are fabricated examples
- Location data uses general sector names, not specific addresses
- System is a prototype for demonstration purposes only

## 📈 Scalability Discussion
- Event-driven architecture allows horizontal scaling of agents
- Signal fusion can be parallelized across location clusters
- Resource allocation uses priority queuing suitable for real-time systems
- Map rendering handles 50+ simultaneous crisis markers efficiently

## ⚡ Cost & Latency
- **Signal ingestion**: ~600ms per signal (simulated delay)
- **Full pipeline**: ~3-4 seconds for complete 7-agent analysis
- **Map updates**: Real-time with Leaflet marker management
- **Resource chart**: Instant Chart.js updates

## 🔄 Limitations
- No persistent storage (state resets on page refresh)
- Single-user dashboard (no multi-user collaboration)
- Mock data only (no real API integrations)
- Classification uses keyword matching (production would use ML/NLP)
- Resource allocation is greedy (production would use optimization algorithms)
