import React, { useEffect, useRef, useState } from "react";
import { Report } from "../types";
import { Map, MapPin } from "lucide-react";

declare const L: any;

interface IssuesMapProps {
  reports: Report[];
  darkMode?: boolean;
}

export default function IssuesMap({ reports, darkMode = false }: IssuesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(typeof L !== "undefined");

  // Check if Leaflet is loaded from CDN
  useEffect(() => {
    if (typeof L !== "undefined") {
      setLeafletLoaded(true);
      return;
    }

    const interval = setInterval(() => {
      if (typeof L !== "undefined") {
        setLeafletLoaded(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    // Check if map already initialized
    if (mapRef.current) return;

    // Create Leaflet Map centered globally first
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([40.7128, -74.0060], 13);

    // Dynamic map tiles based on dark mode status
    const initialTilesUrl = darkMode
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const tiles = L.tileLayer(initialTilesUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    tileLayerRef.current = tiles;

    // Zoom control positioned nicely
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Handle dark mode changes dynamically
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const activeUrl = darkMode
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    tileLayerRef.current.setUrl(activeUrl);
  }, [darkMode]);

  // Update Markers & Auto Bounds
  useEffect(() => {
    if (!mapRef.current || !leafletLoaded) return;

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (reports.length === 0) {
      // If no reports, fit to a broad view
      map.setView([39.8283, -98.5795], 4);
      return;
    }

    const bounds: any[] = [];

    // Custom marker creator using L.divIcon
    const createCustomMarkerIcon = (category: string, status: string, severity: string) => {
      let markerColor = "bg-blue-600";
      let ringColor = "ring-blue-300";
      let glowStyle = "";
      let isPulsing = false;
      
      if (status === "Fixed") {
        markerColor = "bg-emerald-600";
        ringColor = "ring-emerald-200";
        glowStyle = "box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);";
        isPulsing = false; // Solid green, no pulse
      } else if (severity === "high") {
        markerColor = "bg-red-600";
        ringColor = "ring-red-200";
        glowStyle = "box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);";
        isPulsing = true; // High severity pulses with red glow
      } else if (severity === "medium") {
        markerColor = "bg-amber-500";
        ringColor = "ring-amber-200";
        glowStyle = "box-shadow: 0 0 10px rgba(245, 158, 11, 0.7);";
        isPulsing = true; // Medium severity pulses amber
      } else {
        // Low / Default severity
        markerColor = "bg-blue-500";
        ringColor = "ring-blue-200";
        glowStyle = "box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);";
        isPulsing = false;
      }

      const pulseElement = isPulsing
        ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full ${markerColor} opacity-45"></span>`
        : "";

      return L.divIcon({
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            ${pulseElement}
            <div class="relative rounded-full w-3.5 h-3.5 ${markerColor} border-2 border-white ring-4 ${ringColor}" style="${glowStyle}"></div>
          </div>
        `,
        className: "custom-leaflet-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -10],
      });
    };

    reports.forEach((report) => {
      const { latitude, longitude, address } = report.location;
      if (typeof latitude !== "number" || typeof longitude !== "number") return;
      if (isNaN(latitude) || isNaN(longitude)) return;

      bounds.push([latitude, longitude]);

      const customIcon = createCustomMarkerIcon(report.category, report.status, report.severity);
      
      const popupContent = `
        <div class="p-3 font-sans text-slate-800 min-w-[220px]">
          <div class="flex items-center justify-between mb-1.5 gap-2">
            <span class="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">${report.category.replace("_", " ")}</span>
            <span class="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${
              report.status === "Fixed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : report.status === "Verified"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }">${report.status}</span>
          </div>
          <h4 class="text-xs font-bold text-slate-900 leading-snug mb-1.5">${report.description.substring(0, 80)}${report.description.length > 80 ? "..." : ""}</h4>
          <p class="text-[10px] text-slate-500 leading-normal mb-2 flex items-start gap-1">
            <svg class="w-3 h-3 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <span class="truncate">${address}</span>
          </p>
          <div class="text-[9px] text-slate-400 font-semibold border-t border-slate-100 pt-1.5 flex justify-between">
            <span>Severity:</span>
            <span class="font-bold uppercase ${
              report.severity === "high" ? "text-red-600" : report.severity === "medium" ? "text-amber-600" : "text-slate-600"
            }">${report.severity}</span>
          </div>
        </div>
      `;

      const marker = L.marker([latitude, longitude], { icon: customIcon })
        .bindPopup(popupContent, {
          closeButton: false,
          className: "custom-leaflet-popup"
        })
        .addTo(map);

      markersRef.current.push(marker);
    });

    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 14, { animate: true });
      } else {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
      }
    }
  }, [reports, leafletLoaded]);

  return (
    <div className="bg-gradient-to-b from-soft-bg to-slate-50/40 dark:from-slate-800 dark:to-slate-850/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md p-5 space-y-3.5 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/15">
            <Map className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 font-display uppercase tracking-tight">Geographic Hazard Tracker</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Real-time localized infrastructure reporting</p>
          </div>
        </div>
        <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-2.5 py-1 rounded-lg font-mono">
          {reports.length} Marker{reports.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-150 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-inner">
        {!leafletLoaded ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Loading Map Engine...</span>
          </div>
        ) : (
          <div 
            ref={mapContainerRef} 
            className="h-64 w-full z-10"
            style={{ outline: "none" }}
          />
        )}
      </div>
    </div>
  );
}
