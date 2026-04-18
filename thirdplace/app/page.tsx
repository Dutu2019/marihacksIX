"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  geocode,
  runAgentLoop,
  type GeoResult,
  type RouteResult,
  type Profile,
  type LogEntry,
  type LatLng,
} from "../lib/routing";

// Leaflet can only render client-side (no SSR)
const MapView = dynamic(() => import("../components/MapView"), { ssr: false });

const PROFILES: Profile[] = ["Wheelchair", "Cane", "Walker", "Low crowd"];
const PROFILE_ICONS: Record<Profile, string> = {
  Wheelchair: "♿",
  Cane: "🦯",
  Walker: "🚶",
  "Low crowd": "👥",
};

// Montreal as default — change to your city
const DEFAULT_CENTER: LatLng = { lat: 45.5017, lng: -73.5673 };

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────
  const [profile, setProfile]             = useState<Profile>("Wheelchair");
  const [query, setQuery]                 = useState("");
  const [originQuery, setOriginQuery]     = useState("");
  const [suggestions, setSuggestions]     = useState<GeoResult[]>([]);
  const [originSuggestions, setOriginSuggestions] = useState<GeoResult[]>([]);
  const [activeSearch, setActiveSearch]   = useState<"origin" | "dest" | null>(null);
  const [origin, setOrigin]               = useState<LatLng | null>(null);
  const [originName, setOriginName]       = useState("");
  const [destination, setDestination]     = useState<LatLng | null>(null);
  const [destName, setDestName]           = useState("");
  const [mapCenter, setMapCenter]         = useState(DEFAULT_CENTER);
  const [routes, setRoutes]               = useState<RouteResult[]>([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [loading, setLoading]             = useState(false);
  const [agentLog, setAgentLog]           = useState<LogEntry[]>([]);
  const [showLog, setShowLog]             = useState(false);
  const [panel, setPanel]                 = useState<"search" | "routes" | "nav">("search");
  const [navStep, setNavStep]             = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logBoxRef   = useRef<HTMLDivElement>(null);

  // Auto-scroll agent log
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [agentLog]);

  // ── Geocode search ─────────────────────────────────────────────────────
  const handleSearch = useCallback((val: string, type: "origin" | "dest") => {
    if (type === "dest")   setQuery(val);
    else                   setOriginQuery(val);
    setActiveSearch(type);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await geocode(val);
      if (type === "dest") setSuggestions(results);
      else                 setOriginSuggestions(results);
    }, 380);
  }, []);

  const pickOrigin = (loc: GeoResult) => {
    setOrigin({ lat: loc.lat, lng: loc.lng });
    setOriginName(loc.name);
    setOriginQuery(loc.name);
    setOriginSuggestions([]);
    setMapCenter({ lat: loc.lat, lng: loc.lng });
  };

  const pickDestination = (loc: GeoResult) => {
    setDestination({ lat: loc.lat, lng: loc.lng });
    setDestName(loc.name);
    setQuery(loc.name);
    setSuggestions([]);
    setMapCenter({ lat: loc.lat, lng: loc.lng });
  };

  // Clicking on map sets destination
  const handleMapClick = useCallback((latlng: LatLng) => {
    setDestination(latlng);
    setDestName(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    setQuery(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    setSuggestions([]);
  }, []);

  // ── Find routes ────────────────────────────────────────────────────────
  const findRoutes = async () => {
    if (!destination) return;

    const fromPoint = origin ?? DEFAULT_CENTER;
    setLoading(true);
    setRoutes([]);
    setAgentLog([]);
    setShowLog(true);
    setPanel("search");

    await runAgentLoop(
      fromPoint,
      destination,
      profile,
      (entry) => setAgentLog((prev) => [...prev, entry]),
      (results) => {
        setRoutes(results);
        setSelectedRoute(0);
        setPanel("routes");
        setShowLog(false);
      }
    );

    setLoading(false);
  };

  // ── Nav steps (simplified) ─────────────────────────────────────────────
  const currentRoute = routes[selectedRoute];
  const totalSteps   = currentRoute ? Math.max(2, Math.ceil(currentRoute.distanceM / 150)) : 0;
  const progressPct  = totalSteps > 0 ? Math.round((navStep / totalSteps) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative", overflow: "hidden" }}>

      {/* ── FULL-SCREEN MAP ─────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <MapView
          center={mapCenter}
          origin={origin}
          destination={destination}
          routes={routes}
          selectedRouteIndex={selectedRoute}
          onMapClick={handleMapClick}
        />
      </div>

      {/* ── TOP SEARCH BAR ──────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 12, left: 12, right: 12,
        zIndex: 500, display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none",
      }}>
        {/* Origin input */}
        <div style={{ pointerEvents: "auto", position: "relative" }}>
          <div style={searchCardStyle}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔵</span>
            <input
              style={inputStyle}
              placeholder="From — your location or any address"
              value={originQuery}
              onChange={(e) => handleSearch(e.target.value, "origin")}
              onFocus={() => setActiveSearch("origin")}
            />
            {originQuery && (
              <button
                style={clearBtnStyle}
                onClick={() => { setOriginQuery(""); setOrigin(null); setOriginName(""); setOriginSuggestions([]); }}
              >✕</button>
            )}
          </div>
          {activeSearch === "origin" && originSuggestions.length > 0 && (
            <div style={dropdownStyle}>
              {originSuggestions.map((loc, i) => (
                <div key={i} style={dropdownItemStyle}
                  onClick={() => { pickOrigin(loc); setActiveSearch(null); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(252,76,2,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 14 }}>📍</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{loc.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{loc.fullName.split(",").slice(2, 4).join(",")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Destination input */}
        <div style={{ pointerEvents: "auto", position: "relative" }}>
          <div style={searchCardStyle}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
            <input
              style={inputStyle}
              placeholder="To — search any address or tap the map"
              value={query}
              onChange={(e) => handleSearch(e.target.value, "dest")}
              onFocus={() => setActiveSearch("dest")}
            />
            {query && (
              <button
                style={clearBtnStyle}
                onClick={() => { setQuery(""); setDestination(null); setDestName(""); setSuggestions([]); setRoutes([]); setPanel("search"); }}
              >✕</button>
            )}
          </div>
          {activeSearch === "dest" && suggestions.length > 0 && (
            <div style={dropdownStyle}>
              {suggestions.map((loc, i) => (
                <div key={i} style={dropdownItemStyle}
                  onClick={() => { pickDestination(loc); setActiveSearch(null); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(252,76,2,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 14 }}>📍</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{loc.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{loc.fullName.split(",").slice(2, 4).join(",")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", pointerEvents: "auto" }}>
          {PROFILES.map((p) => (
            <button
              key={p}
              onClick={() => setProfile(p)}
              style={{
                padding: "6px 12px", borderRadius: 20,
                border: `1.5px solid ${profile === p ? "#FC4C02" : "var(--divider)"}`,
                background: profile === p ? "#FFF1EB" : "rgba(255,255,255,0.95)",
                color: profile === p ? "#FC4C02" : "var(--muted)",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                backdropFilter: "blur(8px)", whiteSpace: "nowrap",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              {PROFILE_ICONS[p]} {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAP HINT ────────────────────────────────────────────────── */}
      {!destination && !loading && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
          borderRadius: 14, padding: "12px 18px",
          fontSize: 13, color: "var(--muted)", zIndex: 100,
          border: "0.5px solid var(--divider)", pointerEvents: "none",
          textAlign: "center",
        }}>
          Search an address above or tap the map to set a destination
        </div>
      )}

      {/* ── BOTTOM PANEL ────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 500,
        background: "var(--surface)", borderRadius: "22px 22px 0 0",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.12)",
        border: "0.5px solid var(--divider)",
        maxHeight: "55vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Handle */}
        <div style={{ padding: "12px 18px 0", flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, background: "var(--divider)", borderRadius: 2, margin: "0 auto 12px" }} />
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "0 18px 20px", flex: 1 }}>

          {/* AGENT LOG — shows while loading */}
          {showLog && agentLog.length > 0 && (
            <div ref={logBoxRef} style={{
              background: "#1F1F1C", borderRadius: 12, padding: "10px 14px",
              fontFamily: "monospace", fontSize: 11, lineHeight: 1.8,
              maxHeight: 130, overflowY: "auto", marginBottom: 10,
            }}>
              {agentLog.map((e, i) => (
                <div key={i} style={{
                  color: e.type === "agent" ? "#FC4C02"
                       : e.type === "tool"   ? "#60a5fa"
                       : e.type === "result" ? "#34d399"
                       : "#9CA3AF",
                  fontStyle: e.type === "think" ? "italic" : "normal",
                }}>{e.message}</div>
              ))}
              {loading && <div style={{ color: "#FC4C02" }}>▊</div>}
            </div>
          )}

          {/* SEARCH PANEL */}
          {panel === "search" && !loading && (
            <div>
              {destination ? (
                <>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                    Destination set: <strong style={{ color: "var(--text)" }}>{destName}</strong>
                  </div>
                  <button onClick={findRoutes} style={primaryBtnStyle}>
                    Find accessible route →
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>
                  Search an address above or tap the map to set your destination
                </div>
              )}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Finding the most accessible routes…</div>
            </div>
          )}

          {/* ROUTES PANEL */}
          {panel === "routes" && routes.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Accessible routes</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    To {destName} — sorted by accessibility score
                  </div>
                </div>
                <button
                  onClick={() => { setPanel("search"); setRoutes([]); }}
                  style={{ background: "none", border: "none", color: "var(--orange)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >← Back</button>
              </div>

              <div style={{ marginBottom: 10 }} />

              {routes.map((r, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedRoute(i)}
                  style={{
                    background: i === selectedRoute ? "#FFF1EB" : "var(--bg)",
                    border: `1.5px solid ${i === selectedRoute ? "#FC4C02" : "var(--divider)"}`,
                    borderRadius: 14, padding: "12px 14px", marginBottom: 8,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.name}</span>
                      {i === 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: "#FC4C02", color: "white" }}>
                          Best
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {r.timeMin} min · {r.distanceM >= 1000 ? (r.distanceM / 1000).toFixed(1) + " km" : r.distanceM + " m"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: "#FC4C02" }}>{r.score}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>/100 accessibility</span>
                  </div>

                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {r.tags.map((t) => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, fontWeight: 500, background: "#D1FAE5", color: "#065F46" }}>{t}</span>
                    ))}
                    {r.penalties.map((t) => (
                      <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, fontWeight: 500, background: "#FEF3C7", color: "#92400E" }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setPanel("nav")}
                style={primaryBtnStyle}
              >
                Start navigation →
              </button>
            </div>
          )}

          {/* NAV PANEL */}
          {panel === "nav" && currentRoute && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Navigating</div>
                <button
                  onClick={() => setPanel("routes")}
                  style={{ background: "none", border: "none", color: "var(--orange)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >← Routes</button>
              </div>

              <div style={{ background: "var(--bg)", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Current step</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {navStep === 0
                    ? "Head toward the accessible entrance"
                    : navStep < totalSteps - 1
                    ? `Continue for ${Math.round((currentRoute.distanceM / totalSteps) * (totalSteps - navStep))}m`
                    : "You have arrived at your destination"
                  }
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#FC4C02", margin: "6px 0" }}>
                  {currentRoute.timeMin - Math.round(navStep * currentRoute.timeMin / totalSteps)} min left
                </div>
                <div style={{ height: 4, background: "var(--divider)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: progressPct + "%", background: "#FC4C02", borderRadius: 2, transition: "width 0.4s" }} />
                </div>
              </div>

              {currentRoute.bonuses.map((b) => (
                <div key={b} style={{
                  background: "#D1FAE5", borderRadius: 10, padding: "6px 10px",
                  fontSize: 12, color: "#065F46", marginBottom: 6, fontWeight: 500,
                }}>✓ {b}</div>
              ))}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setNavStep((s) => Math.max(0, s - 1))}
                  disabled={navStep === 0}
                  style={{ ...primaryBtnStyle, flex: 1, background: "var(--bg)", color: "var(--text)", border: "1px solid var(--divider)" }}
                >← Prev</button>
                <button
                  onClick={() => setNavStep((s) => Math.min(totalSteps, s + 1))}
                  disabled={navStep >= totalSteps}
                  style={{ ...primaryBtnStyle, flex: 2 }}
                >{navStep >= totalSteps ? "Arrived ✓" : "Next step →"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared style objects ────────────────────────────────────────────────────

const searchCardStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
  borderRadius: 14, padding: "10px 14px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
  border: "0.5px solid rgba(0,0,0,0.08)",
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none", outline: "none",
  fontSize: 14, color: "var(--text)", fontFamily: "inherit",
};

const clearBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--muted)", fontSize: 14, padding: 0, flexShrink: 0,
  fontFamily: "inherit",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
  background: "rgba(255,255,255,0.98)", backdropFilter: "blur(12px)",
  borderRadius: 14, overflow: "hidden",
  boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
  border: "0.5px solid rgba(0,0,0,0.08)", zIndex: 600,
};

const dropdownItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10,
  padding: "10px 14px", cursor: "pointer",
  borderBottom: "0.5px solid var(--divider)",
  transition: "background 0.1s",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%", padding: "13px", background: "#FC4C02", color: "white",
  border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
};
