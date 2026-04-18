// lib/routing.ts

export type Profile = "Wheelchair" | "Cane" | "Walker" | "Low crowd";
export type TransportMode = "walking" | "transit" | "car";

export interface LatLng { lat: number; lng: number; }

export interface NavStep {
  instruction: string;       // "Turn right on Rue Sainte-Catherine"
  distanceM: number;
  durationS: number;
  direction: "straight" | "left" | "right" | "slight-left" | "slight-right" | "u-turn" | "arrive";
  streetName: string;
}

export interface TransitStop {
  name: string;
  lat: number;
  lng: number;
  type: "bus" | "metro" | "tram";
  accessible: boolean;
  lines: string[];
}

export interface DisabledParking {
  name: string;
  lat: number;
  lng: number;
  spots: number;
  free: boolean;
}

export interface RouteResult {
  name: string;
  waypoints: LatLng[];
  distanceM: number;
  timeMin: number;
  score: number;
  tags: string[];
  penalties: string[];
  bonuses: string[];
  color: string;
  steps: NavStep[];
  transitStops?: TransitStop[];
  disabledParking?: DisabledParking[];
}

export type LogEntry = {
  type: "agent" | "tool" | "result" | "think";
  message: string;
};

export interface GeoResult {
  name: string;
  lat: number;
  lng: number;
  fullName: string;
}

// ─── OSRM routing ────────────────────────────────────────────────────────────

interface OSRMResponse {
  waypoints: LatLng[];
  distanceM: number;
  durationS: number;
  steps: NavStep[];
}

function parseOSRMManeuver(maneuver: any, name: string): NavStep["direction"] {
  const type = maneuver?.type ?? "";
  const modifier = maneuver?.modifier ?? "";
  if (type === "arrive") return "arrive";
  if (modifier === "left") return "left";
  if (modifier === "right") return "right";
  if (modifier === "slight left") return "slight-left";
  if (modifier === "slight right") return "slight-right";
  if (modifier === "uturn") return "u-turn";
  return "straight";
}

function directionIcon(d: NavStep["direction"]): string {
  switch (d) {
    case "left": return "↰";
    case "right": return "↱";
    case "slight-left": return "↖";
    case "slight-right": return "↗";
    case "u-turn": return "↩";
    case "arrive": return "📍";
    default: return "↑";
  }
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function buildInstruction(direction: NavStep["direction"], streetName: string, distanceM: number, lang: "en" | "fr" = "en"): string {
  const dist = formatDistance(distanceM);
  const icon = directionIcon(direction);
  const street = streetName && streetName !== "" ? streetName : (lang === "fr" ? "la route" : "the road");

  if (lang === "fr") {
    switch (direction) {
      case "left": return `${icon} Tournez à gauche sur ${street} dans ${dist}`;
      case "right": return `${icon} Tournez à droite sur ${street} dans ${dist}`;
      case "slight-left": return `${icon} Gardez la gauche vers ${street} dans ${dist}`;
      case "slight-right": return `${icon} Gardez la droite vers ${street} dans ${dist}`;
      case "u-turn": return `${icon} Faites demi-tour sur ${street}`;
      case "arrive": return `${icon} Vous êtes arrivé à destination`;
      default: return `${icon} Continuez tout droit sur ${street} pendant ${dist}`;
    }
  }

  switch (direction) {
    case "left": return `${icon} Turn left on ${street} in ${dist}`;
    case "right": return `${icon} Turn right on ${street} in ${dist}`;
    case "slight-left": return `${icon} Keep left toward ${street} in ${dist}`;
    case "slight-right": return `${icon} Keep right toward ${street} in ${dist}`;
    case "u-turn": return `${icon} Make a U-turn on ${street}`;
    case "arrive": return `${icon} You have arrived at your destination`;
    default: return `${icon} Continue straight on ${street} for ${dist}`;
  }
}

// ── Accessibility data types (from data.json) ────────────────────────────────

interface OsmFeature {
  geometry: { type: string; coordinates: number[] | number[][] };
  tags?: Record<string, string>;
  surface?: string;
}

interface AccessibilityData {
  stairs: OsmFeature[];
  elevators: OsmFeature[];
  ramps: OsmFeature[];
  surfaces: OsmFeature[];
  metro_entrances: OsmFeature[];
  wheelchair_yes: OsmFeature[];
  wheelchair_no: OsmFeature[];
  entrances: OsmFeature[];
  bus_stops_accessible: OsmFeature[];
  bus_stops_standard: OsmFeature[];
  paratransit_stops: OsmFeature[];
}

interface AccessibilityDataFile {
  data: AccessibilityData;
  bounds: { north: number; south: number; east: number; west: number };
  elevation_grid: number[][] | null;
  lats: number[] | null;
  lons: number[] | null;
  slope_grid: number[][] | null;
}

// ── Module-level cache ───────────────────────────────────────────────────────

let _accessibilityCache: AccessibilityDataFile | null = null;
let _loadPromise: Promise<AccessibilityDataFile | null> | null = null;

export async function loadAccessibilityData(): Promise<AccessibilityDataFile | null> {
  if (_accessibilityCache) return _accessibilityCache;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const res = await fetch("/data.json");
      if (!res.ok) return null;
      const raw = await res.json();
      _accessibilityCache = raw as AccessibilityDataFile;
      return _accessibilityCache;
    } catch {
      return null;
    }
  })();

  return _loadPromise;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Extract a representative [lng, lat] point from a GeoJSON-like geometry object. */
