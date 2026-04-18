"use client";

import { useEffect, useRef } from "react";
import type { LatLng, RouteResult } from "../lib/routing";

interface Props {
  center: LatLng;
  origin: LatLng | null;
  destination: LatLng | null;
  routes: RouteResult[];
  selectedRouteIndex: number;
  onMapClick?: (latlng: LatLng) => void;
}

export default function MapView({
  center,
  origin,
  destination,
  routes,
  selectedRouteIndex,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef   = useRef<{ origin?: any; dest?: any }>({});

  // ── Initialize map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Leaflet must be imported dynamically (SSR-safe)
    import("leaflet").then((L) => {
      // Fix default icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [center.lat, center.lng],
        zoom: 14,
        zoomControl: false,
      });

      // OpenStreetMap tiles — free, no key
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom zoom control (bottom right)
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Click handler for setting destination
      map.on("click", (e: any) => {
        onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  // ── Fly to center when it changes ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([center.lat, center.lng], 15, { duration: 1.4 });
  }, [center]);

  // ── Draw / update route polylines ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      // Remove old polylines
      polylinesRef.current.forEach((p) => p.remove());
      polylinesRef.current = [];

      if (!routes.length) return;

      routes.forEach((route, i) => {
        const isSelected = i === selectedRouteIndex;
        const latlngs = route.waypoints.map((p) => [p.lat, p.lng] as [number, number]);

        // Shadow (white outline) for selected route
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

      // Fit map to the selected route
      const selected = routes[selectedRouteIndex];
      if (selected?.waypoints.length) {
        const bounds = L.latLngBounds(
          selected.waypoints.map((p) => [p.lat, p.lng] as [number, number])
        );
        mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
      }
    });
  }, [routes, selectedRouteIndex]);

  // ── Update origin marker ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      if (markersRef.current.origin) {
        markersRef.current.origin.remove();
        markersRef.current.origin = null;
      }
      if (!origin) return;

      const icon = L.divIcon({
        html: `<div style="
          width:18px;height:18px;border-radius:50%;
          background:#FC4C02;border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        className: "",
      });

      markersRef.current.origin = L.marker([origin.lat, origin.lng], { icon })
        .addTo(mapRef.current)
        .bindPopup("You are here");
    });
  }, [origin]);

  // ── Update destination marker ────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      if (markersRef.current.dest) {
        markersRef.current.dest.remove();
        markersRef.current.dest = null;
      }
      if (!destination) return;

      const icon = L.divIcon({
        html: `<div style="
          width:28px;height:36px;position:relative;
        ">
          <svg viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22S28 23.63 28 14C28 6.27 21.73 0 14 0z"
              fill="#FC4C02"/>
            <circle cx="14" cy="14" r="6" fill="white"/>
          </svg>
        </div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        className: "",
      });

      markersRef.current.dest = L.marker([destination.lat, destination.lng], { icon })
        .addTo(mapRef.current)
        .bindPopup("Destination");
    });
  }, [destination]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", cursor: "crosshair" }}
    />
  );
}
