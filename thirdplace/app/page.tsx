"use client";

import { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const PROFILES = ["Wheelchair", "Cane", "Walker", "Low crowd"] as const;
type Profile = typeof PROFILES[number];

const LOCATIONS = [
  { name: "College de Brebeuf", lat: 45.5324, lng: -73.6214 },
  { name: "Metro Montmorency", lat: 45.5567, lng: -73.6595 },
  { name: "Metro Cote-Vertu", lat: 45.5142, lng: -73.6848 },
  { name: "Parc Jean-Drapeau", lat: 45.5118, lng: -73.5337 },
  { name: "Place Ville Marie", lat: 45.5017, lng: -73.5688 },
  { name: "McGill University", lat: 45.5048, lng: -73.5772 },
  { name: "Old Montreal", lat: 45.5088, lng: -73.5539 },
  { name: "Mont-Royal Park", lat: 45.5086, lng: -73.5856 },
  { name: "Bell Centre", lat: 45.4961, lng: -73.5693 },
  { name: "UQAM", lat: 45.5107, lng: -73.5617 },
];

const OBSTACLES = [
  { id: 1, type: "stairs", lat: 45.5285, lng: -73.6195, label: "Stairs" },
  { id: 2, type: "elevator", lat: 45.5310, lng: -73.6225, label: "Elevator" },
  { id: 3, type: "ramp", lat: 45.5340, lng: -73.6200, label: "Ramp" },
  { id: 4, type: "crowded", lat: 45.5295, lng: -73.6180, label: "Crowded" },
];

const NAV_STEPS = [
  { text: "Head straight for 50 m toward the main entrance", dist: "50 m" },
  { text: "Turn right toward the elevator lobby", dist: "80 m" },
  { text: "Take the elevator to floor 2", dist: "1 floor" },
  { text: "Turn left and continue for 80 m", dist: "80 m" },
  { text: "Ramp ahead - slight incline for 30 m", dist: "30 m" },
  { text: "You have arrived", dist: "0 m" },
];

const routes = [
  { name: "Best accessible", time: "9 min", dist: "620 m", tags: ["No stairs", "1 elevator", "Smooth"], good: true },
  { name: "Gentler incline", time: "11 min", dist: "710 m", tags: ["Less steep", "Longer", "Quiet"], good: false },
  { name: "Quiet route", time: "10 min", dist: "690 m", tags: ["Low traffic", "1 narrow"], good: false },
];

export default function AccessibleMap() {
  const [step, setStep] = useState<"search" | "routes" | "nav">("search");
  const [profile, setProfile] = useState<Profile>("Wheelchair");
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState<null | { name: string; lat: number; lng: number }>(null);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [navIndex, setNavIndex] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ voice: true, highContrast: false, largeText: false });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = new maplibregl.Map({
      container: mapRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [-73.6214, 45.5324],
      zoom: 13,
    });
    return () => mapInstance.current?.remove();
  }, []);

  const filtered = query ? LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase())) : [];

  const getIcon = (p: Profile) => p === "Wheelchair" ? "♿" : p === "Cane" ? "🦯" : p === "Walker" ? "🚶" : "👥";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#1a1a2e", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .top-bar { position: absolute; top: 0; left: 0; right: 0; z-index: 100; padding: 12px 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; pointer-events: none; }
        .top-bar > * { pointer-events: auto; }
        .search-card { flex: 1; background: rgba(15, 52, 96, 0.95); backdrop-filter: blur(10px); border-radius: 14px; padding: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .search-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .search-input { flex: 1; background: #0f3460; border: none; border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 14px; outline: none; }
        .search-input::placeholder { color: #666; }
        .profile-chip { padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15, 52, 96, 0.9); color: #fff; font-size: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .profile-chip.active { background: #e94560; border-color: #e94560; }
        .results-dropdown { position: absolute; top: 100%; left: 16px; right: 16px; background: rgba(15, 52, 96, 0.98); backdrop-filter: blur(10px); border-radius: 12px; overflow: hidden; z-index: 200; box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
        .result-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
        .result-item:hover { background: rgba(233, 69, 96, 0.15); }
        .settings-btn { background: rgba(15, 52, 96, 0.95); border: none; border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 20px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .map { flex: 1; width: 100%; min-height: 0; }
        .bottom-panel { background: #16213e; border-radius: 20px 20px 0 0; padding: 20px 16px 24px; position: relative; z-index: 50; min-height: 45%; max-height: 60vh; overflow-y: auto; transition: transform 0.3s ease; }
        .handle { width: 40px; height: 4px; background: #0f3460; border-radius: 2px; margin: 0 auto 16px; cursor: grab; }
        .panel-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .panel-subtitle { font-size: 13px; color: #888; margin-bottom: 16px; }
        .cta-btn { width: 100%; padding: 14px; border-radius: 12px; border: none; background: #e94560; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
        .route-card { background: #0f3460; border-radius: 12px; padding: 14px; margin-bottom: 10px; cursor: pointer; border: 2px solid transparent; text-align: left; }
        .route-card.selected { border-color: #e94560; }
        .route-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .route-name { font-size: 14px; font-weight: 600; }
        .route-meta { font-size: 12px; color: #888; }
        .route-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .tag { padding: 3px 8px; border-radius: 8px; font-size: 11px; }
        .tag.good { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        .tag.warn { background: rgba(243, 156, 18, 0.15); color: #f39c12; }
        .nav-card { text-align: center; }
        .nav-step { font-size: 18px; font-weight: 500; margin-bottom: 8px; }
        .nav-dist { font-size: 32px; font-weight: 700; color: #e94560; display: block; margin: 4px 0 12px; }
        .progress-bar { height: 4px; background: #0f3460; border-radius: 2px; margin: 16px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: #e94560; border-radius: 2px; transition: width 0.3s; }
        .nav-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
        .stat-box { background: #0f3460; border-radius: 10px; padding: 10px 6px; text-align: center; }
        .stat-label { font-size: 10px; color: #888; display: block; }
        .stat-val { font-size: 14px; font-weight: 600; }
        .nav-actions { display: flex; gap: 8px; margin-top: 12px; }
        .nav-btn { flex: 1; padding: 12px; border-radius: 10px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; }
        .nav-btn.primary { background: #e94560; color: #fff; }
        .nav-btn.secondary { background: #0f3460; color: #fff; }
        .alert-bar { background: rgba(243, 156, 18, 0.15); border: 1px solid rgba(243, 156, 18, 0.3); border-radius: 10px; padding: 8px 12px; font-size: 12px; color: #f39c12; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .settings-overlay { position: fixed; inset: 0; background: #1a1a2e; z-index: 300; padding: 20px 16px; overflow-y: auto; }
        .settings-panel { max-width: 420px; margin: 0 auto; background: #16213e; border-radius: 16px; padding: 20px; }
        .settings-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .settings-subtitle { font-size: 13px; color: #888; margin-bottom: 20px; }
        .setting-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid #0f3460; }
        .setting-label { font-size: 15px; }
        .setting-desc { font-size: 12px; color: #666; }
        .toggle { width: 48px; height: 26px; background: #0f3460; border-radius: 13px; position: relative; cursor: pointer; }
        .toggle.on { background: #e94560; }
        .toggle-knob { width: 22px; height: 22px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.2s; }
        .toggle.on .toggle-knob { left: 24px; }
        .legend { margin-top: 16px; padding-top: 16px; border-top: 1px solid #0f3460; }
        .legend-title { font-size: 12px; color: #666; margin-bottom: 8px; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #888; margin-bottom: 4px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .close-btn { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; padding: 0; }
        .voice-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(233, 69, 96, 0.15); color: #e94560; padding: 4px 10px; border-radius: 20px; font-size: 11px; }
        .report-input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #0f3460; background: transparent; color: #fff; font-size: 14px; margin-bottom: 12px; outline: none; }
      `}</style>

      {/* Top Bar - always visible, floating over map */}
      <div className="top-bar">
        <div className="search-card">
          <div className="search-row">
            <input
              className="search-input"
              placeholder="Where to?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query && setQuery(query)}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PROFILES.map((p) => (
              <button
                key={p}
                className={`profile-chip ${profile === p ? "active" : ""}`}
                onClick={() => setProfile(p)}
              >
                {getIcon(p)} {p}
              </button>
            ))}
          </div>
          {filtered.length > 0 && (
            <div className="results-dropdown">
              {filtered.map((loc) => (
                <div key={loc.name} className="result-item" onClick={() => {
                  setDestination({ name: loc.name, lat: loc.lat, lng: loc.lng });
                  setQuery("");
                }}>{loc.name}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="settings-btn" onClick={() => setSettingsOpen(true)}>⚙️</button>
          {step === "nav" && <span className="voice-badge">{settings.voice ? "🔊 On" : "🔇 Off"}</span>}
        </div>
      </div>

      {/* Map - full screen */}
      <div className="map" ref={mapRef} />

      {/* Bottom Panel - changes content based on step */}
      <div className="bottom-panel">
        <div className="handle" />

        {step === "search" && (
          <>
            <div className="panel-title">Find an accessible route</div>
            <p className="panel-subtitle">
              {destination
                ? `Going to ${destination.name}. Optimized for ${profile.toLowerCase()} access.`
                : "Pick a destination from the search bar above. We'll find the safest path for you."}
            </p>
            {destination && (
              <>
                <div className="alert-bar">
                  <span>⚠️ 2 nearby alerts</span>
                  <span style={{ marginLeft: "auto", opacity: 0.6 }}>Crowded corridor · Elevator verified</span>
                </div>
                <button className="cta-btn" onClick={() => setStep("routes")}>
                  Find routes →
                </button>
              </>
            )}
            {!destination && (
              <>
                <div className="alert-bar">
                  <span>ℹ️ Tip</span>
                  <span style={{ marginLeft: "auto", opacity: 0.6 }}>Select a profile above to personalize your routes</span>
                </div>
                <div className="legend">
                  <div className="legend-title">MAP LEGEND</div>
                  <div className="legend-item"><span className="dot" style={{ background: "#e94560" }}></span> Main accessible route</div>
                  <div className="legend-item"><span className="dot" style={{ background: "#2ecc71" }}></span> Elevator / accessible entry</div>
                  <div className="legend-item"><span className="dot" style={{ background: "#3498db" }}></span> Ramp or curb cut</div>
                  <div className="legend-item"><span className="dot" style={{ background: "#f39c12" }}></span> Caution area</div>
                  <div className="legend-item"><span className="dot" style={{ background: "#e74c3c" }}></span> Barrier</div>
                </div>
              </>
            )}
          </>
        )}

        {step === "routes" && (
          <>
            <button className="close-btn" onClick={() => setStep("search")} style={{ float: "right", fontSize: "16px" }}>✕</button>
            <div className="panel-title">Choose your route</div>
            <p className="panel-subtitle">Best options for {profile.toLowerCase()} - sorted by accessibility</p>
            {routes.map((r, i) => (
              <button
                key={r.name}
                className={`route-card ${selectedRoute === i ? "selected" : ""}`}
                onClick={() => setSelectedRoute(i)}
              >
                <div className="route-header">
                  <span className="route-name">{r.name}</span>
                  <span className="route-meta">{r.time} · {r.dist}</span>
                </div>
                <div className="route-tags">
                  {r.tags.map((t) => (
                    <span key={t} className={`tag ${r.good ? "good" : "warn"}`}>{t}</span>
                  ))}
                </div>
              </button>
            ))}
            <button className="cta-btn" onClick={() => setStep("nav")}>
              Start navigation →
            </button>
          </>
        )}

        {step === "nav" && (
          <div className="nav-card">
            <div className="panel-title" style={{ fontSize: "13px", color: "#888", marginBottom: "4px" }}>Heading to</div>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
              {destination?.name || "Your destination"}
            </div>
            <div className="nav-step">{NAV_STEPS[navIndex].text}</div>
            <span className="nav-dist">{NAV_STEPS[navIndex].dist}</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((navIndex + 1) / NAV_STEPS.length) * 100}%` }} />
            </div>
            <div className="nav-stats">
              <div className="stat-box">
                <span className="stat-label">ETA</span>
                <span className="stat-val">{9 - navIndex} min</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Left</span>
                <span className="stat-val">{620 - navIndex * 100} m</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Access</span>
                <span className="stat-val" style={{ color: "#2ecc71" }}>✓ Free</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Crowd</span>
                <span className="stat-val" style={{ color: navIndex === 2 ? "#f39c12" : "#2ecc71" }}>
                  {navIndex === 2 ? "⚠️ Med" : "Low"}
                </span>
              </div>
            </div>
            {navIndex === 2 && (
              <div className="alert-bar">
                <span>⚠️ Crowded hall reported ahead</span>
              </div>
            )}
            <div className="nav-actions">
              <button
                className="nav-btn secondary"
                onClick={() => setNavIndex((n) => Math.max(n - 1, 0))}
                disabled={navIndex === 0}
              >← Back</button>
              <button
                className="nav-btn primary"
                onClick={() => setNavIndex((n) => Math.min(n + 1, NAV_STEPS.length - 1))}
              >{navIndex >= NAV_STEPS.length - 1 ? "Arrived!" : "Next →"}</button>
            </div>
            <button
              className="nav-btn secondary"
              style={{ marginTop: "12px", background: "transparent", border: "1px solid #0f3460" }}
              onClick={() => setShowReport(true)}
            >
              🚨 Report obstacle on this route
            </button>
            <button
              className="nav-btn secondary"
              style={{ marginTop: "8px", background: "transparent", border: "1px solid #0f3460" }}
              onClick={() => setStep("routes")}
            >
              ← Change route
            </button>
          </div>
        )}
      </div>

      {/* Settings Overlay */}
      {settingsOpen && (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <h2 className="settings-title">Settings</h2>
            <p className="settings-subtitle">Accessibility preferences</p>
            <div className="setting-row">
              <div>
                <div className="setting-label">Voice guidance</div>
                <div className="setting-desc">Turn-by-turn audio directions</div>
              </div>
              <button
                className={`toggle ${settings.voice ? 'on' : ''}`}
                onClick={() => setSettings(s => ({ ...s, voice: !s.voice }))}
              >
                <span className="toggle-knob"></span>
              </button>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-label">Large text</div>
                <div className="setting-desc">Bigger fonts for easier reading</div>
              </div>
              <button
                className={`toggle ${settings.largeText ? 'on' : ''}`}
                onClick={() => setSettings(s => ({ ...s, largeText: !s.largeText }))}
              >
                <span className="toggle-knob"></span>
              </button>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-label">High contrast</div>
                <div className="setting-desc">Better visibility in bright light</div>
              </div>
              <button
                className={`toggle ${settings.highContrast ? 'on' : ''}`}
                onClick={() => setSettings(s => ({ ...s, highContrast: !s.highContrast }))}
              >
                <span className="toggle-knob"></span>
              </button>
            </div>
            <div className="legend">
              <div className="legend-title">Path difficulty</div>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="dot" style={{ background: '#2ecc71' }}></span>
                  Easy
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ background: '#f39c12' }}></span>
                  Moderate
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ background: '#e74c3c' }}></span>
                  Hard
                </div>
              </div>
            </div>
            <button className="close-btn" onClick={() => setSettingsOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Report Obstacle Overlay */}
      {showReport && (
        <div className="settings-overlay" onClick={() => setShowReport(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <h2 className="settings-title">Report Obstacle</h2>
            <p className="settings-subtitle">Help others on their way</p>
            <div className="setting-row">
              <label className="setting-label">Type of obstacle</label>
            </div>
            <select
              className="report-input"
              value={reportType}
              onChange={e => setReportType(e.target.value)}
            >
              <option value="stairs">Stairs / No elevator</option>
              <option value="construction">Construction</option>
              <option value="crowded">Very crowded</option>
              <option value="blocked">Path blocked</option>
              <option value="other">Other</option>
            </select>
            <div className="setting-row" style={{ marginTop: 12 }}>
              <label className="setting-label">Details (optional)</label>
            </div>
            <textarea
              className="report-input"
              rows={3}
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
              placeholder="Describe the obstacle..."
            />
            <div className="nav-actions">
              <button
                className="nav-btn secondary"
                onClick={() => setShowReport(false)}
              >
                Cancel
              </button>
              <button
                className="nav-btn primary"
                onClick={() => {
                  setShowReport(false);
                  setReportType('stairs');
                  setReportDetails('');
                }}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