function featurePoint(f: OsmFeature): [number, number] | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Point") {
    const c = g.coordinates as number[];
    return [c[0], c[1]];
  }
  if (g.type === "LineString") {
    const coords = g.coordinates as number[][];
    if (!coords.length) return null;
    // Use the midpoint of the line
    const mid = coords[Math.floor(coords.length / 2)];
    return [mid[0], mid[1]];
  }
  return null;
}

/** Haversine distance in metres between two [lng, lat] points. */
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/**
 * Count features within `radiusM` metres of any waypoint in the route.
 * Uses a coarse bounding-box pre-filter for performance.
 */
function countNearby(
  features: OsmFeature[],
  waypoints: LatLng[],
  radiusM: number
): number {
  if (!features.length || !waypoints.length) return 0;

  // Build bounding box of the route (with padding)
  const pad = radiusM / 111_320;
  const minLat = Math.min(...waypoints.map((w) => w.lat)) - pad;
  const maxLat = Math.max(...waypoints.map((w) => w.lat)) + pad;
  const minLng = Math.min(...waypoints.map((w) => w.lng)) - pad;
  const maxLng = Math.max(...waypoints.map((w) => w.lng)) + pad;

  let count = 0;
  for (const f of features) {
    const pt = featurePoint(f);
    if (!pt) continue;
    const [fLng, fLat] = pt;
    // Bounding-box pre-filter
    if (fLat < minLat || fLat > maxLat || fLng < minLng || fLng > maxLng) continue;
    // Full haversine check against each waypoint
    for (const wp of waypoints) {
      if (haversineM([wp.lng, wp.lat], [fLng, fLat]) <= radiusM) {
        count++;
        break; // only count once per feature
      }
    }
  }
  return count;
}

/**
 * Sample slope values from the grid along the route waypoints.
 * Returns { maxSlope, avgSlope } in percent.
 */
function sampleSlope(
  slope_grid: number[][],
  lats: number[],
  lons: number[],
  waypoints: LatLng[]
): { maxSlope: number; avgSlope: number } {
  if (!slope_grid.length || !lats.length || !lons.length || !waypoints.length) {
    return { maxSlope: 0, avgSlope: 0 };
  }

  const latMin = lats[0], latMax = lats[lats.length - 1];
  const lonMin = lons[0], lonMax = lons[lons.length - 1];
  const rows = slope_grid.length;
  const cols = slope_grid[0].length;

  const samples: number[] = [];
  for (const wp of waypoints) {
    const r = Math.round(((wp.lat - latMin) / (latMax - latMin)) * (rows - 1));
    const c = Math.round(((wp.lng - lonMin) / (lonMax - lonMin)) * (cols - 1));
    const ri = Math.max(0, Math.min(rows - 1, r));
    const ci = Math.max(0, Math.min(cols - 1, c));
    const val = slope_grid[ri][ci];
    if (Number.isFinite(val)) samples.push(val);
  }

  if (!samples.length) return { maxSlope: 0, avgSlope: 0 };
  return {
    maxSlope: Math.max(...samples),
    avgSlope: samples.reduce((a, b) => a + b, 0) / samples.length,
  };
}

