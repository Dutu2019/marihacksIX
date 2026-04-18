"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const PROFILES = ["Wheelchair", "Cane", "Walker", "Low crowd"] as const;
type Profile = typeof PROFILES[number];

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
  distance?: number;
}

interface Route {
  name: string;
  desc: string;
  duration: string;
  distance: string;
  badges: string[];
  confidence: "High" | "Medium" | "Low";
}

interface Obstacle {
  id: number;
  type: string;
  lat: number;
  lng: number;
  label: string;
}

const LOCATIONS: SearchResult[] = [
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

const OBSTACLES: Obstacle[] = [
  { id: 1, type: "stairs", lat: 45.5285, lng: -73.6195, label: "Stairs" },
  { id: 2, type: "elevator", lat: 45.5310, lng: -73.6225, label: "Elevator" },
  { id: 3, type: "ramp", lat: 45.5340, lng: -73.6200, label: "Ramp" },
  { id: 4, type: "crowded", lat: 45.5295, lng: -73.6180, label: "Crowded" },
  { id: 5, type: "narrow", lat: 45.5330, lng: -73.6210, label: "Narrow" },
  { id: 6, type: "rough", lat: 45.5305, lng: -73.6170, label: "Rough path" },
  { id: 7, type: "elevator", lat: 45.5275, lng: -73.6235, label: "Elevator OK" },
  { id: 8, type: "stairs", lat: 45.5350, lng: -73.6190, label: "Stairs" },
];

const REPORT_TYPES = [
  { icon: "🚫", label: "Broken elevator", value: "elevator_broken" },
  { icon: "🪜", label: "Stairs only", value: "stairs_only" },
  { icon: "🚧", label: "Blocked path", value: "blocked" },
  { icon: "👥", label: "Too crowded", value: "crowded" },
  { icon: "❄️", label: "Ice / snow", value: "ice" },
  { icon: "✍️", label: "Other", value: "other" },
];

const SETTINGS_OPTIONS = [
  { key: "largerText", label: "Larger text", desc: "Improve readability on the move" },
  { key: "highContrast", label: "High contrast", desc: "Boost route and map marker separation" },
  { key: "voiceGuidance", label: "Voice guidance", desc: "Hear upcoming turns and warnings" },
  { key: "reduceMotion", label: "Reduce motion", desc: "Minimize animations and transitions" },
  { key: "avoidIndoor", label: "Avoid indoor paths", desc: "Prefer outdoor routes when possible" },
  { key: "verifiedOnly", label: "Verified routes only", desc: "Hide low-confidence paths" },
];

const NAV_INSTRUCTIONS = [
  "Head straight for 50 m toward the main entrance",
  "Turn right toward the elevator lobby",
  "Take the elevator to floor 2",
  "Turn left and continue for 80 m",
  "Ramp ahead - slight incline for 30 m",
  "You have arrived at your destination",
];

export default function Home() {
  const [currentView, setCurrentView] = useState<"home" | "routing" | "navigate" | "report" | "settings">("home");
  const [profile, setProfile] = useState<Profile>("Wheelchair");
  const [destination, setDestination] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLocations, setFilteredLocations] = useState<SearchResult[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [navStep, setNavStep] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<string>("");
  const [reportNote, setReportNote] = useState("");
  const [settings, setSettings] = useState<Record<string, boolean>>({
    largerText: false,
    highContrast: false,
    voiceGuidance: true,
    reduceMotion: false,
    avoidIndoor: false,
    verifiedOnly: false,
  });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  // Initialize map
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

  // Filter locations based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = LOCATIONS.filter((loc) =>
        loc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLocations(filtered);
    } else {
      setFilteredLocations([]);
    }
  }, [searchQuery]);

  const handleProfileSelect = useCallback((p: Profile) => setProfile(p), []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleSelectLocation = useCallback((loc: SearchResult) => {
    setDestination(loc.name);
    setSearchQuery("");
    setFilteredLocations([]);
  }, []);

  const handleFindRoute = useCallback(() => {
    if (!destination) return;
    const mockRoutes: Route[] = [
      {
        name: "Best accessible",
        desc: "Optimized for " + profile.toLowerCase() + " - low slope, step-free",
        duration: "9 min",
        distance: "620 m",
        badges: ["No stairs", "1 elevator", "Smooth surface"],
        confidence: "High",
      },
      {
        name: "Gentler incline",
        desc: "Longer but easier on joints",
        duration: "11 min",
        distance: "710 m",
        badges: ["Gentler incline", "Longer path", "Least crowded"],
        confidence: "Medium",
      },
      {
        name: "Quiet route",
        desc: "Avoids busy areas",
        duration: "10 min",
        distance: "690 m",
        badges: ["Quiet route", "1 narrow segment"],
        confidence: "Medium",
      },
    ];
    setRoutes(mockRoutes);
    setSelectedRoute(0);
    setCurrentView("routing");
  }, [destination, profile]);

  const handleStartNavigation = useCallback(() => {
    if (selectedRoute === null) return;
    setNavStep(0);
    setCurrentView("navigate");
  }, [selectedRoute]);

  const handleNextStep = useCallback(() => {
    setNavStep((prev) => Math.min(prev + 1, NAV_INSTRUCTIONS.length - 1));
  }, []);

  const handlePrevStep = useCallback(() => {
    setNavStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleToggleSetting = useCallback((key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSubmitReport = useCallback(() => {
    if (reportType) {
      alert("Report submitted! Thank you for helping improve routes.");
      setReportType("");
      setReportNote("");
      setShowReport(false);
    }
  }, [reportType]);

  const getProfileIcon = (p: Profile) => {
    if (p === "Wheelchair") return "♿";
    if (p === "Cane") return "🦯";
    if (p === "Walker") return "🚶";
    return "👥";
  };

  return (
    <div className="app">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .app { min-height: 100vh; background: #1a1a2e; color: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #16213e; border-bottom: 1px solid #0f3460; }
        .header-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
        .header-btn { background: none; border: none; color: #e94560; font-size: 14px; cursor: pointer; padding: 4px 8px; }
        .map-container { height: 45vh; position: relative; }
        .bottom-panel { background: #16213e; border-radius: 20px 20px 0 0; margin-top: -20px; position: relative; z-index: 10; padding: 20px 16px; min-height: 55vh; }
        .search-box { position: relative; margin-bottom: 16px; }
        .search-input { width: 100%; padding: 14px 44px 14px 16px; border-radius: 12px; border: none; background: #0f3460; color: #fff; font-size: 15px; outline: none; }
        .search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 18px; }
        .search-results { position: absolute; top: 100%; left: 0; right: 0; background: #0f3460; border-radius: 12px; margin-top: 4px; overflow: hidden; z-index: 100; }
        .search-result-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #16213e; }
        .search-result-item:hover { background: #1a1a2e; }
        .profile-label { font-size: 13px; color: #888; margin-bottom: 8px; }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .chip { padding: 8px 14px; border-radius: 20px; border: 1px solid #0f3460; background: transparent; color: #fff; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .chip.active { background: #e94560; border-color: #e94560; }
        .cta-section { background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); border-radius: 12px; padding: 16px; margin-top: 8px; }
        .cta-text { font-size: 13px; color: #aaa; margin-bottom: 4px; }
        .primary-btn { width: 100%; padding: 14px; border-radius: 12px; border: none; background: #e94560; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        .nearby-alerts { font-size: 12px; color: #f39c12; margin-top: 8px; display: flex; align-items: center; gap: 4px; }
        .back-btn { background: none; border: none; color: #e94560; font-size: 14px; cursor: pointer; padding: 4px 0; margin-bottom: 12px; }
        .panel-title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
        .panel-desc { font-size: 13px; color: #888; margin-bottom: 16px; }
        .route-card { width: 100%; background: #0f3460; border-radius: 12px; padding: 14px; margin-bottom: 10px; cursor: pointer; border: 2px solid transparent; text-align: left; }
        .route-card.selected { border-color: #e94560; }
        .route-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .route-name { font-size: 14px; font-weight: 600; }
        .route-time { font-size: 13px; color: #888; }
        .route-desc { font-size: 12px; color: #aaa; margin-bottom: 8px; }
        .badge-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .badge { padding: 3px 8px; border-radius: 10px; font-size: 11px; }
        .badge.good { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
        .badge.warn { background: rgba(243, 156, 18, 0.2); color: #f39c12; }
        .nav-panel { text-align: center; }
        .nav-instruction { font-size: 16px; margin-bottom: 12px; line-height: 1.4; }
        .instruction-distance { font-size: 28px; font-weight: 700; color: #e94560; display: block; margin: 8px 0; }
        .nav-progress { height: 4px; background: #0f3460; border-radius: 2px; margin: 16px 0; overflow: hidden; }
        .nav-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .stat { background: #0f3460; border-radius: 10px; padding: 12px; }
        .stat-label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
        .stat-value { font-size: 16px; font-weight: 600; }
        .report-panel { text-align: center; }
        .report-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }
        .report-tile { background: #0f3460; border-radius: 12px; padding: 16px 10px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; }
        .report-tile.selected { border-color: #e94560; }
        .report-tile-icon { font-size: 24px; margin-bottom: 4px; }
        .report-tile-label { font-size: 11px; color: #aaa; }
        .report-input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #0f3460; background: transparent; color: #fff; font-size: 14px; margin-bottom: 12px; outline: none; }
        .settings-panel { padding-top: 8px; }
        .settings-section { margin-bottom: 20px; }
        .settings-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
        .settings-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #0f3460; }
        .settings-item-label { font-size: 14px; }
        .settings-item-desc { font-size: 12px; color: #666; }
        .settings-item-info { font-size: 12px; color: #666; margin-top: 4px; }
        .toggle { width: 48px; height: 26px; background: #0f3460; border-radius: 13px; position: relative; cursor: pointer; transition: all 0.2s; }
        .toggle.on { background: #e94560; }
        .toggle-knob { width: 22px; height: 22px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: all 0.2s; }
        .toggle.on .toggle-knob { left: 24px; }
        .map-legend { margin-top: 16px; padding-top: 16px; border-top: 1px solid #0f3460; }
        .legend-title { font-size: 13px; color: #888; margin-bottom: 8px; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #aaa; margin-bottom: 4px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="header-title">
          <span>🧭</span>
          ACCESSROUTE
        </div>
        {currentView !== "home" && (
          <button className="header-btn" onClick={() => setCurrentView("home")}>Home</button>
        )}
        <button className="header-btn" onClick={() => setCurrentView("settings")}>Settings</button>
      </header>

      {/* Map */}
      {currentView === "home" && (
        <div className="map-container" ref={mapRef} />
      )}

      {/* Home Panel */}
      {currentView === "home" && (
        <div className="bottom-panel home-panel">
          <div className="search-box">
            <input
              className="search-input"
              placeholder="Where do you want to go?"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery && setFilteredLocations(LOCATIONS.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())))}
            />
            <span className="search-icon">🔍</span>
            {filteredLocations.length > 0 && (
              <div className="search-results">
                {filteredLocations.map((loc) => (
                  <div key={loc.name} className="search-result-item" onClick={() => handleSelectLocation(loc)}>
                    {loc.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-selector">
            <p className="profile-label">Select your mobility profile</p>
            <div className="chips">
              {PROFILES.map((p) => (
                <button
                  key={p}
                  className={`chip ${profile === p ? "active" : ""}`}
                  onClick={() => handleProfileSelect(p)}
                >
                  {getProfileIcon(p)} {p}
                </button>
              ))}
            </div>
          </div>

          <div className="cta-section">
            <p className="cta-text">Optimized for <strong>{profile.toLowerCase()}</strong> access, low slope, and elevator availability</p>
            <button className="primary-btn" onClick={handleFindRoute}>
              Find accessible route
            </button>
            <div className="nearby-alerts">
              <span>⚠️ 2 nearby alerts</span>
            </div>
          </div>

          <div className="map-legend">
            <p className="legend-title">Map Legend</p>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#e94560" }}></span> Main accessible route</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#2ecc71" }}></span> Elevator / accessible entry</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#3498db" }}></span> Ramp or curb cut</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#f39c12" }}></span> Caution area / crowding</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#e74c3c" }}></span> Barrier / inaccessible</div>
          </div>
        </div>
      )}

      {/* Routing Panel */}
      {currentView === "routing" && (
        <div className="bottom-panel routing-panel">
          <button className="back-btn" onClick={() => setCurrentView("home")}>← Back to search</button>
          <h2 className="panel-title">Choose a route</h2>
          <p className="panel-desc">The best option is selected for {profile.toLowerCase()} - low slope and step-free access</p>

          {routes.map((r, i) => (
            <button
              key={r.name}
              className={`route-card ${selectedRoute === i ? "selected" : ""}`}
              onClick={() => setSelectedRoute(i)}
            >
              <div className="route-top">
                <span className="route-name">{r.name}</span>
                <span className="route-time">{r.duration} · {r.distance}</span>
              </div>
              <div className="route-desc">{r.desc}</div>
              <div className="badge-row">
                <span className={`badge ${r.confidence === "High" ? "good" : "warn"}`}>{r.confidence} confidence</span>
                {r.badges.map((b) => (
                  <span key={b} className="badge good">{b}</span>
                ))}
              </div>
            </button>
          ))}

          <button className="primary-btn" onClick={handleStartNavigation}>
            Start accessible route
          </button>

          <div className="map-legend">
            <p className="legend-title">Route Legend</p>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#e94560" }}></span> Selected route</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#2ecc71" }}></span> Step-free path</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#3498db" }}></span> Elevator access</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#f39c12" }}></span> Caution zone</div>
          </div>
        </div>
      )}

      {/* Navigation Panel */}
      {currentView === "navigate" && (
        <div className="bottom-panel nav-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <button className="back-btn" onClick={() => setCurrentView("routing")}>← Exit navigation</button>
            <span style={{ fontSize: "12px", color: "#e94560" }}>{settings.voiceGuidance ? "🔊 Voice on" : "🔇 Voice off"}</span>
          </div>

          <h2 className="panel-title" style={{ fontSize: "14px", color: "#888", marginBottom: "8px" }}>Heading to</h2>
          <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>{destination || "Your destination"}</p>

          <div className="nav-instruction">
            <p style={{ fontSize: "18px", fontWeight: 500 }}>{NAV_INSTRUCTIONS[navStep]}</p>
            <span className="instruction-distance">{navStep === 0 ? "50 m" : navStep === 1 ? "80 m" : navStep === 2 ? "1 floor" : navStep === 3 ? "80 m" : navStep === 4 ? "30 m" : "0 m"} to next turn</span>
          </div>

          <div className="nav-progress">
            <span style={{ display: "block", width: `${((navStep + 1) / NAV_INSTRUCTIONS.length) * 100}%`, height: "100%", background: "#e94560", borderRadius: "2px", transition: "width 0.3s" }} />
          </div>

          <div className="nav-stats">
            <div className="stat">
              <span className="stat-label">ETA</span>
              <span className="stat-value">{9 - navStep} min</span>
            </div>
            <div className="stat">
              <span className="stat-label">Distance left</span>
              <span className="stat-value">{620 - navStep * 100} m</span>
            </div>
            <div className="stat">
              <span className="stat-label">Accessibility</span>
              <span className="stat-value" style={{ color: "#2ecc71" }}>Step-free ✓</span>
            </div>
            <div className="stat">
              <span className="stat-label">Crowding</span>
              <span className="stat-value" style={{ color: navStep === 2 ? "#f39c12" : "#2ecc71" }}>{navStep === 2 ? "⚠️ Crowded" : "Low"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button className="primary-btn" style={{ flex: 1, background: "#0f3460" }} onClick={handlePrevStep} disabled={navStep === 0}>← Previous</button>
            <button className="primary-btn" style={{ flex: 1 }} onClick={handleNextStep} disabled={navStep >= NAV_INSTRUCTIONS.length - 1}>
              {navStep >= NAV_INSTRUCTIONS.length - 1 ? "Arrived!" : "Next step →"}
            </button>
          </div>

          <button className="header-btn" style={{ width: "100%", border: "1px solid #0f3460", borderRadius: "10px", padding: "10px" }} onClick={() => setShowReport(true)}>
            🚨 Report an obstacle on this route
          </button>
        </div>
      )}

      {/* Report Panel (Modal Overlay) */}
      {showReport && (
        <div className="bottom-panel report-panel" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#1a1a2e", zIndex: 100, overflowY: "auto" }}>
          <div style={{ padding: "20px 16px" }}>
            <button className="header-btn" onClick={() => setShowReport(false)} style={{ fontSize: "16px", marginBottom: "12px" }}>✕ Close</button>
            <h2 className="panel-title">Report obstacle</h2>
            <p className="panel-desc">Help improve route quality for the next person.</p>

            <div className="report-grid">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.value}
                  className={`report-tile ${reportType === t.value ? "selected" : ""}`}
                  onClick={() => setReportType(t.value)}
                >
                  <div className="report-tile-icon">{t.icon}</div>
                  <div className="report-tile-label">{t.label}</div>
                </button>
              ))}
            </div>

            <input
              className="report-input"
              placeholder="Location (e.g., Main building elevator near east entrance)"
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
            />

            <textarea
              className="report-input"
              placeholder="Optional note..."
              rows={3}
              style={{ resize: "none" }}
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
            />

            <button className="primary-btn" onClick={handleSubmitReport}>
              Submit report
            </button>

            <p style={{ fontSize: "12px", color: "#666", textAlign: "center", marginTop: "12px" }}>
              Reports can expire automatically after a short time unless reconfirmed.
            </p>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {currentView === "settings" && (
        <div className="bottom-panel settings-panel">
          <h2 className="panel-title">Accessibility settings</h2>
          <p className="panel-desc">Customize your experience for your needs</p>

          <div className="settings-section">
            <h3 className="settings-title">Preferences</h3>
            {SETTINGS_OPTIONS.map((opt) => (
              <div key={opt.key} className="settings-item">
                <div>
                  <div className="settings-item-label">{opt.label}</div>
                  <div className="settings-item-desc">{opt.desc}</div>
                </div>
                <div
                  className={`toggle ${settings[opt.key] ? "on" : ""}`}
                  onClick={() => handleToggleSetting(opt.key)}
                >
                  <div className="toggle-knob" />
                </div>
              </div>
            ))}
          </div>

          <div className="settings-section">
            <h3 className="settings-title">Theme</h3>
            <div className="settings-item">
              <div className="settings-item-label">Dark mode</div>
              <div className="settings-item-desc">Currently enabled</div>
            </div>
            <div className="settings-item">
              <div className="settings-item-label">High contrast mode</div>
              <div
                className={`toggle ${settings.highContrast ? "on" : ""}`}
                onClick={() => handleToggleSetting("highContrast")}
              >
                <div className="toggle-knob" />
              </div>
            </div>
          </div>

          <button className="primary-btn" onClick={() => setCurrentView("home")}>
            Save preferences
          </button>

          <div className="map-legend">
            <p className="legend-title">About AccessRoute</p>
            <p className="settings-item-info" style={{ marginBottom: "8px" }}>
              Built at MariHacks IX - Helping people with reduced mobility find safer, more accessible routes through Montreal.
            </p>
            <p className="settings-item-info">
              Report obstacles, get real-time alerts, and navigate with confidence. Every report helps the community.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
