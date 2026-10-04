import React, { useRef } from 'react';
import { Point } from '../types';
import { Crosshair } from 'lucide-react';

interface TacticalMapProps {
  detectionRangePassive: number;
  detectionRangeActive: number;
  sonarMode: 'passive' | 'active';
  shipPosition: Point;
  bearing: number;
  targetRange: number;
  targetType: 'submarine' | 'surface_ship';
  onPositionChange: (pos: Point) => void;
  onTargetChange: (range: number, bearing: number) => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({ 
  detectionRangePassive,
  detectionRangeActive,
  sonarMode,
  shipPosition, 
  bearing, 
  targetRange,
  targetType,
  onPositionChange,
  onTargetChange
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const activeRange = sonarMode === 'passive' ? detectionRangePassive : detectionRangeActive;

  // SVG Map Dimensions
  const mapWidth = 800;
  const mapHeight = 500;
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;
  
  // Scale: 1 km = 2 pixels (allows showing up to 200km range comfortably)
  const scale = 2;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    // Calculate click position relative to SVG viewBox
    const scaleX = mapWidth / rect.width;
    const scaleY = mapHeight / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const dx = x - centerX;
    const dy = y - centerY;
    
    const rangeKm = Math.sqrt(dx*dx + dy*dy) / scale;
    let newBearing = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (newBearing < 0) newBearing += 360;
    
    onTargetChange(rangeKm, newBearing);
  };

  const targetX = centerX + (targetRange * scale) * Math.sin(bearing * Math.PI / 180);
  const targetY = centerY - (targetRange * scale) * Math.cos(bearing * Math.PI / 180);

  // Detection Zones (100%, 50%, 25% certainty)
  const zone25 = activeRange; // Low confidence
  const zone50 = activeRange * 0.7; // Medium confidence
  const zone100 = activeRange * 0.4; // High confidence

  return (
    <div className="w-full h-full bg-navy-950 border border-navy-800 rounded-xl overflow-hidden relative flex flex-col">
      {/* Tactical Overlays */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none bg-navy-900/90 p-3 rounded-lg border border-navy-700 backdrop-blur-md shadow-lg">
        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2 tracking-wider">
          <Crosshair size={16} /> LOCAL TACTICAL PLOT
        </h3>
        <p className="text-[10px] text-slate-400 font-mono mt-1">
          MODE: <span className={sonarMode === 'passive' ? 'text-blue-400' : 'text-red-400'}>{sonarMode.toUpperCase()}</span>
        </p>
        <p className="text-[10px] text-slate-500 font-mono mt-1">CLICK MAP TO MOVE TARGET</p>
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span><span className="text-[9px] text-slate-300">100% CERTAINTY</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span><span className="text-[9px] text-slate-300">50% CERTAINTY</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-[9px] text-slate-300">25% CERTAINTY</span></div>
        </div>
      </div>
      
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none text-right bg-navy-900/90 p-3 rounded-lg border border-navy-700 backdrop-blur-md shadow-lg">
        <p className="text-xs text-cyan-500 font-mono">LAT: {shipPosition.lat.toFixed(4)}°</p>
        <p className="text-xs text-cyan-500 font-mono">LON: {shipPosition.lng.toFixed(4)}°</p>
        <div className="h-px w-full bg-navy-700 my-1.5"></div>
        <p className={`text-[10px] font-mono font-bold ${sonarMode === 'passive' ? 'text-blue-400' : 'text-red-400'}`}>
          {sonarMode.toUpperCase()} RANGE: {activeRange.toFixed(1)} KM
        </p>
        <p className="text-[10px] text-orange-400 font-mono font-bold mt-1">TARGET: {targetRange.toFixed(1)} KM</p>
        <p className="text-[10px] text-slate-400 font-mono mt-1">BEARING: {bearing.toString().padStart(3, '0')}°</p>
      </div>

      {/* SVG Tactical Map */}
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        className="w-full h-full cursor-crosshair bg-navy-950"
        onClick={handleSvgClick}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1"/>
          </pattern>
          <pattern id="grid-large" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="#334155" strokeWidth="1"/>
          </pattern>
        </defs>
        
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#grid-large)" />
        
        {/* Range Rings */}
        <circle cx={centerX} cy={centerY} r={zone25 * scale} fill="rgba(239, 68, 68, 0.05)" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx={centerX} cy={centerY} r={zone50 * scale} fill="rgba(249, 115, 22, 0.05)" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 6" />
        <circle cx={centerX} cy={centerY} r={zone100 * scale} fill="rgba(34, 197, 94, 0.1)" stroke="#22c55e" strokeWidth="2" />

        {/* Bearing Line */}
        <line x1={centerX} y1={centerY} x2={targetX} y2={targetY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

        {/* Ship/Sensor */}
        <circle cx={centerX} cy={centerY} r="4" fill="#fff" />
        <circle cx={centerX} cy={centerY} r="12" fill="none" stroke={sonarMode === 'passive' ? '#3b82f6' : '#ef4444'} strokeWidth="2" className="animate-ping-slow" />

        {/* Target */}
        <g transform={`translate(${targetX}, ${targetY})`}>
          <circle cx="0" cy="0" r="8" fill="rgba(245, 158, 11, 0.3)" stroke="#f59e0b" strokeWidth="2" />
          <circle cx="0" cy="0" r="2" fill="#f59e0b" />
          {targetType === 'surface_ship' && (
            <rect x="-6" y="-2" width="12" height="4" fill="#f59e0b" />
          )}
        </g>
      </svg>
    </div>
  );
};