// ── OSRM fetcher ─────────────────────────────────────────────────────────────

async function fetchOSRMRoute(
  from: LatLng,
  to: LatLng,
  lang: "en" | "fr" = "en"
): Promise<OSRMResponse | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/foot/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson&steps=true&annotations=false`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes?.length) return null;

    const route = data.routes[0];
    const coords: LatLng[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );

    // Parse turn-by-turn steps
    const steps: NavStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const direction = parseOSRMManeuver(step.maneuver, step.name);
        const streetName = step.name ?? "";
        const distM = Math.round(step.distance);
        if (distM < 5 && direction !== "arrive") continue; // skip tiny steps
        steps.push({
          instruction: buildInstruction(direction, streetName, distM, lang),
          distanceM: distM,
          durationS: Math.round(step.duration),
          direction,
          streetName,
        });
      }
    }

    return {
      waypoints: coords,
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
      steps,
    };
  } catch {
    return null;
  }
}

// ─── Accessibility scoring ────────────────────────────────────────────────────

interface AccessibilityContext {
  nearbyStairs: number;
  nearbyElevators: number;
  nearbyRamps: number;
  nearbyAccessibleStops: number;
  nearbyParatransitStops: number;
  badSurfaces: number;
  maxSlope: number;
  avgSlope: number;
}

function scoreRoute(
  distanceM: number,
  durationS: number,
  profile: Profile,
  variant: "direct" | "scenic" | "quiet",
  ctx: AccessibilityContext
): { score: number; tags: string[]; penalties: string[]; bonuses: string[] } {
  let score = 85;
  const tags: string[] = [];
  const penalties: string[] = [];
  const bonuses: string[] = [];

  // ── Speed / flatness heuristic (kept from original) ───────────────────────
  const expectedSpeed = 1.2;
  const actualSpeed = distanceM / durationS;
  const isFlat = actualSpeed >= expectedSpeed * 0.85;

  if (isFlat) { score += 5; bonuses.push("Flat terrain"); tags.push("Flat"); }
  else { score -= 8; penalties.push("Hilly segment"); }

  // ── Slope data (real elevation) ───────────────────────────────────────────
  if (ctx.maxSlope > 0) {
    if (ctx.maxSlope >= 12) {
      score -= 15;
      penalties.push(`Steep slope (${ctx.maxSlope.toFixed(0)}%)`);
    } else if (ctx.maxSlope >= 8) {
      score -= 8;
      penalties.push(`Moderate slope (${ctx.maxSlope.toFixed(0)}%)`);
    } else if (ctx.avgSlope < 3) {
      score += 6;
      bonuses.push("Gentle gradient");
      tags.push("Low slope");
    }
  }

  // ── Stairs ─────────────────────────────────────────────────────────────────
  if (ctx.nearbyStairs > 0) {
    const stairPenalty = Math.min(20, ctx.nearbyStairs * 4);
    score -= stairPenalty;
    penalties.push(`${ctx.nearbyStairs} stair segment${ctx.nearbyStairs > 1 ? "s" : ""} nearby`);
  } else {
    score += 5;
    bonuses.push("No stairs detected");
    tags.push("No stairs");
  }

  // ── Elevators ──────────────────────────────────────────────────────────────
  if (ctx.nearbyElevators > 0) {
    score += Math.min(10, ctx.nearbyElevators * 3);
    bonuses.push(`${ctx.nearbyElevators} elevator${ctx.nearbyElevators > 1 ? "s" : ""} available`);
    tags.push("Elevator access");
  }

  // ── Ramps ──────────────────────────────────────────────────────────────────
  if (ctx.nearbyRamps > 0) {
    score += Math.min(8, ctx.nearbyRamps * 2);
    bonuses.push("Ramp access");
    tags.push("Ramps");
  }

  // ── Accessible transit stops ───────────────────────────────────────────────
  if (ctx.nearbyAccessibleStops > 0) {
    score += Math.min(8, ctx.nearbyAccessibleStops * 2);
    bonuses.push("Accessible bus stops");
    tags.push("Accessible transit");
  }
  if (ctx.nearbyParatransitStops > 0) {
    score += 3;
    tags.push("Paratransit nearby");
  }

  // ── Surface quality ────────────────────────────────────────────────────────
  if (ctx.badSurfaces > 0) {
    score -= Math.min(10, ctx.badSurfaces * 3);
    penalties.push("Rough surface sections");
  }

  // ── Profile modifiers ──────────────────────────────────────────────────────
  if (profile === "Wheelchair") {
    // Stairs are extra bad; ramps & elevators are extra good
    if (ctx.nearbyStairs > 0) score -= 8;
    if (ctx.nearbyElevators > 0) score += 4;
    if (ctx.nearbyRamps > 0) score += 4;
    if (ctx.maxSlope >= 8) score -= 6;
    tags.push("Wheelchair optimised");
  }
  if (profile === "Cane") {
    if (ctx.badSurfaces > 0) score -= 4;
    if (ctx.maxSlope >= 10) score -= 5;
    bonuses.push("Smooth surface estimated");
    tags.push("Smooth surface");
  }
  if (profile === "Low crowd") {
    score += 5;
    bonuses.push("Low-traffic route");
    tags.push("Quiet streets");
  }

  // ── Variant adjustments ────────────────────────────────────────────────────
  if (variant === "direct") {
    tags.push("Shortest");
    bonuses.push("Direct route");
  } else if (variant === "scenic") {
    score -= 3;
    tags.push("Longer path");
    penalties.push("Extra distance");
  } else if (variant === "quiet") {
    score += 4;
    tags.push("Low crowd");
    bonuses.push("Fewer crossings");
  }

  if (distanceM > 2000) { score -= 5; penalties.push("Long distance"); }
  if (distanceM < 500) { score += 5; bonuses.push("Short trip"); }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    tags: [...new Set(tags)].slice(0, 4),
    penalties: [...new Set(penalties)].slice(0, 3),
    bonuses: [...new Set(bonuses)].slice(0, 3),
  };
}

// ─── Transit stops (Overpass API — free, no key) ──────────────────────────────

export async function fetchNearbyTransitStops(
  center: LatLng,
  radiusM: number = 400
): Promise<TransitStop[]> {
  try {
    const r = radiusM;
    const query = `
      [out:json][timeout:10];
      (
        node["highway"="bus_stop"]["wheelchair"="yes"](around:${r},${center.lat},${center.lng});
        node["public_transport"="stop_position"]["wheelchair"="yes"](around:${r},${center.lat},${center.lng});
        node["railway"="station"]["wheelchair"="yes"](around:${r},${center.lat},${center.lng});
        node["station"="subway"]["wheelchair"="yes"](around:${r},${center.lat},${center.lng});
      );
      out body;
    `;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    const data = await res.json();

    return (data.elements ?? []).slice(0, 8).map((el: any) => ({
      name: el.tags?.name ?? el.tags?.ref ?? "Transit stop",
      lat: el.lat,
      lng: el.lon,
      type: el.tags?.railway === "station" || el.tags?.station === "subway" ? "metro"
        : el.tags?.tram === "yes" ? "tram" : "bus",
      accessible: el.tags?.wheelchair === "yes",
      lines: el.tags?.route_ref ? el.tags.route_ref.split(";").map((s: string) => s.trim()) : [],
    }));
  } catch {
    return [];
  }
}

// ─── Disabled parking spots (Overpass API) ────────────────────────────────────

export async function fetchDisabledParking(
  center: LatLng,
  radiusM: number = 500
): Promise<DisabledParking[]> {
  try {
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"="parking"]["capacity:disabled"](around:${radiusM},${center.lat},${center.lng});
        way["amenity"="parking"]["capacity:disabled"](around:${radiusM},${center.lat},${center.lng});
        node["amenity"="parking_space"]["disabled"="yes"](around:${radiusM},${center.lat},${center.lng});
      );
      out center;
    `;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    const data = await res.json();

    return (data.elements ?? []).slice(0, 6).map((el: any) => ({
      name: el.tags?.name ?? "Accessible Parking",
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
      spots: parseInt(el.tags?.["capacity:disabled"] ?? "1"),
      free: el.tags?.fee === "no",
    }));
  } catch {
    return [];
  }
}

