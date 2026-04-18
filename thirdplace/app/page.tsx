"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  geocode, runAgentLoop, fetchNearbyTransitStops, fetchDisabledParking,
  type GeoResult, type RouteResult, type NavStep,
  type TransitStop, type DisabledParking, type TransportMode,
} from "../lib/routing";
import type { Profile } from "../lib/routing";
import {
  login, logout, register, getCurrentUser, savePreferences,
  type User, type UserPreferences, DEFAULT_PREFS,
} from "../lib/auth";
import { VoiceAssistant, type VoiceLang } from "../lib/voice";

const MapView = dynamic(() => import("../components/MapView"), { ssr: false });

const PROFILES: Profile[]         = ["Wheelchair", "Cane", "Walker", "Low crowd"];
const TRANSPORT_MODES: { id: TransportMode; icon: string; en: string; fr: string }[] = [
  { id: "walking", icon: "🚶", en: "Walking",  fr: "À pied"    },
  { id: "transit", icon: "🚌", en: "Transit",  fr: "Transport" },
  { id: "car",     icon: "🚗", en: "Car",      fr: "Voiture"   },
];
const PROFILE_ICONS: Record<Profile, string> = {
  Wheelchair: "♿", Cane: "🦯", Walker: "🚶", "Low crowd": "👥",
};
const DEFAULT_CENTER = { lat: 45.5017, lng: -73.5673 }; // Montreal

