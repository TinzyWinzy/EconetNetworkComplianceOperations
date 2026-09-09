import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TowerTelemetry } from '../types';
import { exposureOf } from '../lib/exposure';

/**
 * Real interactive map (Mapbox-compatible, token-free via MapLibre GL).
 * OpenStreetMap tiles with color-coded tower markers + popups. MapLibre GL is
 * the drop-in Mapbox GL fork that needs no access token or billing, so the
 * pilot link works out-of-the-box with zero credentials.
 */

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};

const HARARE: [number, number] = [31.033, -17.825];

function colorOf(t: TowerTelemetry): string {
  if (exposureOf(t) > 0 || t.status === 'Offline') return '#dc2626';
  if (t.status === 'Backup Battery') return '#f59e0b';
  return '#16a34a';
}

function popupHtml(t: TowerTelemetry): string {
  const breach = exposureOf(t) > 0;
  return `<div style="font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; line-height: 1.45;">
    <strong style="font-size: 13px;">${t.id} · ${t.name}</strong><br/>
    <span>${t.status}</span><br/>
    <span>CA ${t.cellAvailabilityPercent}% · DSASR ${t.dsasrPercent}% · DSDR ${t.dsdrPercent}%</span><br/>
    ${t.activeOutageDurationMinutes > 0 ? `<span>Outage ${t.activeOutageDurationMinutes}m</span><br/>` : ''}
    <strong style="color:${breach ? '#dc2626' : '#16a34a'}">${breach ? `Exposure US$${exposureOf(t).toLocaleString()}` : 'Inside SI 154 limits'}</strong>
  </div>`;
}

export default function GeoMap({ towers }: { towers: TowerTelemetry[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const fittedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: HARARE,
      zoom: 11,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    // Guard against mounting inside a not-yet-laid-out container.
    const t = setTimeout(() => map.resize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    for (const t of towers) {
      const el = document.createElement('div');
      el.className = 'tower-marker';
      el.style.background = colorOf(t);
      if (t.status === 'Offline') el.classList.add('pulse-dot');
      const marker = new maplibregl.Marker({ element: el }).setLngLat([t.longitude, t.latitude]).addTo(map);
      marker.setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(popupHtml(t)));
      markersRef.current.push(marker);
      bounds.extend([t.longitude, t.latitude]);
    }
    if (!fittedRef.current && towers.length > 0) {
      map.fitBounds(bounds, { padding: 50, duration: 0 });
      fittedRef.current = true;
    }
  }, [towers]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Geographic network map">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">Geographic network map</h2>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-emerald-600" /> Online</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-amber-400" /> Backup battery</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-red-600" /> Breach / offline</span>
        </div>
      </div>
      <div className="relative mt-2 overflow-hidden rounded-xl border border-slate-200">
        <div ref={containerRef} className="h-[360px] w-full sm:h-[520px]" />
      </div>
      <p className="tnum mt-2 text-xs text-slate-500">
        {towers.length} Harare pilot sites · synthetic coordinates for demo · pan/zoom, click a marker for its SI 154 status.
        Map tiles need internet — if tiles fail, use Grid/Table (same data, zero tile cost).
        Keyboard and screen-reader users: switch to the Grid view for a fully accessible site list.
      </p>
    </section>
  );
}