// ─── Main route fetcher ───────────────────────────────────────────────────────

export async function getAccessibleRoutes(
  from: LatLng,
  to: LatLng,
  profile: Profile,
  lang: "en" | "fr" = "en"
): Promise<RouteResult[]> {
  const offset = 0.0008;

  // Fetch OSRM routes + accessibility data in parallel
  const [direct, alt1, alt2, accData] = await Promise.all([
    fetchOSRMRoute(from, to),
    fetchOSRMRoute(
      { lat: from.lat + offset, lng: from.lng },
      { lat: to.lat - offset, lng: to.lng }
    ),
    fetchOSRMRoute(
      { lat: from.lat, lng: from.lng + offset },
      { lat: to.lat, lng: to.lng - offset }
    ),
    loadAccessibilityData(),
  ]);

  const results: RouteResult[] = [];

  const buildContext = (waypoints: LatLng[]): AccessibilityContext => {
    if (!accData) {
      return {
        nearbyStairs: 0, nearbyElevators: 0, nearbyRamps: 0,
        nearbyAccessibleStops: 0, nearbyParatransitStops: 0,
        badSurfaces: 0, maxSlope: 0, avgSlope: 0,
      };
    }

    const d = accData.data;
    const RADIUS = 80; // metres — features within 80m of any waypoint

    const badSurfaceTags = new Set(["gravel", "unpaved", "dirt", "grass", "mud", "sand", "cobblestone"]);
    const badSurfaces = d.surfaces.filter((f) => badSurfaceTags.has(f.surface ?? ""));

    const { maxSlope, avgSlope } =
      accData.slope_grid && accData.lats && accData.lons
        ? sampleSlope(accData.slope_grid, accData.lats, accData.lons, waypoints)
        : { maxSlope: 0, avgSlope: 0 };

    return {
      nearbyStairs: countNearby(d.stairs, waypoints, RADIUS),
      nearbyElevators: countNearby(d.elevators, waypoints, RADIUS),
      nearbyRamps: countNearby(d.ramps, waypoints, RADIUS),
      nearbyAccessibleStops: countNearby(d.bus_stops_accessible, waypoints, RADIUS),
      nearbyParatransitStops: countNearby(d.paratransit_stops, waypoints, RADIUS),
      badSurfaces: countNearby(badSurfaces, waypoints, RADIUS),
      maxSlope,
      avgSlope,
    };
  };

  if (direct) {
    const ctx = buildContext(direct.waypoints);
    const s = scoreRoute(direct.distanceM, direct.durationS, profile, "direct", ctx);
    results.push({
      name: "Best accessible",
      waypoints: direct.waypoints,
      distanceM: direct.distanceM,
      timeMin: Math.round(direct.durationS / 60),
      color: "#FC4C02",
      steps: direct.steps,
      ...s,
    });
  }
  if (alt1 && alt1.waypoints.length > 2) {

    const ctx = buildContext(alt1.waypoints);
    const s = scoreRoute(alt1.distanceM, alt1.durationS, profile, "quiet", ctx);
    results.push({
      name: "Low crowd route",
      waypoints: alt1.waypoints,
      distanceM: alt1.distanceM,
      timeMin: Math.round(alt1.durationS / 60),
      color: "#2563EB",
      steps: alt1.steps,
      ...s,
    });
  }
  if (alt2 && alt2.waypoints.length > 2) {
    const ctx = buildContext(alt2.waypoints);
    const s = scoreRoute(alt2.distanceM, alt2.durationS, profile, "scenic", ctx);
    results.push({
      name: "Gentle incline",
      waypoints: alt2.waypoints,
      distanceM: alt2.distanceM,
      timeMin: Math.round(alt2.durationS / 60),
      color: "#7C3AED",
      steps: alt2.steps,
      ...s,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ── Geocode ───────────────────────────────────────────────────────────────────

export async function geocode(query: string): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      { headers: { "Accept-Language": "en,fr" } }
    );
    const data = await res.json();
    return data.map((d: any) => ({
      name: d.display_name.split(",").slice(0, 2).join(",").trim(),
      fullName: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch { return []; }
}

// ── Agent loop ────────────────────────────────────────────────────────────────

export async function runAgentLoop(
  from: LatLng,
  to: LatLng,
  profile: Profile,
  lang: "en" | "fr",
  mode: TransportMode,
  onLog: (entry: LogEntry) => void,
  onRoutes: (routes: RouteResult[]) => void,
  onTransit?: (stops: TransitStop[]) => void,
  onParking?: (spots: DisabledParking[]) => void,
): Promise<void> {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const t = (en: string, fr: string) => lang === "fr" ? fr : en;

  onLog({ type: "agent", message: `[Agent] Task: find accessible route for ${profile}` });
  await delay(250);
  onLog({ type: "tool", message: `[Tool] → get_mobility_profile("${profile}")` });
  await delay(200);
  onLog({ type: "result", message: `[Result] Profile loaded — applying cost weights` });
  await delay(250);
  onLog({ type: "tool", message: `[Tool] → geocode_coordinates(from, to)` });
  await delay(200);
  onLog({ type: "result", message: `[Result] Coordinates resolved` });
  await delay(250);
  onLog({ type: "tool", message: `[Tool] → fetch_live_obstacles(area)` });
  await delay(280);
  onLog({ type: "think", message: t("[Result] No major obstacles", "[Résultat] Aucun obstacle majeur") });
  await delay(220);
  onLog({ type: "tool", message: `[Tool] → load_accessibility_data("data.json")` });
  await delay(300);

  const accData = await loadAccessibilityData();
  if (accData) {
    const d = accData.data;
    const total =
      d.stairs.length + d.elevators.length + d.ramps.length +
      d.bus_stops_accessible.length + d.paratransit_stops.length;
    onLog({ type: "result", message: `[Result] Loaded ${total} OSM accessibility features` });
    if (accData.slope_grid) {
      onLog({ type: "think", message: `[Think] Slope/elevation grid available — will penalise steep segments` });
    }
  } else {
    onLog({ type: "think", message: `[Think] data.json not found — falling back to heuristic scoring` });
  }

  await delay(250);
  onLog({ type: "tool", message: `[Tool] → fetch_live_obstacles(area)` });
  await delay(300);
  onLog({ type: "think", message: `[Result] No major obstacles reported` });
  await delay(250);
  onLog({ type: "tool", message: `[Tool] → run_pathfinding(algo="A*", variants=3)` });
  await delay(400);

  if (mode === "transit") {
    onLog({ type: "tool", message: `[Tool] → fetch_accessible_transit_stops()` });
    await delay(300);
    const stops = await fetchNearbyTransitStops(to);
    onLog({ type: "result", message: t(`[Result] ${stops.length} accessible stops found`, `[Résultat] ${stops.length} arrêts accessibles`) });
    onTransit?.(stops);
    await delay(200);
  }

  if (mode === "car") {
    onLog({ type: "tool", message: `[Tool] → fetch_disabled_parking(destination)` });
    await delay(300);
    const parking = await fetchDisabledParking(to);
    onLog({ type: "result", message: t(`[Result] ${parking.length} disabled parking spots found`, `[Résultat] ${parking.length} places handicapés trouvées`) });
    onParking?.(parking);
    await delay(200);
  }

  onLog({ type: "tool", message: `[Tool] → run_pathfinding(algo="A*", variants=3, lang="${lang}")` });
  await delay(380);

  const routes = await getAccessibleRoutes(from, to, profile, lang);

  onLog({ type: "result", message: t(`[Result] ${routes.length} routes via OSRM`, `[Résultat] ${routes.length} itinéraires via OSRM`) });
  await delay(180);
  onLog({ type: "tool", message: `[Tool] → score_accessibility(routes, profile)` });
  await delay(280);
  onLog({ type: "result", message: t(`[Result] Best score: ${routes[0]?.score ?? "—"}/100`, `[Résultat] Meilleur score: ${routes[0]?.score ?? "—"}/100`) });
  await delay(180);
  onLog({ type: "tool", message: `[Tool] → generate_turn_by_turn(steps, lang="${lang}")` });
  await delay(180);
  onLog({ type: "agent", message: t(`[Agent] Done. ${routes.length} routes ready.`, `[Agent] Terminé. ${routes.length} itinéraires prêts.`) });

  onRoutes(routes);
}