// ── i18n helper ────────────────────────────────────────────────────────────────
type Lang = "en" | "fr";
const T: Record<string, Record<Lang, string>> = {
  searchFrom:     { en: "From — your location or any address", fr: "Depuis — votre position ou une adresse" },
  searchTo:       { en: "To — search any address or tap the map", fr: "Vers — chercher une adresse ou taper la carte" },
  findRoute:      { en: "Find accessible route →", fr: "Trouver un itinéraire →" },
  startNav:       { en: "Start navigation →", fr: "Démarrer →" },
  routes:         { en: "Accessible routes", fr: "Itinéraires accessibles" },
  navigating:     { en: "Navigating", fr: "Navigation" },
  back:           { en: "← Back", fr: "← Retour" },
  arrived:        { en: "You have arrived ✓", fr: "Vous êtes arrivé ✓" },
  nextStep:       { en: "Next step →", fr: "Étape suivante →" },
  prevStep:       { en: "← Prev", fr: "← Préc" },
  login:          { en: "Log in", fr: "Connexion" },
  register:       { en: "Register", fr: "S'inscrire" },
  logout:         { en: "Log out", fr: "Déconnexion" },
  username:       { en: "Username", fr: "Nom d'utilisateur" },
  password:       { en: "Password", fr: "Mot de passe" },
  tapMap:         { en: "Search an address or tap the map to set a destination", fr: "Cherchez une adresse ou appuyez sur la carte" },
  sortedBy:       { en: "Sorted by accessibility score", fr: "Triés par score d'accessibilité" },
  transitStops:   { en: "Accessible transit stops nearby", fr: "Arrêts accessibles à proximité" },
  parkingSpots:   { en: "Disabled parking nearby", fr: "Stationnement handicapé à proximité" },
  voiceOn:        { en: "Voice on", fr: "Voix activée" },
  voiceOff:       { en: "Voice off", fr: "Voix désactivée" },
  listening:      { en: "Listening…", fr: "J'écoute…" },
  thinking:       { en: "Thinking…", fr: "Réflexion…" },
  speaking:       { en: "Speaking…", fr: "Parle…" },
  step:           { en: "Step", fr: "Étape" },
  of:             { en: "of", fr: "sur" },
  min:            { en: "min", fr: "min" },
  accessibility:  { en: "accessibility", fr: "accessibilité" },
  best:           { en: "Best", fr: "Meilleur" },
  findingRoutes:  { en: "Finding the most accessible routes…", fr: "Recherche des itinéraires accessibles…" },
  geminiKey:      { en: "Gemini API key (for voice)", fr: "Clé API Gemini (pour la voix)" },
};
const t = (key: string, lang: Lang) => T[key]?.[lang] ?? key;

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser]           = useState<User | null>(null);
  const [authPanel, setAuthPanel] = useState<"login" | "register" | null>(null);
  const [authUser, setAuthUser]   = useState("");
  const [authPass, setAuthPass]   = useState("");
  const [authError, setAuthError] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // ── Preferences (from user or defaults) ───────────────────────────────────
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);

  const lang          = prefs.language as Lang;
  const profile       = prefs.profile;
  const transportMode = prefs.transportMode;

  // ── Map / routing state ───────────────────────────────────────────────────
  const [query, setQuery]               = useState("");
  const [originQuery, setOriginQuery]   = useState("");
  const [suggestions, setSuggestions]   = useState<GeoResult[]>([]);
  const [originSugg, setOriginSugg]     = useState<GeoResult[]>([]);
  const [activeSearch, setActiveSearch] = useState<"origin" | "dest" | null>(null);
  const [origin, setOrigin]             = useState<LatLng | null>(null);
  const [originName, setOriginName]     = useState("");
  const [destination, setDestination]   = useState<LatLng | null>(null);
  const [destName, setDestName]         = useState("");
  const [mapCenter, setMapCenter]       = useState(DEFAULT_CENTER);
  const [routes, setRoutes]             = useState<RouteResult[]>([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [loading, setLoading]           = useState(false);
  const [agentLog, setAgentLog]         = useState<{ type: string; message: string }[]>([]);
  const [showLog, setShowLog]           = useState(false);
  const [panel, setPanel]               = useState<"search" | "routes" | "nav">("search");
  const [navStep, setNavStep]           = useState(0);
  const [transitStops, setTransitStops] = useState<TransitStop[]>([]);
  const [parking, setParking]           = useState<DisabledParking[]>([]);

  // ── Voice state ───────────────────────────────────────────────────────────
  const [voiceActive, setVoiceActive]   = useState(false);
  const [voiceStatus, setVoiceStatus]   = useState<"idle"|"listening"|"thinking"|"speaking">("idle");
  const [transcript, setTranscript]     = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [geminiKey, setGeminiKey]       = useState("");
  const voiceRef = useRef<VoiceAssistant | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef      = useRef<HTMLDivElement>(null);

  // ── Load user on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const u = getCurrentUser();
    if (u) { setUser(u); setPrefs(u.preferences); }
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [agentLog]);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLogin = () => {
    const res = login(authUser, authPass);
    if (!res.ok) { setAuthError(res.error ?? "Error"); return; }
    const u = getCurrentUser()!;
    setUser(u); setPrefs(u.preferences); setAuthPanel(null); setAuthError("");
  };

  const handleRegister = () => {
    const res = register(authUser, authPass);
    if (!res.ok) { setAuthError(res.error ?? "Error"); return; }
    handleLogin();
  };

  const handleLogout = () => { logout(); setUser(null); setPrefs(DEFAULT_PREFS); };

  const updatePref = <K extends keyof UserPreferences>(key: K, val: UserPreferences[K]) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    if (user) savePreferences(next);
  };

  // ── Geocoding ─────────────────────────────────────────────────────────────
  const handleSearch = useCallback((val: string, type: "origin" | "dest") => {
    if (type === "dest") setQuery(val); else setOriginQuery(val);
    setActiveSearch(type);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await geocode(val);
      if (type === "dest") setSuggestions(results); else setOriginSugg(results);
    }, 380);
  }, []);

  const pickOrigin = (loc: GeoResult) => {
    setOrigin({ lat: loc.lat, lng: loc.lng }); setOriginName(loc.name);
    setOriginQuery(loc.name); setOriginSugg([]); setActiveSearch(null);
    setMapCenter({ lat: loc.lat, lng: loc.lng });
  };

  const pickDest = (loc: GeoResult) => {
    setDestination({ lat: loc.lat, lng: loc.lng }); setDestName(loc.name);
    setQuery(loc.name); setSuggestions([]); setActiveSearch(null);
    setMapCenter({ lat: loc.lat, lng: loc.lng });
  };

  const handleMapClick = useCallback((latlng: LatLng) => {
    setDestination(latlng);
    const label = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    setDestName(label); setQuery(label); setSuggestions([]);
  }, []);

  // ── Find routes ───────────────────────────────────────────────────────────
  const findRoutes = async () => {
    if (!destination) return;
    const from = origin ?? DEFAULT_CENTER;
    setLoading(true); setRoutes([]); setAgentLog([]);
    setShowLog(true); setPanel("search");
    setTransitStops([]); setParking([]);

    await runAgentLoop(
      from, destination, profile, lang, transportMode,
      (e) => setAgentLog((p) => [...p, e]),
      (r) => { setRoutes(r); setSelectedRoute(0); setPanel("routes"); setShowLog(false); },
      (s) => setTransitStops(s),
      (p) => setParking(p),
    );
    setLoading(false);
  };

  // ── Voice ─────────────────────────────────────────────────────────────────
  const toggleVoice = async () => {
    if (voiceActive) {
      voiceRef.current?.disconnect(); voiceRef.current = null; setVoiceActive(false); return;
    }
    const key = geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    const va = new VoiceAssistant(key, lang as VoiceLang, {
      onTranscript: (text, final) => setTranscript(final ? "" : text),
      onAssistantText: (text) => setAssistantText(text),
      onStatusChange: setVoiceStatus,
      onError: (msg) => { alert(msg); setVoiceActive(false); },
      onFunctionCall: async ({ name, args }) => {
        if (name === "reroute") {
          if (destination) await findRoutes();
          return { success: true, message: "Found a new route" };
        }
        if (name === "get_next_step") {
          const step = routes[selectedRoute]?.steps?.[navStep];
          return { instruction: step?.instruction ?? "No more steps" };
        }
        if (name === "get_eta") {
          const r = routes[selectedRoute];
          const remaining = r ? r.timeMin - Math.round(navStep * r.timeMin / Math.max(r.steps.length, 1)) : 0;
          return { etaMinutes: remaining };
        }
        if (name === "find_transit") {
          const stops = destination ? await fetchNearbyTransitStops(destination) : [];
          setTransitStops(stops);
          return { stops: stops.slice(0, 3).map((s) => ({ name: s.name, type: s.type, lines: s.lines })) };
        }
        if (name === "find_parking") {
          const spots = destination ? await fetchDisabledParking(destination) : [];
          setParking(spots);
          return { spots: spots.slice(0, 3).map((p) => ({ name: p.name, spots: p.spots, free: p.free })) };
        }
        if (name === "report_obstacle") {
          return { success: true, message: "Obstacle reported, finding alternative route" };
        }
        return {};
      },
    });
    voiceRef.current = va;
    await va.connect();
    setVoiceActive(true);
  };

  // Announce nav steps via voice
  useEffect(() => {
    if (voiceActive && panel === "nav" && routes[selectedRoute]?.steps?.[navStep]) {
      const step = routes[selectedRoute].steps[navStep];
      voiceRef.current?.sendText(`Next navigation instruction: ${step.instruction}`);
    }
  }, [navStep, panel]); // eslint-disable-line

  // ── Nav helpers ───────────────────────────────────────────────────────────
  const currentRoute = routes[selectedRoute];
  const steps        = currentRoute?.steps ?? [];
  const totalSteps   = steps.length;
  const progressPct  = totalSteps > 0 ? Math.round((navStep / totalSteps) * 100) : 0;

  // ── Render helpers ────────────────────────────────────────────────────────
  const voiceColor: Record<string, string> = {
    idle: "#6E6E68", listening: "#FC4C02", thinking: "#2563EB", speaking: "#059669",
  };

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ height: "100dvh", width: "100vw", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* ── AUTH MODAL ──────────────────────────────────────────────────── */}
      {authPanel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{authPanel === "login" ? t("login", lang) : t("register", lang)}</div>
              <button onClick={() => { setAuthPanel(null); setAuthError(""); }} style={iconBtnStyle}>✕</button>
            </div>
            <input value={authUser} onChange={(e) => setAuthUser(e.target.value)} placeholder={t("username", lang)} style={inputFieldStyle} />
            <input value={authPass} onChange={(e) => setAuthPass(e.target.value)} placeholder={t("password", lang)} type="password" style={{ ...inputFieldStyle, marginTop: 8 }} />
            {authError && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 6 }}>{authError}</div>}
            <button onClick={authPanel === "login" ? handleLogin : handleRegister} style={{ ...primaryBtnStyle, marginTop: 14 }}>
              {authPanel === "login" ? t("login", lang) : t("register", lang)}
            </button>
            <button onClick={() => setAuthPanel(authPanel === "login" ? "register" : "login")}
              style={{ background: "none", border: "none", color: "#FC4C02", fontSize: 13, cursor: "pointer", marginTop: 10, display: "block", fontFamily: "inherit" }}>
              {authPanel === "login" ? t("register", lang) : t("login", lang)}
            </button>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ──────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>⚙️ Settings</div>
              <button onClick={() => setShowSettings(false)} style={iconBtnStyle}>✕</button>
            </div>

            <div style={settingLabel}>Language / Langue</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["en", "fr"] as Lang[]).map((l) => (
                <button key={l} onClick={() => updatePref("language", l)} style={{ ...chipStyle, ...(lang === l ? chipActiveStyle : {}) }}>
                  {l === "en" ? "🇬🇧 English" : "🇫🇷 Français"}
                </button>
              ))}
            </div>

            <div style={settingLabel}>Mobility profile</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {PROFILES.map((p) => (
                <button key={p} onClick={() => updatePref("profile", p)} style={{ ...chipStyle, ...(profile === p ? chipActiveStyle : {}) }}>
                  {PROFILE_ICONS[p]} {p}
                </button>
              ))}
            </div>

            <div style={settingLabel}>Gemini API key (voice assistant)</div>
            <input value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." style={{ ...inputFieldStyle, marginBottom: 14, fontFamily: "monospace", fontSize: 12 }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #E7E3DD" }}>
              <span style={{ fontSize: 14 }}>High contrast</span>
              <div onClick={() => updatePref("highContrast", !prefs.highContrast)} style={{ ...toggleStyle, background: prefs.highContrast ? "#FC4C02" : "#E7E3DD" }}>
                <div style={{ ...toggleThumb, left: prefs.highContrast ? 18 : 2 }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #E7E3DD" }}>
              <span style={{ fontSize: 14 }}>Large text</span>
              <div onClick={() => updatePref("largeText", !prefs.largeText)} style={{ ...toggleStyle, background: prefs.largeText ? "#FC4C02" : "#E7E3DD" }}>
                <div style={{ ...toggleThumb, left: prefs.largeText ? 18 : 2 }} />
              </div>
            </div>

            {user && (
              <button onClick={() => { handleLogout(); setShowSettings(false); }} style={{ ...primaryBtnStyle, marginTop: 16, background: "#EF4444" }}>
                {t("logout", lang)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── FULL-SCREEN MAP ──────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <MapView
          center={mapCenter} origin={origin} destination={destination}
          routes={routes} selectedRouteIndex={selectedRoute}
          transitStops={transitStops} disabledParking={parking}
          onMapClick={handleMapClick}
        />
      </div>

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 500, padding: "10px 12px 0", pointerEvents: "none" }}>

        {/* Logo row + auth + settings */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8, pointerEvents: "auto" }}>
          <div style={{ ...glassCard, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.5 }}>way<span style={{ color: "#FC4C02" }}>·</span>go</span>
            {/* Transport mode tabs */}
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {TRANSPORT_MODES.map((m) => (
                <button key={m.id} onClick={() => updatePref("transportMode", m.id)}
                  style={{ flex: 1, padding: "4px 6px", borderRadius: 10, border: `1.5px solid ${transportMode === m.id ? "#FC4C02" : "#E7E3DD"}`, background: transportMode === m.id ? "#FFF1EB" : "transparent", color: transportMode === m.id ? "#FC4C02" : "#6E6E68", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {m.icon} <span style={{ display: "none" }}>{m[lang === "fr" ? "fr" : "en"]}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} style={{ ...glassCard, padding: "8px 12px", border: "none", cursor: "pointer", fontSize: 18, pointerEvents: "auto" }}>⚙️</button>
          {user ? (
            <div style={{ ...glassCard, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#FC4C02", display: "flex", alignItems: "center" }}>{user.username}</div>
          ) : (
            <button onClick={() => setAuthPanel("login")} style={{ ...glassCard, padding: "8px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#FC4C02", pointerEvents: "auto" }}>
              {t("login", lang)}
            </button>
          )}
        </div>

        {/* Origin search */}
        <div style={{ pointerEvents: "auto", position: "relative", marginBottom: 6 }}>
          <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>🔵</span>
            <input style={searchInputStyle} placeholder={t("searchFrom", lang)} value={originQuery}
              onChange={(e) => handleSearch(e.target.value, "origin")} onFocus={() => setActiveSearch("origin")} />
            {originQuery && <button style={clearBtn} onClick={() => { setOriginQuery(""); setOrigin(null); setOriginSugg([]); }}>✕</button>}
          </div>
          {activeSearch === "origin" && originSugg.length > 0 && (
            <div style={dropdownStyle}>
              {originSugg.map((loc, i) => (
                <div key={i} style={dropdownItem} onClick={() => pickOrigin(loc)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF1EB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
                  <div><div style={{ fontWeight: 500, fontSize: 13 }}>{loc.name}</div><div style={{ fontSize: 11, color: "#6E6E68" }}>{loc.fullName.split(",").slice(2, 4).join(",")}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Destination search */}
        <div style={{ pointerEvents: "auto", position: "relative", marginBottom: 8 }}>
          <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
            <input style={searchInputStyle} placeholder={t("searchTo", lang)} value={query}
              onChange={(e) => handleSearch(e.target.value, "dest")} onFocus={() => setActiveSearch("dest")} />
            {query && <button style={clearBtn} onClick={() => { setQuery(""); setDestination(null); setSuggestions([]); setRoutes([]); setPanel("search"); }}>✕</button>}
          </div>
          {activeSearch === "dest" && suggestions.length > 0 && (
            <div style={dropdownStyle}>
              {suggestions.map((loc, i) => (
                <div key={i} style={dropdownItem} onClick={() => pickDest(loc)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF1EB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
                  <div><div style={{ fontWeight: 500, fontSize: 13 }}>{loc.name}</div><div style={{ fontSize: 11, color: "#6E6E68" }}>{loc.fullName.split(",").slice(2, 4).join(",")}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", pointerEvents: "auto" }}>
          {PROFILES.map((p) => (
            <button key={p} onClick={() => updatePref("profile", p)}
              style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${profile === p ? "#FC4C02" : "#E7E3DD"}`, background: profile === p ? "rgba(255,241,235,0.97)" : "rgba(255,255,255,0.92)", color: profile === p ? "#FC4C02" : "#6E6E68", fontSize: 12, fontWeight: 500, cursor: "pointer", backdropFilter: "blur(8px)", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {PROFILE_ICONS[p]} {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAP HINT ─────────────────────────────────────────────────────── */}
      {!destination && !loading && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "12px 18px", fontSize: 13, color: "#6E6E68", zIndex: 100, border: "0.5px solid #E7E3DD", pointerEvents: "none", textAlign: "center", maxWidth: 260 }}>
          {t("tapMap", lang)}
        </div>
      )}

      {/* ── VOICE BUBBLE ─────────────────────────────────────────────────── */}
      {voiceActive && (
        <div style={{ position: "absolute", top: "48%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", borderRadius: 20, padding: "16px 20px", maxWidth: 300, textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>{voiceStatus === "listening" ? "🎙️" : voiceStatus === "thinking" ? "🤔" : voiceStatus === "speaking" ? "🔊" : "🎙️"}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: voiceColor[voiceStatus] }}>{t(voiceStatus, lang)}</div>
          {transcript && <div style={{ fontSize: 12, color: "#6E6E68", marginTop: 4, fontStyle: "italic" }}>"{transcript}"</div>}
          {assistantText && <div style={{ fontSize: 13, color: "#1F1F1C", marginTop: 6 }}>{assistantText}</div>}
        </div>
      )}

      {/* ── BOTTOM PANEL ─────────────────────────────────────────────────── */}
      {/* This is a FIXED bottom panel — it does not scroll with the page */}
      <div style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 500,
        background: "white",
        borderRadius: "22px 22px 0 0",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.12)",
        border: "0.5px solid #E7E3DD",
        maxHeight: "52vh",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Handle + voice button — always visible, never scrolls */}
        <div style={{ padding: "12px 18px 0", flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, background: "#E7E3DD", borderRadius: 2, margin: "0 auto 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1F1F1C" }}>
              {panel === "search" ? "way·go" : panel === "routes" ? t("routes", lang) : t("navigating", lang)}
            </div>
            <button
              onClick={toggleVoice}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${voiceActive ? "#FC4C02" : "#E7E3DD"}`, background: voiceActive ? "#FFF1EB" : "transparent", color: voiceActive ? "#FC4C02" : "#6E6E68", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              🎙️ {voiceActive ? t("voiceOn", lang) : t("voiceOff", lang)}
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div style={{ overflowY: "auto", padding: "10px 18px 24px", flex: 1, WebkitOverflowScrolling: "touch" }}>

          {/* Agent log */}
          {showLog && agentLog.length > 0 && (
            <div ref={logRef} style={{ background: "#1F1F1C", borderRadius: 12, padding: "10px 14px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.8, maxHeight: 120, overflowY: "auto", marginBottom: 10 }}>
              {agentLog.map((e, i) => (
                <div key={i} style={{ color: e.type === "agent" ? "#FC4C02" : e.type === "tool" ? "#60a5fa" : e.type === "result" ? "#34d399" : "#9CA3AF", fontStyle: e.type === "think" ? "italic" : "normal" }}>{e.message}</div>
              ))}
              {loading && <span style={{ color: "#FC4C02" }}>▊</span>}
            </div>
          )}

          {/* ── SEARCH PANEL ── */}
          {panel === "search" && !loading && (
            destination ? (
              <>
                <div style={{ fontSize: 13, color: "#6E6E68", marginBottom: 10 }}>
                  {lang === "fr" ? "Destination :" : "Destination:"} <strong style={{ color: "#1F1F1C" }}>{destName}</strong>
                </div>
                <button onClick={findRoutes} style={primaryBtnStyle}>{t("findRoute", lang)}</button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#6E6E68", textAlign: "center", padding: "8px 0" }}>{t("tapMap", lang)}</div>
            )
          )}

          {loading && <div style={{ fontSize: 13, color: "#6E6E68", textAlign: "center", padding: "8px 0" }}>{t("findingRoutes", lang)}</div>}

          {/* ── ROUTES PANEL ── */}
          {panel === "routes" && routes.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: "#6E6E68" }}>{t("sortedBy", lang)}</div>
                <button onClick={() => { setPanel("search"); setRoutes([]); }} style={textBtnStyle}>{t("back", lang)}</button>
              </div>

              {routes.map((r, i) => (
                <div key={i} onClick={() => setSelectedRoute(i)} style={{ background: i === selectedRoute ? "#FFF1EB" : "#F7F6F3", border: `1.5px solid ${i === selectedRoute ? "#FC4C02" : "#E7E3DD"}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                      {i === 0 && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "#FC4C02", color: "white", fontWeight: 600 }}>{t("best", lang)}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: "#6E6E68" }}>{r.timeMin} {t("min", lang)} · {r.distanceM >= 1000 ? (r.distanceM / 1000).toFixed(1) + " km" : r.distanceM + " m"}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#FC4C02", marginBottom: 4 }}>{r.score}<span style={{ fontSize: 12, color: "#6E6E68", fontWeight: 400 }}>/100 {t("accessibility", lang)}</span></div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {r.tags.map((tg) => <span key={tg} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "#D1FAE5", color: "#065F46", fontWeight: 500 }}>{tg}</span>)}
                    {r.penalties.map((p) => <span key={p} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "#FEF3C7", color: "#92400E", fontWeight: 500 }}>{p}</span>)}
                  </div>
                </div>
              ))}

              {/* Transit stops */}
              {transitStops.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", marginBottom: 6 }}>🚌 {t("transitStops", lang)}</div>
                  {transitStops.slice(0, 4).map((s, i) => (
                    <div key={i} style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "8px 12px", marginBottom: 5, fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span> · {s.type} {s.accessible ? "♿" : ""} {s.lines.length ? `(${s.lines.join(", ")})` : ""}
                    </div>
                  ))}
                </div>
              )}

              {/* Disabled parking */}
              {parking.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1E40AF", marginBottom: 6 }}>P♿ {t("parkingSpots", lang)}</div>
                  {parking.slice(0, 3).map((p, i) => (
                    <div key={i} style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "8px 12px", marginBottom: 5, fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span> · {p.spots} spot{p.spots !== 1 ? "s" : ""} {p.free ? "· Free" : ""}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => { setPanel("nav"); setNavStep(0); }} style={primaryBtnStyle}>{t("startNav", lang)}</button>
            </>
          )}

          {/* ── NAV PANEL ── */}
          {panel === "nav" && currentRoute && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#6E6E68" }}>{t("step", lang)} {navStep + 1} {t("of", lang)} {totalSteps}</div>
                <button onClick={() => setPanel("routes")} style={textBtnStyle}>{t("back", lang)}</button>
              </div>

              {/* Current instruction */}
              {steps[navStep] && (
                <div style={{ background: "#F7F6F3", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1F1F1C", lineHeight: 1.4 }}>
                    {steps[navStep].instruction}
                  </div>
                  <div style={{ fontSize: 13, color: "#FC4C02", fontWeight: 700, marginTop: 6 }}>
                    {steps[navStep].distanceM < 1000 ? steps[navStep].distanceM + " m" : (steps[navStep].distanceM / 1000).toFixed(1) + " km"}
                  </div>
                </div>
              )}

              {/* Progress bar */}
              <div style={{ height: 4, background: "#E7E3DD", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", width: progressPct + "%", background: "#FC4C02", borderRadius: 2, transition: "width 0.4s" }} />
              </div>

              {/* ETA */}
              <div style={{ fontSize: 13, color: "#6E6E68", marginBottom: 10, textAlign: "center" }}>
                {currentRoute.timeMin - Math.round(navStep * currentRoute.timeMin / Math.max(totalSteps, 1))} {t("min", lang)} {lang === "fr" ? "restantes" : "remaining"} · {currentRoute.distanceM >= 1000 ? (currentRoute.distanceM / 1000).toFixed(1) + " km" : currentRoute.distanceM + " m"} {lang === "fr" ? "au total" : "total"}
              </div>

              {/* Bonuses */}
              {currentRoute.bonuses.map((b) => (
                <div key={b} style={{ background: "#D1FAE5", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#065F46", marginBottom: 5, fontWeight: 500 }}>✓ {b}</div>
              ))}

              {/* Preview next step */}
              {steps[navStep + 1] && (
                <div style={{ background: "#F7F6F3", borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#6E6E68", borderLeft: "3px solid #E7E3DD" }}>
                  {lang === "fr" ? "Ensuite :" : "Then:"} {steps[navStep + 1].instruction}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setNavStep((s) => Math.max(0, s - 1))} disabled={navStep === 0}
                  style={{ ...primaryBtnStyle, flex: 1, background: "#F7F6F3", color: "#1F1F1C", border: "1px solid #E7E3DD" }}>
                  {t("prevStep", lang)}
                </button>
                <button onClick={() => setNavStep((s) => Math.min(totalSteps, s + 1))} disabled={navStep >= totalSteps}
                  style={{ ...primaryBtnStyle, flex: 2 }}>
                  {navStep >= totalSteps ? t("arrived", lang) : t("nextStep", lang)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type LatLng = { lat: number; lng: number };

// ── Style objects ──────────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
  borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  border: "0.5px solid rgba(0,0,0,0.07)",
};
const searchInputStyle: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none", outline: "none",
  fontSize: 14, color: "#1F1F1C", fontFamily: "inherit",
};
const clearBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "#6E6E68", fontSize: 14, padding: 0, fontFamily: "inherit",
};
const dropdownStyle: React.CSSProperties = {
  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
  background: "rgba(255,255,255,0.98)", backdropFilter: "blur(12px)",
  borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
  border: "0.5px solid rgba(0,0,0,0.07)", zIndex: 600,
};
const dropdownItem: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
  cursor: "pointer", borderBottom: "0.5px solid #E7E3DD", transition: "background 0.1s",
};
const primaryBtnStyle: React.CSSProperties = {
  width: "100%", padding: "13px", background: "#FC4C02", color: "white",
  border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
};
const textBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#FC4C02", fontSize: 12,
  fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const inputFieldStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 12,
  border: "1.5px solid #E7E3DD", fontSize: 14, fontFamily: "inherit",
  background: "#F7F6F3", color: "#1F1F1C", outline: "none",
};
const iconBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 16, color: "#6E6E68", fontFamily: "inherit",
};
const chipStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 20, border: "1.5px solid #E7E3DD",
  background: "#F7F6F3", color: "#6E6E68", fontSize: 12, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
};
const chipActiveStyle: React.CSSProperties = {
  background: "#FFF1EB", borderColor: "#FC4C02", color: "#FC4C02",
};
const toggleStyle: React.CSSProperties = {
  width: 36, height: 20, borderRadius: 10, position: "relative", cursor: "pointer", transition: "background 0.2s",
};
const toggleThumb: React.CSSProperties = {
  position: "absolute", width: 16, height: 16, background: "white",
  borderRadius: "50%", top: 2, transition: "left 0.2s",
};
const settingLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#6E6E68", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
};
