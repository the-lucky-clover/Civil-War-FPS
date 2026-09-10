import React from 'react';
import { MinimapEntity, FlagWaypoint, Faction } from '../types/game';

interface MinimapProps {
  playerPos: { x: number; z: number };
  playerYaw: number;
  entities: MinimapEntity[];
  flagPoints?: FlagWaypoint[];
  playerFaction: Faction;
  size?: number; // size in pixels (default 170)
  mapRange?: number; // radius in game units (default 65)
}

export const Minimap: React.FC<MinimapProps> = ({
  playerPos,
  playerYaw,
  entities,
  flagPoints = [],
  playerFaction,
  size = 170,
  mapRange = 65,
}) => {
  const radius = size / 2;
  const compassAngle = (-playerYaw * 180) / Math.PI;

  // Transform world coordinates relative to player and rotate by player yaw so "up" is forward
  const getMinimapCoords = (worldX: number, worldZ: number) => {
    const dx = worldX - playerPos.x;
    const dz = worldZ - playerPos.z;

    // Rotate so forward is up
    const cos = Math.cos(playerYaw);
    const sin = Math.sin(playerYaw);

    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;

    // Scale to radar
    const scale = (radius - 14) / mapRange;
    const px = radius + rx * scale;
    const py = radius + rz * scale; // In Three.js, -Z is forward

    return {
      x: px,
      y: py,
      dist: Math.hypot(dx, dz),
    };
  };

  return (
    <div
      id="hud-minimap-container"
      className="relative select-none pointer-events-none"
      style={{ width: size, height: size }}
    >
      {/* Outer Ornate Brass Frame */}
      <div className="absolute inset-0 rounded-full border-2 border-[#d4af37]/80 bg-[#0a0806]/85 shadow-[0_0_15px_rgba(0,0,0,0.8)] backdrop-blur-xs overflow-hidden">
        {/* Radar Background Texture / Concentric Range Rings */}
        <svg width={size} height={size} className="absolute inset-0">
          <defs>
            <radialGradient id="minimap-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2c2217" stopOpacity="0.4" />
              <stop offset="85%" stopColor="#120e0a" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#080604" stopOpacity="0.95" />
            </radialGradient>
          </defs>

          {/* Background circle */}
          <circle cx={radius} cy={radius} r={radius - 2} fill="url(#minimap-glow)" />

          {/* Range rings (20m, 45m) */}
          <circle
            cx={radius}
            cy={radius}
            r={(radius - 14) * 0.4}
            fill="none"
            stroke="#d4af37"
            strokeWidth="0.75"
            strokeDasharray="2 3"
            strokeOpacity="0.3"
          />
          <circle
            cx={radius}
            cy={radius}
            r={(radius - 14) * 0.8}
            fill="none"
            stroke="#d4af37"
            strokeWidth="0.75"
            strokeDasharray="3 4"
            strokeOpacity="0.4"
          />

          {/* Crosshair grid lines */}
          <line
            x1={radius}
            y1={12}
            x2={radius}
            y2={size - 12}
            stroke="#d4af37"
            strokeWidth="0.5"
            strokeOpacity="0.25"
          />
          <line
            x1={12}
            y1={radius}
            x2={size - 12}
            y2={radius}
            stroke="#d4af37"
            strokeWidth="0.5"
            strokeOpacity="0.25"
          />

          {/* Render Waypoints / Flags */}
          {flagPoints.map((flag) => {
            const { x, y, dist } = getMinimapCoords(flag.x, flag.z);
            if (dist > mapRange * 1.05) return null;
            const flagColor =
              flag.controllingFaction === 'NORTH'
                ? '#4d88ff'
                : flag.controllingFaction === 'SOUTH'
                ? '#ff4444'
                : '#d4af37';

            return (
              <g key={flag.id} transform={`translate(${x}, ${y})`}>
                <circle r="7" fill={flagColor} fillOpacity="0.25" stroke={flagColor} strokeWidth="1" />
                <rect x="-3" y="-3" width="6" height="6" fill={flagColor} rx="1" />
              </g>
            );
          })}

          {/* Render Entities (Enemies, Allies, Cannons, Doors) */}
          {entities.map((e) => {
            const { x, y, dist } = getMinimapCoords(e.x, e.z);
            if (dist > mapRange * 1.05) return null;

            if (e.type === 'enemy') {
              return (
                <g key={e.id} transform={`translate(${x}, ${y})`}>
                  <circle
                    r={e.isBoss ? 4.5 : 2.75}
                    fill={e.isBoss ? '#ff1a1a' : '#ff4d4d'}
                    stroke="#ffffff"
                    strokeWidth={e.isBoss ? 1.2 : 0.6}
                  />
                  {e.isBoss && (
                    <circle r="7" fill="none" stroke="#ff1a1a" strokeWidth="0.8" strokeDasharray="2 2" />
                  )}
                </g>
              );
            }

            if (e.type === 'ally') {
              return (
                <g key={e.id} transform={`translate(${x}, ${y})`}>
                  <circle r="2.75" fill="#4d94ff" stroke="#ffffff" strokeWidth="0.6" />
                </g>
              );
            }

            if (e.type === 'cannon') {
              return (
                <g key={e.id} transform={`translate(${x}, ${y})`}>
                  <polygon points="0,-4 3,3 -3,3" fill="#e5b849" stroke="#3d2b1f" strokeWidth="0.5" />
                </g>
              );
            }

            if (e.type === 'door') {
              return (
                <g key={e.id} transform={`translate(${x}, ${y})`}>
                  <rect x="-2" y="-2" width="4" height="4" fill="#8b5a2b" stroke="#f4ecd8" strokeWidth="0.5" />
                </g>
              );
            }

            return null;
          })}

          {/* Center Player Pointer (Always pointing straight UP) */}
          <g transform={`translate(${radius}, ${radius})`}>
            {/* Player field of view cone */}
            <path
              d="M 0 0 L -18 -42 L 18 -42 Z"
              fill={playerFaction === 'NORTH' ? '#4d94ff' : '#a0a0a0'}
              fillOpacity="0.15"
            />
            {/* Player chevron */}
            <polygon
              points="0,-6 5,5 0,2 -5,5"
              fill={playerFaction === 'NORTH' ? '#7ba4db' : '#d4af37'}
              stroke="#0a0806"
              strokeWidth="1.2"
            />
            <circle r="2" fill="#ffffff" />
          </g>
        </svg>

        {/* Dynamic Rotating Brass Compass Rose */}
        <div
          className="absolute inset-1 pointer-events-none transition-transform duration-75"
          style={{ transform: `rotate(${compassAngle}deg)` }}
        >
          {/* Ornate Compass Points */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 font-serif text-[9px] font-black text-[#ff4444] drop-shadow-sm">
            N
          </div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 font-serif text-[9px] font-bold text-[#d4af37]/80">
            S
          </div>
          <div className="absolute top-1/2 right-1 -translate-y-1/2 font-serif text-[9px] font-bold text-[#d4af37]/80">
            E
          </div>
          <div className="absolute top-1/2 left-1 -translate-y-1/2 font-serif text-[9px] font-bold text-[#d4af37]/80">
            W
          </div>

          {/* Subtle tick marks around rim */}
          <svg width={size - 8} height={size - 8} className="absolute inset-0">
            <line x1={(size - 8) / 2} y1={2} x2={(size - 8) / 2} y2={6} stroke="#ff4444" strokeWidth="1.5" />
            <line x1={(size - 8) / 2} y1={size - 14} x2={(size - 8) / 2} y2={size - 10} stroke="#d4af37" strokeWidth="1" />
            <line x1={2} y1={(size - 8) / 2} x2={6} y2={(size - 8) / 2} stroke="#d4af37" strokeWidth="1" />
            <line x1={size - 14} y1={(size - 8) / 2} x2={size - 10} y2={(size - 8) / 2} stroke="#d4af37" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Mini coordinates badge at bottom of compass */}
      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#0a0806]/95 border border-[#d4af37]/50 text-[8px] font-mono font-bold text-[#d4af37] tracking-wider uppercase shadow-md whitespace-nowrap">
        GETTYSBURG RADAR
      </div>
    </div>
  );
};
