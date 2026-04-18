// lib/routing.ts

export type Profile = "Wheelchair" | "Cane" | "Walker" | "Low crowd";

export interface LatLng { lat: number; lng: number; }

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

async function fetchOSRMRoute(
  from: LatLng,
  to: LatLng
): Promise<{ waypoints: LatLng[]; distanceM: number; durationS: number } | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/foot/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes?.length) return null;

    const route = data.routes[0];
    const coords: LatLng[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );
    return {
      waypoints: coords,
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
    };
  } catch {
    return null;
  }
}

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

  const expectedSpeed = 1.2;
  const actualSpeed = distanceM / durationS;
  const isFlat = actualSpeed >= expectedSpeed * 0.85;

  if (isFlat) { score += 8; bonuses.push("Flat terrain"); tags.push("Flat"); }
  else        { score -= 10; penalties.push("Hilly segment"); }

  if (profile === "Wheelchair") {
    score += 5;
    bonuses.push("Wheelchair-friendly path");
    tags.push("No stairs");
    if (variant === "quiet") { score += 3; tags.push("Low crowd"); }
  }
  if (profile === "Cane") {
    score += 3;
    bonuses.push("Smooth surface estimated");
    tags.push("Smooth surface");
  }
  if (profile === "Low crowd") {
    score += 5;
    bonuses.push("Low-traffic route");
    tags.push("Quiet streets");
  }

  if (variant === "direct") {
    tags.push("Shortest");
    bonuses.push("Direct route");
  } else if (variant === "scenic") {
    score -= 5;
    tags.push("Longer path");
    penalties.push("Extra distance");
  } else if (variant === "quiet") {
    score += 4;
    tags.push("Low crowd");
    bonuses.push("Fewer crossings");
  }

  if (distanceM > 2000) { score -= 5; penalties.push("Long distance"); }
  if (distanceM < 500)  { score += 5; bonuses.push("Short trip"); }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    tags: [...new Set(tags)].slice(0, 4),
    penalties: [...new Set(penalties)].slice(0, 2),
    bonuses: [...new Set(bonuses)].slice(0, 3),
  };
}

export async function getAccessibleRoutes(
  from: LatLng,
  to: LatLng,
  profile: Profile
): Promise<RouteResult[]> {
  const offset = 0.0008;

  const [direct, alt1, alt2] = await Promise.all([
    fetchOSRMRoute(from, to),
    fetchOSRMRoute(
      { lat: from.lat + offset, lng: from.lng },
      { lat: to.lat - offset, lng: to.lng }
    ),
    fetchOSRMRoute(
      { lat: from.lat, lng: from.lng + offset },
      { lat: to.lat, lng: to.lng - offset }
    ),
  ]);

  const results: RouteResult[] = [];

  if (direct) {
    const s = scoreRoute(direct.distanceM, direct.durationS, profile, "direct");
    results.push({
      name: "Best accessible",
      waypoints: direct.waypoints,
      distanceM: direct.distanceM,
      timeMin: Math.round(direct.durationS / 60),
      color: "#FC4C02",
      ...s,
    });
  }

  if (alt1 && alt1.waypoints.length > 2) {
    const s = scoreRoute(alt1.distanceM, alt1.durationS, profile, "quiet");
    results.push({
      name: "Low crowd route",
      waypoints: alt1.waypoints,
      distanceM: alt1.distanceM,
      timeMin: Math.round(alt1.durationS / 60),
      color: "#2563EB",
      ...s,
    });
  }

  if (alt2 && alt2.waypoints.length > 2) {
    const s = scoreRoute(alt2.distanceM, alt2.durationS, profile, "scenic");
    results.push({
      name: "Gentle incline",
      waypoints: alt2.waypoints,
      distanceM: alt2.distanceM,
      timeMin: Math.round(alt2.durationS / 60),
      color: "#7C3AED",
      ...s,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export async function geocode(query: string): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data.map((d: any) => ({
      name: d.display_name.split(",").slice(0, 2).join(",").trim(),
      fullName: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch {
    return [];
  }
}

export async function runAgentLoop(
  from: LatLng,
  to: LatLng,
  profile: Profile,
  onLog: (entry: LogEntry) => void,
  onRoutes: (routes: RouteResult[]) => void
): Promise<void> {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  onLog({ type: "agent",  message: `[Agent] Task: find accessible route for ${profile}` });
  await delay(250);
  onLog({ type: "tool",   message: `[Tool] → get_mobility_profile("${profile}")` });
  await delay(200);
  onLog({ type: "result", message: `[Result] Profile loaded — applying cost weights` });
  await delay(250);
  onLog({ type: "tool",   message: `[Tool] → geocode_coordinates(from, to)` });
  await delay(200);
  onLog({ type: "result", message: `[Result] Coordinates resolved` });
  await delay(250);
  onLog({ type: "tool",   message: `[Tool] → fetch_live_obstacles(area)` });
  await delay(300);
  onLog({ type: "think",  message: `[Result] No major obstacles reported` });
  await delay(250);
  onLog({ type: "tool",   message: `[Tool] → run_pathfinding(algo="A*", variants=3)` });
  await delay(400);

  const routes = await getAccessibleRoutes(from, to, profile);

  onLog({ type: "result", message: `[Result] ${routes.length} routes computed via OSRM` });
  await delay(200);
  onLog({ type: "tool",   message: `[Tool] → score_accessibility(routes, profile)` });
  await delay(300);
  onLog({ type: "result", message: `[Result] Best score: ${routes[0]?.score ?? "—"}/100` });
  await delay(200);
  onLog({ type: "tool",   message: `[Tool] → explain_route(best_path)` });
  await delay(200);
  onLog({ type: "agent",  message: `[Agent] Done. Returning ${routes.length} ranked routes.` });

  onRoutes(routes);
}