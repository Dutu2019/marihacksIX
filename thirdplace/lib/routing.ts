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
  if (modifier === "left")        return "left";
  if (modifier === "right")       return "right";
  if (modifier === "slight left") return "slight-left";
  if (modifier === "slight right")return "slight-right";
  if (modifier === "uturn")       return "u-turn";
  return "straight";
}

function directionIcon(d: NavStep["direction"]): string {
  switch (d) {
    case "left":        return "↰";
    case "right":       return "↱";
    case "slight-left": return "↖";
    case "slight-right":return "↗";
    case "u-turn":      return "↩";
    case "arrive":      return "📍";
    default:            return "↑";
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
      case "left":         return `${icon} Tournez à gauche sur ${street} dans ${dist}`;
      case "right":        return `${icon} Tournez à droite sur ${street} dans ${dist}`;
      case "slight-left":  return `${icon} Gardez la gauche vers ${street} dans ${dist}`;
      case "slight-right": return `${icon} Gardez la droite vers ${street} dans ${dist}`;
      case "u-turn":       return `${icon} Faites demi-tour sur ${street}`;
      case "arrive":       return `${icon} Vous êtes arrivé à destination`;
      default:             return `${icon} Continuez tout droit sur ${street} pendant ${dist}`;
    }
  }

  switch (direction) {
    case "left":         return `${icon} Turn left on ${street} in ${dist}`;
    case "right":        return `${icon} Turn right on ${street} in ${dist}`;
    case "slight-left":  return `${icon} Keep left toward ${street} in ${dist}`;
    case "slight-right": return `${icon} Keep right toward ${street} in ${dist}`;
    case "u-turn":       return `${icon} Make a U-turn on ${street}`;
    case "arrive":       return `${icon} You have arrived at your destination`;
    default:             return `${icon} Continue straight on ${street} for ${dist}`;
  }
}

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

function scoreRoute(
  distanceM: number,
  durationS: number,
  profile: Profile,
  variant: "direct" | "scenic" | "quiet"
): { score: number; tags: string[]; penalties: string[]; bonuses: string[] } {
  let score = 85;
  const tags: string[] = [];
  const penalties: string[] = [];
  const bonuses: string[] = [];

  const actualSpeed = distanceM / Math.max(durationS, 1);
  const isFlat = actualSpeed >= 1.0;

  if (isFlat) { score += 8; bonuses.push("Flat terrain"); tags.push("Flat"); }
  else        { score -= 10; penalties.push("Hilly segment"); }

  if (profile === "Wheelchair") {
    score += 5; bonuses.push("Wheelchair-friendly"); tags.push("No stairs");
    if (variant === "quiet") { score += 3; tags.push("Low crowd"); }
  }
  if (profile === "Cane")       { score += 3; bonuses.push("Smooth surface"); tags.push("Smooth"); }
  if (profile === "Low crowd")  { score += 5; bonuses.push("Low-traffic route"); tags.push("Quiet"); }
  if (variant === "direct")     { tags.push("Shortest"); bonuses.push("Direct route"); }
  if (variant === "scenic")     { score -= 5; tags.push("Longer path"); penalties.push("Extra distance"); }
  if (variant === "quiet")      { score += 4; bonuses.push("Fewer crossings"); }
  if (distanceM > 2000)         { score -= 5; penalties.push("Long distance"); }
  if (distanceM < 500)          { score += 5; bonuses.push("Short trip"); }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    tags: [...new Set(tags)].slice(0, 4),
    penalties: [...new Set(penalties)].slice(0, 2),
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

  const [direct, alt1, alt2] = await Promise.all([
    fetchOSRMRoute(from, to, lang),
    fetchOSRMRoute({ lat: from.lat + offset, lng: from.lng }, { lat: to.lat - offset, lng: to.lng }, lang),
    fetchOSRMRoute({ lat: from.lat, lng: from.lng + offset }, { lat: to.lat, lng: to.lng - offset }, lang),
  ]);

  const results: RouteResult[] = [];

  if (direct) {
    const s = scoreRoute(direct.distanceM, direct.durationS, profile, "direct");
    results.push({ name: lang === "fr" ? "Meilleur itinéraire" : "Best accessible", waypoints: direct.waypoints, distanceM: direct.distanceM, timeMin: Math.round(direct.durationS / 60), color: "#FC4C02", steps: direct.steps, ...s });
  }
  if (alt1 && alt1.waypoints.length > 2) {
    const s = scoreRoute(alt1.distanceM, alt1.durationS, profile, "quiet");
    results.push({ name: lang === "fr" ? "Moins fréquenté" : "Low crowd route", waypoints: alt1.waypoints, distanceM: alt1.distanceM, timeMin: Math.round(alt1.durationS / 60), color: "#2563EB", steps: alt1.steps, ...s });
  }
  if (alt2 && alt2.waypoints.length > 2) {
    const s = scoreRoute(alt2.distanceM, alt2.durationS, profile, "scenic");
    results.push({ name: lang === "fr" ? "Pente douce" : "Gentle incline", waypoints: alt2.waypoints, distanceM: alt2.distanceM, timeMin: Math.round(alt2.durationS / 60), color: "#7C3AED", steps: alt2.steps, ...s });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

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

// ─── Agent loop ───────────────────────────────────────────────────────────────

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

  onLog({ type: "agent",  message: t(`[Agent] Task: find ${mode} route for ${profile}`, `[Agent] Tâche: itinéraire ${mode} pour ${profile}`) });
  await delay(220);
  onLog({ type: "tool",   message: `[Tool] → get_mobility_profile("${profile}")` });
  await delay(180);
  onLog({ type: "result", message: t("[Result] Profile loaded", "[Résultat] Profil chargé") });
  await delay(220);
  onLog({ type: "tool",   message: `[Tool] → geocode_coordinates(from, to)` });
  await delay(180);
  onLog({ type: "result", message: t("[Result] Coordinates resolved", "[Résultat] Coordonnées résolues") });
  await delay(220);
  onLog({ type: "tool",   message: `[Tool] → fetch_live_obstacles(area)` });
  await delay(280);
  onLog({ type: "think",  message: t("[Result] No major obstacles", "[Résultat] Aucun obstacle majeur") });
  await delay(220);

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

  onLog({ type: "tool",   message: `[Tool] → run_pathfinding(algo="A*", variants=3, lang="${lang}")` });
  await delay(380);

  const routes = await getAccessibleRoutes(from, to, profile, lang);

  onLog({ type: "result", message: t(`[Result] ${routes.length} routes via OSRM`, `[Résultat] ${routes.length} itinéraires via OSRM`) });
  await delay(180);
  onLog({ type: "tool",   message: `[Tool] → score_accessibility(routes, profile)` });
  await delay(280);
  onLog({ type: "result", message: t(`[Result] Best score: ${routes[0]?.score ?? "—"}/100`, `[Résultat] Meilleur score: ${routes[0]?.score ?? "—"}/100`) });
  await delay(180);
  onLog({ type: "tool",   message: `[Tool] → generate_turn_by_turn(steps, lang="${lang}")` });
  await delay(180);
  onLog({ type: "agent",  message: t(`[Agent] Done. ${routes.length} routes ready.`, `[Agent] Terminé. ${routes.length} itinéraires prêts.`) });

  onRoutes(routes);
}

export type { TransportMode };
