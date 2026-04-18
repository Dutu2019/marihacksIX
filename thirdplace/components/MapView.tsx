"use client";

import { useEffect, useRef } from "react";
import type { LatLng, RouteResult, TransitStop, DisabledParking } from "../lib/routing";

interface Props {
  center: LatLng;
  origin: LatLng | null;
  destination: LatLng | null;
  routes: RouteResult[];
  selectedRouteIndex: number;
  transitStops?: TransitStop[];
  disabledParking?: DisabledParking[];
  onMapClick?: (latlng: LatLng) => void;
}

export default function MapView({
  center, origin, destination, routes,
  selectedRouteIndex, transitStops = [],
  disabledParking = [], onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef   = useRef<any[]>([]);
  const pinRef       = useRef<{ origin?: any; dest?: any }>({});

  useEffect(() => {
    if (!containerRef.current) return;
    
    let isMounted = true; // Fix: cancel if unmounted before Leaflet loads

    import("leaflet").then((L) => {
      if (!isMounted) return; // Bail if React strict mode double-rendered

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.on("click", (e: any) => onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
    });

    return () => { 
      isMounted = false;
      if (mapRef.current) { 
        mapRef.current.remove(); 
        mapRef.current = null; 
      } 
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([center.lat, center.lng], 15, { duration: 1.2 });
  }, [center]);

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      polylinesRef.current.forEach((p) => p.remove());
      polylinesRef.current = [];
      if (!routes.length) return;

      routes.forEach((route, i) => {
        const isSelected = i === selectedRouteIndex;
        const lls = route.waypoints.map((p) => [p.lat, p.lng] as [number, number]);
        if (isSelected) {
          polylinesRef.current.push(
            L.polyline(lls, { color: "white", weight: 10, opacity: 0.5 }).addTo(mapRef.current)
          );
        }
        polylinesRef.current.push(
          L.polyline(lls, {
            color: isSelected ? route.color : "#A0A0A0",
            weight: isSelected ? 6 : 3,
            opacity: isSelected ? 1 : 0.4,
            dashArray: isSelected ? undefined : "8,10",
          }).addTo(mapRef.current)
        );
      });

      const sel = routes[selectedRouteIndex];
      if (sel?.waypoints.length) {
        mapRef.current.fitBounds(
          L.latLngBounds(sel.waypoints.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [80, 80], maxZoom: 17 }
        );
      }
    });
  }, [routes, selectedRouteIndex]);

  // Origin / destination pins
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      pinRef.current.origin?.remove();
      if (!origin) return;
      pinRef.current.origin = L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#FC4C02;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8], className: "",
        }),
      }).addTo(mapRef.current).bindPopup("You are here");
    });
  }, [origin]);

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      pinRef.current.dest?.remove();
      if (!destination) return;
      pinRef.current.dest = L.marker([destination.lat, destination.lng], {
        icon: L.divIcon({
          html: `<div style="width:28px;height:36px"><svg viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22S28 23.63 28 14C28 6.27 21.73 0 14 0z" fill="#FC4C02"/><circle cx="14" cy="14" r="6" fill="white"/></svg></div>`,
          iconSize: [28, 36], iconAnchor: [14, 36], className: "",
        }),
      }).addTo(mapRef.current).bindPopup("Destination");
    });
  }, [destination]);

  // Transit stop markers
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current.filter((m) => m._type === "transit").forEach((m) => m.remove());
      markersRef.current = markersRef.current.filter((m) => m._type !== "transit");

      transitStops.forEach((stop) => {
        const icon = stop.type === "metro" ? "🚇" : stop.type === "tram" ? "🚊" : "🚌";
        const m = L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({
            html: `<div style="background:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:2px solid #2563EB">${icon}</div>`,
            iconSize: [28, 28], iconAnchor: [14, 14], className: "",
          }),
        }).addTo(mapRef.current)
          .bindPopup(`<b>${stop.name}</b><br>${stop.type} · ${stop.accessible ? "♿ Accessible" : "Not accessible"}${stop.lines.length ? "<br>Lines: " + stop.lines.join(", ") : ""}`);
        (m as any)._type = "transit";
        markersRef.current.push(m);
      });
    });
  }, [transitStops]);

  // Disabled parking markers
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current.filter((m) => m._type === "parking").forEach((m) => m.remove());
      markersRef.current = markersRef.current.filter((m) => m._type !== "parking");

      disabledParking.forEach((p) => {
        const m = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            html: `<div style="background:#1E40AF;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2)">P♿</div>`,
            iconSize: [28, 28], iconAnchor: [14, 14], className: "",
          }),
        }).addTo(mapRef.current)
          .bindPopup(`<b>${p.name}</b><br>${p.spots} accessible spot${p.spots !== 1 ? "s" : ""}${p.free ? " · Free" : ""}`);
        (m as any)._type = "parking";
        markersRef.current.push(m);
      });
    });
  }, [disabledParking]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", cursor: "crosshair" }} />;
}