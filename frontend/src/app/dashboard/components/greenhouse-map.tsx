"use client"

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GreenhouseNode } from './dashboard-ui';
import { useTranslation } from '@/i18n/provider';

interface GreenhouseMapProps {
  greenhouses: GreenhouseNode[];
}

const customIcon = (color: string) => {
  const markerHtmlStyles = `
    background-color: ${color};
    width: 2rem;
    height: 2rem;
    display: block;
    left: -1rem;
    top: -1rem;
    position: relative;
    border-radius: 3rem 3rem 0;
    transform: rotate(45deg);
    border: 3px solid #FFFFFF;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  `;

  return L.divIcon({
    className: 'custom-pin',
    iconAnchor: [0, 24],
    popupAnchor: [0, -36],
    html: `<span style="${markerHtmlStyles}"></span>`
  });
}

function FitToMarkers({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) {
      return;
    }

    if (positions.length === 1) {
      map.setView(positions[0], 16);
      return;
    }

    map.fitBounds(positions, { padding: [24, 24] });
  }, [map, positions]);

  return null;
}

export function GreenhouseMap({ greenhouses }: GreenhouseMapProps) {
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  const mapNodes = useMemo(
    () => greenhouses
      .filter(
        (gh): gh is GreenhouseNode & { latitude: number; longitude: number } =>
          typeof gh.latitude === 'number' &&
          Number.isFinite(gh.latitude) &&
          typeof gh.longitude === 'number' &&
          Number.isFinite(gh.longitude)
      )
      .map((gh) => ({
        ...gh,
        icon: customIcon(
          gh.riskLevel === 'danger'
            ? '#f43f5e'
            : gh.riskLevel === 'warning'
              ? '#f59e0b'
              : '#10b981'
        )
      })),
    [greenhouses]
  );

  useEffect(() => {
    setMounted(true);
    // Cleanup Leaflet default icons bug
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse">
        <p className="text-slate-400">{t('greenhouse.map_loading')}</p>
      </div>
    );
  }

  if (mapNodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100/70 dark:bg-slate-800/40 rounded-xl text-center px-6">
        <p className="text-slate-700 dark:text-slate-200 font-semibold">{t('greenhouse.map_no_coordinates')}</p>
        <p className="text-slate-500 text-sm mt-1">{t('greenhouse.map_set_coordinates')}</p>
      </div>
    );
  }

  const initialCenter: [number, number] = [mapNodes[0].latitude, mapNodes[0].longitude];
  const positions = mapNodes.map((node) => [node.latitude, node.longitude] as [number, number]);

  return (
    <MapContainer 
      center={initialCenter}
      zoom={12} 
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem', zIndex: 0 }}
      scrollWheelZoom={true}
    >
      <FitToMarkers positions={positions} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mapNodes.map((node) => (
        <Marker 
          key={node.id} 
          position={[node.latitude, node.longitude]} 
          icon={node.icon}
        >
          <Popup className="font-sans">
            <div className="text-sm font-medium pr-4">
              <h3 className="font-bold text-slate-800 text-base">{node.name}</h3>
              <p className="text-slate-500 mb-2">{t('greenhouse.code')}: <span className="text-slate-700">{node.code}</span></p>
              
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                <span className="text-xs text-slate-500">{t('overview.greenhouse_status')}:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs text-white font-semibold ${
                  node.riskLevel === 'danger' ? 'bg-rose-500' : 
                  node.riskLevel === 'warning' ? 'bg-amber-500' : 
                  'bg-emerald-500'
                }`}>
                  {node.riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">{t('overview.detections')}:</span>
                <span className="font-bold text-slate-800">{node.detections}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}