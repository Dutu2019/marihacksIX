"use client";

import { useEffect, useRef } from "react";
import type {
  LatLng,
  RouteResult,
  TransitStop,
  DisabledParking,
} from "../lib/routing";

interface Props {
  center: LatLng;
  origin: LatLng | null;
  destination: LatLng | null;
  routes: RouteResult[];
  selectedRouteIndex: number;
  transitStops?: TransitStop[];
  disabledParking?: DisabledParking[];
  onMapClick?: (latlng: LatLng) => void;
  showAccessibilityLayer?: boolean;
}

// ── Colour palette for overlay features ─────────────────────────────────────
const LAYER_STYLES: Record<
  string,
  { color: string; radius: number; label: string }
> = {
  stairs: { color: "#EF4444", radius: 5, label: "Stairs" },
  elevators: { color: "#22C55E", radius: 7, label: "Elevator" },
  ramps: { color: "#3B82F6", radius: 5, label: "Ramp" },
  metro_entrances: { color: "#A855F7", radius: 7, label: "Metro" },
  bus_stops_accessible: {
    color: "#10B981",
    radius: 5,
    label: "Accessible stop",
  },
  bus_stops_standard: { color: "#6B7280", radius: 4, label: "Bus stop" },
  paratransit_stops: { color: "#F59E0B", radius: 6, label: "Paratransit" },
  wheelchair_yes: { color: "#06B6D4", radius: 4, label: "Wheelchair OK" },
  wheelchair_no: { color: "#F97316", radius: 4, label: "Not accessible" },
};

/** Extract a [lat, lng] centroid from a GeoJSON-like geometry object. */
function geomToLatLng(g: any): [number, number] | null {
  if (!g) return null;
  if (g.type === "Point") return [g.coordinates[1], g.coordinates[0]];
  if (g.type === "LineString" && g.coordinates?.length) {
    const mid = g.coordinates[Math.floor(g.coordinates.length / 2)];
    return [mid[1], mid[0]];
  }
  return null;
}

