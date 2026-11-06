import React, { useState } from 'react';
import { MapPin, Navigation, Compass, CheckCircle2, AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react';
import { SchoolConfig } from '../types';

interface InteractiveMapProps {
  schoolConfig: SchoolConfig;
  userCoords: { lat: number; lng: number } | null;
  distanceMeters: number | null;
  isWithinRadius: boolean;
  onRefreshLocation: () => void;
  onSimulateSchoolLocation?: () => void;
  isSimulated?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  schoolConfig,
  userCoords,
  distanceMeters,
  isWithinRadius,
  onRefreshLocation,
  onSimulateSchoolLocation,
  isSimulated = false,
}) => {
  const [mapType, setMapType] = useState<'interactive' | 'embed'>('interactive');

  // Calculate normalized coordinate offset for the radar canvas view
  // 100 meters represents the outer boundary of the radar display
  const maxRange = 150; // visual radar range in meters
  const dx = userCoords ? (userCoords.lng - schoolConfig.longitude) * 111320 * Math.cos((schoolConfig.latitude * Math.PI) / 180) : 0;
  const dy = userCoords ? (userCoords.lat - schoolConfig.latitude) * 110540 : 0;

  // Clamp user dot on radar display (-100 to 100 percentage)
  const clampedX = Math.max(-130, Math.min(130, (dx / maxRange) * 100));
  const clampedY = Math.max(-130, Math.min(130, (-dy / maxRange) * 100)); // invert Y for screen coords

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
            <Compass className="w-5 h-5 text-blue-600 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
              Validasi Geofence GPS SD BOPKRI Gondolayu
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                Maks. {schoolConfig.radiusToleranceMeters}m
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Titik: {schoolConfig.latitude.toFixed(6)}, {schoolConfig.longitude.toFixed(6)}
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-medium">
            <button
              onClick={() => setMapType('interactive')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                mapType === 'interactive'
                  ? 'bg-white text-blue-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Radar Geofence
            </button>
            <button
              onClick={() => setMapType('embed')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                mapType === 'embed'
                  ? 'bg-white text-blue-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Google Maps
            </button>
          </div>

          <button
            onClick={onRefreshLocation}
            title="Perbarui GPS Saat Ini"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs flex items-center gap-1 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Refresh GPS</span>
          </button>
        </div>
      </div>

      {/* Main Map View Area */}
      <div className="relative h-64 sm:h-72 bg-slate-900 overflow-hidden flex items-center justify-center">
        {mapType === 'interactive' ? (
          /* Futuristic Geofence Radar Visualizer */
          <div className="relative w-full h-full flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black select-none">
            {/* Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-30"></div>

            {/* 150m outer ring */}
            <div className="absolute w-56 h-56 rounded-full border border-dashed border-slate-700/60 pointer-events-none">
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 font-mono">
                150 meter
              </span>
            </div>

            {/* 100m Allowed Geofence Ring */}
            <div
              className={`absolute w-40 h-40 rounded-full border-2 transition-all duration-500 flex items-center justify-center ${
                isWithinRadius
                  ? 'border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
                  : 'border-amber-500/60 bg-amber-500/5'
              }`}
            >
              {/* Pulsing ring */}
              <div
                className={`absolute inset-0 rounded-full animate-ping opacity-25 ${
                  isWithinRadius ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ animationDuration: '3s' }}
              ></div>
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-900/90 border border-slate-700 text-emerald-400">
                Batas 100m Sekolah
              </span>
            </div>

            {/* 50m inner ring */}
            <div className="absolute w-20 h-20 rounded-full border border-dashed border-slate-700/50 pointer-events-none"></div>

            {/* Center School Pin */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/50 ring-4 ring-blue-500/30">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="mt-1 text-[11px] font-bold text-white px-2 py-0.5 rounded bg-slate-900/90 border border-blue-500/40 shadow-sm whitespace-nowrap">
                SD BOPKRI Gondolayu
              </span>
            </div>

            {/* User GPS Position marker */}
            {userCoords && (
              <div
                className="absolute z-20 flex flex-col items-center transition-all duration-700 pointer-events-none"
                style={{
                  transform: `translate(${clampedX}px, ${clampedY}px)`,
                }}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ring-4 transition-all ${
                    isWithinRadius
                      ? 'bg-emerald-500 ring-emerald-400/40 shadow-lg shadow-emerald-500/50 animate-pulse'
                      : 'bg-rose-500 ring-rose-400/40 shadow-lg shadow-rose-500/50'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                </div>
                <span
                  className={`mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${
                    isWithinRadius
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : 'bg-rose-950 text-rose-300 border border-rose-600'
                  }`}
                >
                  Posisi Anda ({distanceMeters !== null ? `${Math.round(distanceMeters)}m` : '0m'})
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Real Google Maps Satellite/Map Embed */
          <iframe
            title="Google Maps SD BOPKRI Gondolayu"
            src={`https://maps.google.com/maps?q=${schoolConfig.latitude},${schoolConfig.longitude}&z=18&output=embed`}
            className="w-full h-full border-0 filter contrast-105"
            loading="lazy"
          ></iframe>
        )}

        {/* Live Distance floating badge */}
        <div className="absolute top-3 left-3 z-30">
          <div
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-lg flex items-center gap-2 text-xs font-semibold ${
              isWithinRadius
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
            }`}
          >
            {isWithinRadius ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>
              {distanceMeters !== null
                ? `Jarak ke Sekolah: ${distanceMeters} meter`
                : 'Mendeteksi GPS...'}
            </span>
          </div>
        </div>

        {/* External Link */}
        <div className="absolute bottom-3 right-3 z-30">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${schoolConfig.latitude},${schoolConfig.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-[11px] text-white flex items-center gap-1 border border-white/20 transition-all"
          >
            Buka di Google Maps
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Geofence Status Footer */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {isWithinRadius ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Lokasi Valid: Berada di Lingkungan SD BOPKRI Gondolayu (Toleransi &le; 100m)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>
                Di Luar Radius: Anda berada {distanceMeters !== null ? `${Math.round(distanceMeters)}m` : ''} dari sekolah. Silakan mendekat ke area sekolah untuk absensi.
              </span>
            </div>
          )}
        </div>

        {/* Development & Testing simulation button */}
        {onSimulateSchoolLocation && (
          <button
            onClick={onSimulateSchoolLocation}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isSimulated
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            {isSimulated ? 'Lokasi Uji: Di Gerbang Sekolah (Aktif)' : 'Simulasi Berada di Sekolah (Uji Coba)'}
          </button>
        )}
      </div>
    </div>
  );
};
