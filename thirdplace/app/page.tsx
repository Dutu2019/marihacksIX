"use client";

import { useState, useRef } from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const PROFILES = ["Wheelchair", "Cane", "Walker", "Low crowd"] as const;
type Profile = typeof PROFILES[number];

const getIcon = (p: Profile) => p === "Wheelchair" ? "♿" : p === "Cane" ? "🦯" : p === "Walker" ? "🚶" : "👥";

const routes = [
  { name: "Best accessible", time: "9 min", dist: "620 m", tags: ["No stairs", "1 elevator", "Smooth"], good: true },
  { name: "Gentler incline", time: "11 min", dist: "710 m", tags: ["Less steep", "Longer", "Quiet"], good: false },
  { name: "Quiet route", time: "10 min", dist: "690 m", tags: ["Low traffic", "1 narrow"], good: false },
];

export default function AccessibleMap() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [destination, setDestination] = useState<null | { name: string; lat: number; lng: number }>(null);
  const [profile, setProfile] = useState<Profile>("Wheelchair");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const mapRef = useRef<any>(null);

  // Geocode any address using Nominatim (free, no API key)
  const searchAddress = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=ca&addressdetails=1`
      );
      const data = await res.json();
      setSearchResults(
        data.map((d: any) => ({
          name: d.display_name.split(",").slice(0, 3).join(",").trim(),
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        }))
      );
    } catch (e) { console.error(e); }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => searchAddress(val), 400);
    setDebounceTimer(timer as any);
  };

  const selectDestination = (loc: { name: string; lat: number; lng: number }) => {
    setDestination(loc);
    setSearchResults([]);
    setQuery("");
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 16, duration: 1500 });
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#1a1a2e", color: "#fff", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .top-overlay { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 100; display: flex; gap: 12px; flex-wrap: wrap; pointer-events: none; }
        .top-overlay > * { pointer-events: auto; }
        .search-card { flex: 1; min-width: 200px; background: rgba(15, 52, 96, 0.98); backdrop-filter: blur(10px); border-radius: 14px; padding: 10px 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .search-input { width: 100%; background: transparent; border: none; color: #fff; font-size: 15px; outline: none; }
        .search-input::placeholder { color: #888; }
        .results-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: rgba(15, 52, 96, 0.98); backdrop-filter: blur(10px); border-radius: 12px; overflow: hidden; z-index: 200; box-shadow: 0 8px 30px rgba(0,0,0,0.5); margin-top: 4px; }
        .result-item { padding: 12px 14px; cursor: pointer; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .result-item:hover { background: rgba(233, 69, 96, 0.2); }
        .profile-chip { padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15, 52, 96, 0.95); color: #fff; font-size: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .profile-chip.active { background: #e94560; border-color: #e94560; }
        .map-container { flex: 1; width: 100%; min-height: 0; }
        .bottom-panel { background: rgba(22, 33, 62, 0.98); backdrop-filter: blur(10px); border-radius: 20px 20px 0 0; padding: 16px; position: relative; z-index: 50; max-height: 45%; overflow-y: auto; box-shadow: 0 -4px 30px rgba(0,0,0,0.3); }
        .handle { width: 40px; height: 4px; background: #0f3460; border-radius: 2px; margin: 0 auto 12px; }
        .section-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
        .section-subtitle { font-size: 12px; color: #888; margin-bottom: 12px; }
        .destination-bar { display: flex; align-items: center; gap: 8px; background: rgba(15, 52, 96, 0.5); border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; }
        .destination-name { font-weight: 600; font-size: 13px; }
        .route-card { background: rgba(15, 52, 96, 0.6); border-radius: 12px; padding: 12px; margin-bottom: 8px; cursor: pointer; border: 2px solid transparent; text-align: left; transition: all 0.2s; }
        .route-card:hover { border-color: rgba(233, 69, 96, 0.4); }
        .route-card.selected { border-color: #e94560; background: rgba(15, 52, 96, 0.8); }
        .route-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .route-name { font-size: 14px; font-weight: 600; }
        .route-meta { font-size: 11px; color: #888; }
        .route-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .tag { padding: 2px 8px; border-radius: 8px; font-size: 10px; }
        .tag.good { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        .tag.warn { background: rgba(243, 156, 18, 0.15); color: #f39c12; }
        .nav-section { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; margin-top: 8px; }
        .nav-step { font-size: 16px; font-weight: 500; margin-bottom: 6px; }
        .nav-dist { font-size: 24px; font-weight: 700; color: #e94560; display: block; }
        .progress-bar { height: 3px; background: #0f3460; border-radius: 2px; margin: 10px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: #e94560; border-radius: 2px; transition: width 0.3s; }
        .alert-bar { background: rgba(243, 156, 18, 0.15); border: 1px solid rgba(243, 156, 18, 0.3); border-radius: 8px; padding: 6px 10px; font-size: 11px; color: #f39c12; margin-bottom: 10px; }
        .cta-btn { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #e94560; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
      `}</style>

      {/* Top Overlay - Search + Profiles */}
      <div className="top-overlay">
        <div className="search-card">
          <input
            className="search-input"
            placeholder="🔍 Search any address or place..."
            value={query}
            onChange={handleQueryChange}
          />
          {searchResults.length > 0 && (
            <div className="results-dropdown">
              {searchResults.map((loc, i) => (
                <div key={i} className="result-item" onClick={() => selectDestination(loc)}>
                  {loc.name}
                </div>
              ))}
            </div>
          )}
        </div>
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

      {/* Full Screen Map */}
      <div className="map-container">
        <Map
          ref={mapRef}
          mapStyle="https://demotiles.maplibre.org/style.json"
          initialViewState={{ longitude: -73.6214, latitude: 45.5324, zoom: 13 }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Bottom Panel - Always Visible */}
      <div className="bottom-panel">
        <div className="handle" />

        {/* Destination Summary */}
        <div className="section-subtitle">
          {destination ? (
            <div className="destination-bar">
              <span>📍</span>
              <span className="destination-name">{destination.name}</span>
              <span style={{ color: "#888", fontSize: "11px" }}>· {profile}</span>
            </div>
          ) : (
            "Search for any address or place to find an accessible route"
          )}
        </div>

        {/* Alert */}
        {destination && (
          <div className="alert-bar">
            ⚠️ 2 accessibility alerts near this area · Crowd level: Medium
          </div>
        )}

        {/* Routes Section */}
        <div className="section-title">Suggested Routes</div>
        <div className="section-subtitle">For {profile.toLowerCase()} — sorted by accessibility</div>
        {routes.map((r, i) => (
          <button key={r.name} className={`route-card ${i === 0 ? "selected" : ""}`}>
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

        {/* Navigation Section */}
        {destination && (
          <div className="nav-section">
            <div className="section-title" style={{ marginTop: "8px" }}>Navigation</div>
            <div className="section-subtitle">Turn-by-turn accessible directions</div>
            <div className="nav-step">Head straight for 50 m toward the main entrance</div>
            <span className="nav-dist">50 m</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "17%" }} />
            </div>
            <button className="cta-btn">Start Navigation →</button>
          </div>
        )}
      </div>
    </div>
  );
}