export default function MapView({
  center,
  origin,
  destination,
  routes,
  selectedRouteIndex,
  transitStops = [],
  disabledParking = [],
  onMapClick,
  showAccessibilityLayer = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<{ origin?: any; dest?: any }>({});
  const overlayGroupRef = useRef<any>(null); // LayerGroup for OSM overlay
  const slopeLayerRef = useRef<any>(null); // ImageOverlay for slope heatmap

  // ── Initialize map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [center.lat, center.lng],
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      map.on("click", (e: any) => {
        onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      // Pre-create the overlay group (empty until data arrives)
      overlayGroupRef.current = L.layerGroup().addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  // ── Fly to center ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([center.lat, center.lng], 15, { duration: 1.4 });
  }, [center]);

  // ── Draw / update route polylines ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      polylinesRef.current.forEach((p) => p.remove());
      polylinesRef.current = [];

      if (!routes.length) return;

      routes.forEach((route, i) => {
        const isSelected = i === selectedRouteIndex;
        const latlngs = route.waypoints.map(
          (p) => [p.lat, p.lng] as [number, number]
        );

        if (isSelected) {
          const shadow = L.polyline(latlngs, {
            color: "white",
            weight: 10,
            opacity: 0.6,
          }).addTo(mapRef.current);
          polylinesRef.current.push(shadow);
        }

        const line = L.polyline(latlngs, {
          color: isSelected ? route.color : "#B0B0B0",
          weight: isSelected ? 6 : 3,
          opacity: isSelected ? 1 : 0.5,
          dashArray: isSelected ? undefined : "6,8",
        }).addTo(mapRef.current);
        polylinesRef.current.push(line);
      });

      const selected = routes[selectedRouteIndex];
      if (selected?.waypoints.length) {
        const bounds = (window as any).L
          ? (window as any).L.latLngBounds(
              selected.waypoints.map((p: LatLng) => [p.lat, p.lng])
            )
          : null;
        // fall back to import-based bounds
        import("leaflet").then((L) => {
          const b = L.latLngBounds(
            selected.waypoints.map((p) => [p.lat, p.lng] as [number, number])
          );
          mapRef.current.fitBounds(b, { padding: [60, 60], maxZoom: 17 });
        });
      }
    });
  }, [routes, selectedRouteIndex]);

  // ── Origin marker ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current.origin?.remove();
      markersRef.current.origin = null;
      if (!origin) return;

      const icon = L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#FC4C02;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        className: "",
      });
      markersRef.current.origin = L.marker([origin.lat, origin.lng], { icon })
        .addTo(mapRef.current)
        .bindPopup("You are here");
    });
  }, [origin]);

  // ── Destination marker ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current.dest?.remove();
      markersRef.current.dest = null;
      if (!destination) return;

      const icon = L.divIcon({
        html: `<div style="width:28px;height:36px;position:relative;">
          <svg viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22S28 23.63 28 14C28 6.27 21.73 0 14 0z" fill="#FC4C02"/>
            <circle cx="14" cy="14" r="6" fill="white"/>
          </svg>
        </div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        className: "",
      });
      markersRef.current.dest = L.marker([destination.lat, destination.lng], {
        icon,
      })
        .addTo(mapRef.current)
        .bindPopup("Destination");
    });
  }, [destination]);

  // Transit stop markers
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current
        .filter((m) => m._type === "transit")
        .forEach((m) => m.remove());
      markersRef.current = markersRef.current.filter(
        (m) => m._type !== "transit"
      );

      transitStops.forEach((stop) => {
        const icon =
          stop.type === "metro" ? "🚇" : stop.type === "tram" ? "🚊" : "🚌";
        const m = L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({
            html: `<div style="background:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:2px solid #2563EB">${icon}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            className: "",
          }),
        })
          .addTo(mapRef.current)
          .bindPopup(
            `<b>${stop.name}</b><br>${stop.type} · ${
              stop.accessible ? "♿ Accessible" : "Not accessible"
            }${stop.lines.length ? "<br>Lines: " + stop.lines.join(", ") : ""}`
          );
        (m as any)._type = "transit";
        markersRef.current.push(m);
      });
    });
  }, [transitStops]);

  // Disabled parking markers
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current
        .filter((m) => m._type === "parking")
        .forEach((m) => m.remove());
      markersRef.current = markersRef.current.filter(
        (m) => m._type !== "parking"
      );

      disabledParking.forEach((p) => {
        const m = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            html: `<div style="background:#1E40AF;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2)">P♿</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            className: "",
          }),
        })
          .addTo(mapRef.current)
          .bindPopup(
            `<b>${p.name}</b><br>${p.spots} accessible spot${
              p.spots !== 1 ? "s" : ""
            }${p.free ? " · Free" : ""}`
          );
        (m as any)._type = "parking";
        markersRef.current.push(m);
      });
    });
  }, [disabledParking]);

  // ── Accessibility overlay ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !overlayGroupRef.current) return;

    import("leaflet").then(async (L) => {
      const group: any = overlayGroupRef.current;
      group.clearLayers();

      // Also remove any previous slope overlay
      if (slopeLayerRef.current) {
        slopeLayerRef.current.remove();
        slopeLayerRef.current = null;
      }

      if (!showAccessibilityLayer) return;

      // Lazy-load data
      let accData: any = null;
      try {
        const res = await fetch("/data.json");
        if (res.ok) accData = await res.json();
      } catch {
        /* no data file */
      }

      if (!accData?.data) return;

      const d = accData.data;

      // ── Draw slope heatmap as a canvas ImageOverlay ──────────────────────
      if (accData.slope_grid && accData.lats && accData.lons) {
        const grid: number[][] = accData.slope_grid;
        const lats: number[] = accData.lats;
        const lons: number[] = accData.lons;
        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;

        if (rows > 0 && cols > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = cols;
          canvas.height = rows;
          const ctx2d = canvas.getContext("2d")!;
          const imgData = ctx2d.createImageData(cols, rows);

          // Map slope → RGBA: green (0%) → yellow (5%) → red (12%+)
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const slope = grid[r][c];
              const idx = (r * cols + c) * 4;
              if (!Number.isFinite(slope)) {
                imgData.data[idx + 3] = 0; // transparent
                continue;
              }
              const t = Math.min(1, slope / 12);
              // green → yellow → red
              const red = Math.round(t < 0.5 ? t * 2 * 255 : 255);
              const green = Math.round(
                t < 0.5 ? 200 : (1 - (t - 0.5) * 2) * 200
              );
              imgData.data[idx] = red;
              imgData.data[idx + 1] = green;
              imgData.data[idx + 2] = 0;
              imgData.data[idx + 3] =
                slope > 1 ? Math.min(180, Math.round(slope * 10)) : 0;
            }
          }
          ctx2d.putImageData(imgData, 0, 0);

          const bounds = L.latLngBounds(
            [lats[0], lons[0]],
            [lats[lats.length - 1], lons[lons.length - 1]]
          );
          slopeLayerRef.current = L.imageOverlay(canvas.toDataURL(), bounds, {
            opacity: 0.45,
          }).addTo(mapRef.current);
        }
      }

      // ── Draw OSM point / line features ───────────────────────────────────
      const featureKeys = Object.keys(
        LAYER_STYLES
      ) as (keyof typeof LAYER_STYLES)[];

      for (const key of featureKeys) {
        const features: any[] = d[key] ?? [];
        const style = LAYER_STYLES[key];

        for (const f of features) {
          const pt = geomToLatLng(f.geometry);
          if (!pt) continue;

          const circle = L.circleMarker(pt, {
            radius: style.radius,
            color: style.color,
            fillColor: style.color,
            fillOpacity: 0.75,
            weight: 1.5,
            opacity: 0.9,
          });

          // Tooltip with feature info
          const tagLine = f.tags
            ? Object.entries(f.tags)
                .filter(([k]) =>
                  ["name", "wheelchair", "surface", "ref"].includes(k)
                )
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "";

          circle.bindTooltip(
            `<strong>${style.label}</strong>${
              tagLine
                ? `<br/><span style="font-size:11px">${tagLine}</span>`
                : ""
            }`,
            { direction: "top", offset: [0, -4] }
          );

          group.addLayer(circle);
        }
      }
    });
  }, [showAccessibilityLayer]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", cursor: "crosshair" }}
    />
  );
}
