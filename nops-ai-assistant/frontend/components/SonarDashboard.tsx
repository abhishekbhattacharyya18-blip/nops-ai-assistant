import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ReferenceArea, ReferenceDot, Area
} from 'recharts';
import { Activity, Thermometer, Radio, Crosshair, Send, Compass, Ear, Radar, Wind, Cloud, Clock, Waves, Maximize2, X, Target, Sun, Layers, Upload, Database, CheckCircle2, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { EnvironmentalParams, Point } from '../types';
import { generateSSP, generateTL, generateRayPaths } from '../utils/acoustics';
import { loadGebcoFile, getDepthAtLocation, getBathyProfile } from '../utils/gebco';
import { TacticalMap } from './TacticalMap';

interface SonarDashboardProps {
  onAnalyze: (summary: string) => void;
}

const SSPTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-navy-900/95 border border-navy-700 p-3 rounded-lg shadow-xl backdrop-blur-sm">
        <p className="text-slate-200 font-bold mb-2 border-b border-navy-700 pb-1">Depth: {data.depth} m</p>
        <p className="text-cyan-400 text-sm font-mono flex justify-between gap-4">
          <span>Sound Speed:</span> <span>{data.soundSpeed} m/s</span>
        </p>
        <p className="text-orange-400 text-sm font-mono flex justify-between gap-4">
          <span>Temperature:</span> <span>{data.temperature} °C</span>
        </p>
      </div>
    );
  }
  return null;
};

export const SonarDashboard: React.FC<SonarDashboardProps> = ({ onAnalyze }) => {
  const [sonarMode, setSonarMode] = useState<'passive' | 'active'>('passive');
  const [enlargedGraph, setEnlargedGraph] = useState<'ssp' | 'tl' | 'ray' | null>(null);
  
  // GEBCO State
  const [gebcoStatus, setGebcoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [gebcoFileName, setGebcoFileName] = useState<string | null>(null);
  const [bathyProfile, setBathyProfile] = useState<number[]>([]);
  
  const [params, setParams] = useState<EnvironmentalParams>({
    oceanDepth: 4000,
    surfaceTemp: 26,
    bottomTemp: 4,
    salinity: 35,
    windSpeed: 10,
    cloudCover: 20,
    timeOfDay: 14,
    afternoonEffect: false,
    mixedLayerDepth: 50,
    frequency: 5,
    sourceDepth: 25,
    receiverDepth: 150,
    sourceLevel: 210,
    targetSourceLevel: 140,
    noiseLevel: 60,
    directivityIndex: 20,
    detectionThreshold: 15,
    targetStrength: 10,
    bearing: 90,
    maxDisplayRange: 100,
    targetType: 'submarine',
    targetRange: 20,
    targetDepth: 150,
  });

  const [shipPosition, setShipPosition] = useState<Point>({ lat: 15.0, lng: 70.0 });

  // Handle GEBCO File Upload
  const handleGebcoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setGebcoStatus('loading');
    setGebcoFileName(file.name);
    
    const success = await loadGebcoFile(file);
    if (success) {
      setGebcoStatus('ready');
    } else {
      setGebcoStatus('error');
      setGebcoFileName(null);
    }
  };

  // Extract full bathymetry profile when position, bearing, or range changes
  useEffect(() => {
    const updateBathy = async () => {
      if (gebcoStatus === 'ready') {
        const profile = await getBathyProfile(shipPosition.lat, shipPosition.lng, params.bearing, params.maxDisplayRange);
        setBathyProfile(profile);
        if (profile.length > 0) {
          handleParamChange('oceanDepth', Math.round(profile[0]));
        }
      } else {
        setBathyProfile([]);
      }
    };
    updateBathy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipPosition, params.bearing, params.maxDisplayRange, gebcoStatus]);

  // Calculate max depth for plotting to ensure the sea floor is visible
  const maxPlotDepth = useMemo(() => {
    if (bathyProfile.length > 0) {
      return Math.max(...bathyProfile) + 200; // Add padding below the deepest point
    }
    return params.oceanDepth;
  }, [bathyProfile, params.oceanDepth]);

  const sspData = useMemo(() => generateSSP(params, maxPlotDepth), [params, maxPlotDepth]);
  const rayData = useMemo(() => generateRayPaths(params, sspData, bathyProfile), [params, sspData, bathyProfile]);
  const tlData = useMemo(() => generateTL(params, bathyProfile, rayData), [params, bathyProfile, rayData]);

  // Calculate estimated detection ranges (where Margin crosses 0 dB)
  const detectionRangePassiveNum = useMemo(() => {
    const point = tlData.find(d => d.marginPassive <= 0);
    return point ? point.range : params.maxDisplayRange;
  }, [tlData, params.maxDisplayRange]);

  const detectionRangeActiveNum = useMemo(() => {
    const point = tlData.find(d => d.marginActive <= 0);
    return point ? point.range : params.maxDisplayRange;
  }, [tlData, params.maxDisplayRange]);

  // Calculate exact SNR and Margin at the specific target range
  const targetData = useMemo(() => {
    const targetDataPoint = tlData.find(d => Math.abs(d.range - params.targetRange) < 0.1) || tlData[tlData.length - 1];
    return {
      snr: sonarMode === 'passive' ? targetDataPoint.snrPassive : targetDataPoint.snrActive,
      margin: sonarMode === 'passive' ? targetDataPoint.marginPassive : targetDataPoint.marginActive
    };
  }, [tlData, params.targetRange, sonarMode]);

  const isTargetDetected = targetData.margin >= 0;

  // Determine if target is in a shadow zone based on ray trace
  const isInShadowZone = useMemo(() => {
    const targetRayPoint = rayData.find(d => Math.abs(d.range - params.targetRange) < 0.1);
    let targetMinDist = Infinity;
    if (targetRayPoint) {
      Object.keys(targetRayPoint).forEach(key => {
        if (key.startsWith('ray_') && targetRayPoint[key] !== undefined) {
          const dist = Math.abs((targetRayPoint[key] as number) - params.targetDepth);
          if (dist < targetMinDist) targetMinDist = dist;
        }
      });
    }
    const targetAllowedGap = 50 + params.targetRange * 20; // 20m spread per km
    return targetMinDist > targetAllowedGap;
  }, [rayData, params.targetRange, params.targetDepth]);

  const isCrossLayer = (params.sourceDepth <= params.mixedLayerDepth && params.targetDepth > params.mixedLayerDepth) || 
                       (params.sourceDepth > params.mixedLayerDepth && params.targetDepth <= params.mixedLayerDepth);
  const isSurfaceDuct = params.sourceDepth <= params.mixedLayerDepth && params.targetDepth <= params.mixedLayerDepth && !params.afternoonEffect;

  const sofarAxis = useMemo(() => {
    if (sspData.length === 0) return null;
    return sspData.reduce((min, p) => p.soundSpeed < min.soundSpeed ? p : min, sspData[0]);
  }, [sspData]);

  // Determine Active Propagation Paths for summary
  const activePaths = useMemo(() => {
    const paths = ['Direct Path']; // Always present at short ranges
    const isShallow = params.oceanDepth <= 500;
    const inMixedLayer = params.sourceDepth <= params.mixedLayerDepth;
    const hasCZ = params.oceanDepth >= 3000 && sspData.length > 0 && sspData[sspData.length - 1].soundSpeed > sspData[0].soundSpeed;
    
    if (isShallow) {
      paths.push('Shallow Water Channel');
      paths.push('Bottom Bounce');
    } else {
      if (inMixedLayer && !params.afternoonEffect) {
        paths.push('Mixed Layer Channel (Surface Duct)');
      }
      if (sofarAxis && Math.abs(params.sourceDepth - sofarAxis.depth) < 400) {
        paths.push('Deep Sea Sound Channel (SOFAR)');
      }
      if (hasCZ) {
        paths.push('Convergence Zone');
      }
      if (params.afternoonEffect || (!inMixedLayer && !hasCZ)) {
        paths.push('Bottom Bounce');
      }
    }
    return Array.from(new Set(paths));
  }, [params.oceanDepth, params.sourceDepth, params.mixedLayerDepth, params.afternoonEffect, sofarAxis, sspData]);

  const handleParamChange = (key: keyof EnvironmentalParams, value: number | string | boolean) => {
    setParams(prev => {
      const newParams = { ...prev, [key]: value };
      // Ensure target range doesn't exceed max display range
      if (key === 'maxDisplayRange' && newParams.targetRange > (value as number)) {
        newParams.targetRange = value as number;
      }
      return newParams;
    });
  };

  const handleTargetTypeChange = (type: 'submarine' | 'surface_ship') => {
    setParams(prev => ({
      ...prev,
      targetType: type,
      targetDepth: type === 'submarine' ? 150 : 5,
      targetStrength: type === 'submarine' ? 10 : 20,
      targetSourceLevel: type === 'submarine' ? 140 : 160,
    }));
  };

  const handleTargetMapDrag = (range: number, bearing: number) => {
    setParams(prev => ({
      ...prev,
      targetRange: Math.min(Math.max(1, Math.round(range)), prev.maxDisplayRange),
      bearing: Math.round(bearing)
    }));
  };

  const handleSendToAI = () => {
    const activeRange = sonarMode === 'passive' ? detectionRangePassiveNum : detectionRangeActiveNum;
    const bathySource = gebcoStatus === 'ready' ? `Real-world GEBCO data (${gebcoFileName})` : 'Manual input';
    const summary = `I've updated the BELLHOP sonar prediction model with the following parameters:
- Mode: ${sonarMode.toUpperCase()}
- Environment: Ocean Depth ${params.oceanDepth}m (${bathySource}), ${params.surfaceTemp}°C Surface, MLD ${params.mixedLayerDepth}m, Afternoon Effect: ${params.afternoonEffect ? 'ON' : 'OFF'}
- Sonar: ${params.frequency} kHz, Source Depth ${params.sourceDepth}m, Active SL ${params.sourceLevel}dB, NL ${params.noiseLevel}dB, DI ${params.directivityIndex}dB, DT ${params.detectionThreshold}dB
- Target: ${params.targetType.replace('_', ' ').toUpperCase()} at ${params.targetRange}km range, ${params.targetDepth}m depth. Target SL ${params.targetSourceLevel}dB, TS ${params.targetStrength}dB.
- Active Propagation Paths: ${activePaths.join(', ')}

The model predicts an estimated ${sonarMode.toUpperCase()} max detection range of ${activeRange.toFixed(1)} km. 
At the target's specific location (${params.targetRange}km, ${params.targetDepth}m), the SNR is ${targetData.snr.toFixed(1)} dB (Threshold: ${params.detectionThreshold} dB), meaning it is ${isTargetDetected ? 'DETECTABLE' : 'UNDETECTABLE'}.
${isInShadowZone ? 'NOTE: The target is currently in an Acoustic Shadow Zone.' : ''}
${isCrossLayer ? 'NOTE: There is a Cross-Layer penalty due to the Mixed Layer Depth.' : ''}

Can you analyze these acoustic conditions, specifically focusing on the active propagation paths (${activePaths.join(', ')}), and suggest tactical ASW deployment strategies for this specific environment and target?`;
    
    onAnalyze(summary);
  };

  // 39 rays generated by the updated generateRayPaths function
  const rayKeys = Array.from({ length: 39 }, (_, i) => `ray_${i}`);

  // Generate ticks every 10km for the X-axis
  const rangeTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= params.maxDisplayRange; i += 10) {
      ticks.push(i);
    }
    return ticks;
  }, [params.maxDisplayRange]);

  // Chart Renderers
  const renderSSPChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={sspData} layout="vertical" margin={{ top: 25, right: 20, left: 0, bottom: 25 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={true} />
        <XAxis 
          xAxisId="speed" type="number" dataKey="soundSpeed" domain={['dataMin - 5', 'dataMax + 5']} 
          stroke="#22d3ee" tick={{fill: '#22d3ee', fontSize: 11}} 
          label={{ value: 'Sound Speed (m/s)', position: 'bottom', fill: '#22d3ee', fontSize: 12, offset: 10 }}
        />
        <XAxis 
          xAxisId="temp" type="number" dataKey="temperature" orientation="top" domain={[0, 'dataMax + 2']} 
          stroke="#f97316" tick={{fill: '#f97316', fontSize: 11}} 
          label={{ value: 'Temperature (°C)', position: 'top', fill: '#f97316', fontSize: 12, offset: 10 }}
        />
        <YAxis 
          type="number" dataKey="depth" reversed={true} domain={[0, maxPlotDepth]} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} 
          label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} 
        />
        <Tooltip content={<SSPTooltip />} />
        {sofarAxis && (
          <ReferenceLine 
            xAxisId="speed" y={sofarAxis.depth} stroke="#f59e0b" strokeDasharray="4 4" 
            label={{ value: `SOFAR Axis (${sofarAxis.depth}m)`, position: 'insideBottomRight', fill: '#f59e0b', fontSize: 11, offset: 10 }} 
          />
        )}
        <ReferenceLine 
          xAxisId="speed" y={params.mixedLayerDepth} stroke="#3b82f6" strokeDasharray="3 3" 
          label={{ value: `MLD (${params.mixedLayerDepth}m)`, position: 'insideTopRight', fill: '#3b82f6', fontSize: 11, offset: 10 }} 
        />
        <Line xAxisId="speed" type="monotone" dataKey="soundSpeed" name="Sound Speed" stroke="#22d3ee" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#020617', stroke: '#22d3ee', strokeWidth: 2 }} />
        <Line xAxisId="temp" type="monotone" dataKey="temperature" name="Temperature" stroke="#f97316" strokeWidth={2} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderTLChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={tlData} margin={{ top: 25, right: 20, left: 0, bottom: 25 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis 
          dataKey="range" type="number" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} 
          domain={[0, params.maxDisplayRange]}
          ticks={rangeTicks}
          label={{ value: 'Range (km)', position: 'bottom', fill: '#94a3b8', fontSize: 12, offset: 10 }} 
        />
        <YAxis 
          domain={['auto', 'auto']} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} 
          label={{ value: 'SNR (dB)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} 
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
          formatter={(value: number, name: string) => [`${value} dB`, name]}
          labelFormatter={(label) => `Range: ${label}km`}
        />
        <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '10px' }} />
        
        {/* Dynamic Detection Threshold Line */}
        <ReferenceLine 
          y={params.detectionThreshold} 
          stroke="#ef4444" 
          strokeDasharray="3 3" 
          label={{ value: `Detection Threshold (${params.detectionThreshold} dB)`, position: 'insideTopRight', fill: '#ef4444', fontSize: 11 }} 
        />
        
        {/* Target Position Line & Dot */}
        <ReferenceLine x={params.targetRange} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 11 }} />
        <ReferenceDot x={params.targetRange} y={targetData.snr} r={5} fill={isTargetDetected ? '#22c55e' : '#ef4444'} stroke="#fff" strokeWidth={2} />

        <Line 
          type="monotone" dataKey="snrPassive" name="Passive SNR" stroke="#3b82f6" 
          strokeWidth={sonarMode === 'passive' ? 3 : 1} strokeOpacity={sonarMode === 'passive' ? 1 : 0.3} dot={false} 
        />
        <Line 
          type="monotone" dataKey="snrActive" name="Active SNR" stroke="#ef4444" 
          strokeWidth={sonarMode === 'active' ? 3 : 1} strokeOpacity={sonarMode === 'active' ? 1 : 0.3} dot={false} 
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderRayChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rayData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis 
          dataKey="range" type="number" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} 
          domain={[0, params.maxDisplayRange]}
          ticks={rangeTicks}
          label={{ value: 'Range (km)', position: 'bottom', fill: '#94a3b8', fontSize: 12, offset: 0 }} 
        />
        <YAxis 
          reversed={true} domain={[0, maxPlotDepth]} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} 
          label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} 
        />

        {/* Mixed Layer Channel Highlight */}
        {activePaths.includes('Mixed Layer Channel (Surface Duct)') && (
          <ReferenceArea y1={0} y2={params.mixedLayerDepth} fill="rgba(59, 130, 246, 0.1)" strokeOpacity={0} />
        )}

        {/* Deep Sound Channel Highlight */}
        {activePaths.includes('Deep Sea Sound Channel (SOFAR)') && sofarAxis && (
          <ReferenceArea y1={Math.max(0, sofarAxis.depth - 200)} y2={Math.min(maxPlotDepth, sofarAxis.depth + 200)} fill="rgba(34, 197, 94, 0.05)" strokeOpacity={0} />
        )}
        
        {/* Source and Target Depth Lines */}
        <ReferenceLine y={params.sourceDepth} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Source', position: 'insideBottomLeft', fill: '#22c55e', fontSize: 10 }} />
        
        {/* Target Dot */}
        <ReferenceDot x={params.targetRange} y={params.targetDepth} r={6} fill={isTargetDetected ? "#22c55e" : "#ef4444"} stroke="#fff" strokeWidth={2} />
        <ReferenceLine x={params.targetRange} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />

        {/* Sea Floor (Bathymetry Profile) */}
        <Area type="stepAfter" dataKey="bottom" baseValue={8000} fill="#020617" stroke="#334155" strokeWidth={2} isAnimationActive={false} />

        {rayKeys.map((key) => (
          <Line key={key} type="monotone" dataKey={key} stroke="rgba(34, 211, 238, 0.4)" strokeWidth={1} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex flex-col gap-6 h-full relative">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 flex-none">
        <div className={`bg-navy-800/50 border p-4 rounded-xl transition-colors ${isTargetDetected ? 'border-green-500/50 bg-green-900/10' : 'border-red-500/50 bg-red-900/10'}`}>
          <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
            <Target size={14} className={isTargetDetected ? "text-green-400" : "text-red-400"} /> Target Status
          </div>
          <div className={`text-xl font-bold ${isTargetDetected ? "text-green-400" : "text-red-400"}`}>
            {isTargetDetected ? 'DETECTED' : 'UNDETECTED'}
            <div className="text-xs font-normal opacity-80 mt-0.5">Margin: {targetData.margin > 0 ? '+' : ''}{targetData.margin.toFixed(1)} dB</div>
          </div>
          <div className="text-[10px] font-mono mt-2 flex flex-col gap-0.5">
            {isInShadowZone && <span className="text-red-400">⚠ IN SHADOW ZONE</span>}
            {isCrossLayer && <span className="text-orange-400">⚠ CROSS-LAYER PENALTY</span>}
            {isSurfaceDuct && <span className="text-green-400">✓ SURFACE DUCT GAIN</span>}
          </div>
        </div>
        <div className={`bg-navy-800/50 border p-4 rounded-xl transition-colors ${sonarMode === 'passive' ? 'border-blue-500/50 bg-blue-900/10' : 'border-navy-700'}`}>
          <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
            <Ear size={14} className="text-blue-400" /> Max Passive Range
          </div>
          <div className="text-2xl font-bold text-blue-400">{detectionRangePassiveNum >= params.maxDisplayRange ? `> ${params.maxDisplayRange}` : detectionRangePassiveNum.toFixed(1)} <span className="text-sm text-slate-500 font-normal">km</span></div>
        </div>
        <div className={`bg-navy-800/50 border p-4 rounded-xl transition-colors ${sonarMode === 'active' ? 'border-red-500/50 bg-red-900/10' : 'border-navy-700'}`}>
          <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
            <Radar size={14} className="text-red-400" /> Max Active Range
          </div>
          <div className="text-2xl font-bold text-red-400">{detectionRangeActiveNum >= params.maxDisplayRange ? `> ${params.maxDisplayRange}` : detectionRangeActiveNum.toFixed(1)} <span className="text-sm text-slate-500 font-normal">km</span></div>
        </div>
        <div className="bg-navy-800/50 border border-navy-700 p-4 rounded-xl">
          <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
            <Thermometer size={14} className="text-orange-500" /> Surface Speed
          </div>
          <div className="text-2xl font-bold text-slate-200">{sspData[0]?.soundSpeed.toFixed(0)} <span className="text-sm text-slate-500 font-normal">m/s</span></div>
        </div>
        <div className="bg-navy-800/50 border border-navy-700 p-4 rounded-xl">
          <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
            <Radio size={14} className="text-purple-500" /> SOFAR Axis
          </div>
          <div className="text-2xl font-bold text-slate-200">
            {sofarAxis?.depth} <span className="text-sm text-slate-500 font-normal">m</span>
          </div>
        </div>
        <button 
          onClick={handleSendToAI}
          className="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 p-4 rounded-xl flex flex-col items-center justify-center transition-colors group"
        >
          <Send size={20} className="text-cyan-400 mb-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          <span className="text-sm font-medium text-cyan-300">Analyze with AI</span>
        </button>
      </div>

      {/* Middle Section: Map & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-none min-h-[450px]">
        {/* Tactical Map */}
        <div className="lg:col-span-2 h-[450px] lg:h-auto relative z-0">
          <TacticalMap 
            detectionRangePassive={detectionRangePassiveNum}
            detectionRangeActive={detectionRangeActiveNum}
            sonarMode={sonarMode}
            shipPosition={shipPosition} 
            bearing={params.bearing}
            targetRange={params.targetRange}
            targetType={params.targetType}
            onPositionChange={setShipPosition} 
            onTargetChange={handleTargetMapDrag}
          />
        </div>

        {/* Controls */}
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar h-[450px] lg:h-auto">
          
          {/* Location & Bathymetry Section */}
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-navy-700 pb-2">
              <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                <MapPin size={16} /> Location & Bathymetry
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Source Latitude</label>
                <input type="number" step="0.01" value={shipPosition.lat.toFixed(4)} onChange={(e) => setShipPosition(p => ({...p, lat: parseFloat(e.target.value)}))} className="bg-navy-950 text-cyan-400 text-xs p-1.5 rounded border border-navy-700 outline-none focus:border-cyan-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Source Longitude</label>
                <input type="number" step="0.01" value={shipPosition.lng.toFixed(4)} onChange={(e) => setShipPosition(p => ({...p, lng: parseFloat(e.target.value)}))} className="bg-navy-950 text-cyan-400 text-xs p-1.5 rounded border border-navy-700 outline-none focus:border-cyan-500" />
              </div>
            </div>

            {/* GEBCO Upload */}
            <div className="flex items-center justify-between bg-navy-800/50 p-2 rounded-lg border border-navy-700 mb-4">
              <div className="flex items-center gap-2">
                {gebcoStatus === 'loading' ? (
                  <Loader2 size={14} className="text-cyan-400 animate-spin" />
                ) : gebcoStatus === 'ready' ? (
                  <CheckCircle2 size={14} className="text-green-400" />
                ) : gebcoStatus === 'error' ? (
                  <AlertCircle size={14} className="text-red-400" />
                ) : (
                  <Database size={14} className="text-slate-400" />
                )}
                <span className="text-xs text-slate-300 font-medium truncate max-w-[120px]">
                  {gebcoStatus === 'ready' ? gebcoFileName : 'GEBCO Bathymetry'}
                </span>
              </div>
              <label className={`px-3 py-1 text-white text-[10px] font-bold rounded cursor-pointer transition-colors ${gebcoStatus === 'loading' ? 'bg-slate-600 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500'}`}>
                {gebcoStatus === 'loading' ? 'LOADING...' : gebcoStatus === 'ready' ? 'UPDATE .TIF' : 'LOAD .TIF'}
                <input type="file" accept=".tif,.tiff" className="hidden" onChange={handleGebcoUpload} disabled={gebcoStatus === 'loading'} />
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-400">Ocean Depth (m) {gebcoStatus === 'ready' && <span className="text-green-400">(Auto from GEBCO)</span>}</label>
                <span className="text-[10px] text-cyan-400 font-mono">{params.oceanDepth}</span>
              </div>
              <input type="range" min="100" max="8000" step="100" value={params.oceanDepth} onChange={(e) => handleParamChange('oceanDepth', parseFloat(e.target.value))} className="w-full" disabled={gebcoStatus === 'ready'} />
            </div>
          </div>

          {/* Target Parameters Section */}
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-navy-700 pb-2">
              <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                <Target size={16} /> Target Parameters
              </h3>
              <div className="flex bg-navy-800 rounded-lg p-0.5 border border-navy-700">
                <button
                  onClick={() => handleTargetTypeChange('submarine')}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${params.targetType === 'submarine' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Submarine
                </button>
                <button
                  onClick={() => handleTargetTypeChange('surface_ship')}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${params.targetType === 'surface_ship' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Surface Ship
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Range (km)</label><span className="text-[10px] text-orange-400 font-mono">{params.targetRange}</span></div>
                <input type="range" min="1" max={params.maxDisplayRange} step="1" value={params.targetRange} onChange={(e) => handleParamChange('targetRange', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Depth (m)</label><span className="text-[10px] text-orange-400 font-mono">{params.targetDepth}</span></div>
                <input 
                  type="range" 
                  min="0" 
                  max={params.targetType === 'surface_ship' ? 15 : params.oceanDepth} 
                  step={params.targetType === 'surface_ship' ? 1 : 5} 
                  value={params.targetDepth} 
                  onChange={(e) => handleParamChange('targetDepth', parseFloat(e.target.value))} 
                  className="w-full" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Target SL (dB)</label><span className="text-[10px] text-orange-400 font-mono">{params.targetSourceLevel}</span></div>
                <input type="range" min="90" max="180" step="1" value={params.targetSourceLevel} onChange={(e) => handleParamChange('targetSourceLevel', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Target TS (dB)</label><span className="text-[10px] text-orange-400 font-mono">{params.targetStrength}</span></div>
                <input type="range" min="-20" max="30" step="1" value={params.targetStrength} onChange={(e) => handleParamChange('targetStrength', parseFloat(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>

          {/* Sonar Parameters Section */}
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-navy-700 pb-2">
              <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <Crosshair size={16} /> Sonar Parameters
              </h3>
              <div className="flex bg-navy-800 rounded-lg p-0.5 border border-navy-700">
                <button
                  onClick={() => setSonarMode('passive')}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${sonarMode === 'passive' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Passive
                </button>
                <button
                  onClick={() => setSonarMode('active')}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${sonarMode === 'active' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Active
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Freq (kHz)</label><span className="text-[10px] text-emerald-400 font-mono">{params.frequency}</span></div>
                <input type="range" min="1" max="50" step="1" value={params.frequency} onChange={(e) => handleParamChange('frequency', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Source Depth (m)</label><span className="text-[10px] text-emerald-400 font-mono">{params.sourceDepth}</span></div>
                <input type="range" min="5" max={params.oceanDepth} step="5" value={params.sourceDepth} onChange={(e) => handleParamChange('sourceDepth', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Active SL (dB)</label><span className="text-[10px] text-emerald-400 font-mono">{params.sourceLevel}</span></div>
                <input type="range" min="100" max="250" step="1" value={params.sourceLevel} onChange={(e) => handleParamChange('sourceLevel', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">NL (dB)</label><span className="text-[10px] text-emerald-400 font-mono">{params.noiseLevel}</span></div>
                <input type="range" min="40" max="100" step="1" value={params.noiseLevel} onChange={(e) => handleParamChange('noiseLevel', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">DI (dB)</label><span className="text-[10px] text-emerald-400 font-mono">{params.directivityIndex}</span></div>
                <input type="range" min="0" max="40" step="1" value={params.directivityIndex} onChange={(e) => handleParamChange('directivityIndex', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">DT (dB)</label><span className="text-[10px] text-emerald-400 font-mono">{params.detectionThreshold}</span></div>
                <input type="range" min="0" max="30" step="1" value={params.detectionThreshold} onChange={(e) => handleParamChange('detectionThreshold', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400 flex items-center gap-1"><Compass size={12}/> Bearing (°)</label><span className="text-[10px] text-emerald-400 font-mono">{params.bearing.toString().padStart(3, '0')}</span></div>
                <input type="range" min="0" max="359" step="1" value={params.bearing} onChange={(e) => handleParamChange('bearing', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Max Plot Range (km)</label><span className="text-[10px] text-emerald-400 font-mono">{params.maxDisplayRange}</span></div>
                <input type="range" min="10" max="300" step="10" value={params.maxDisplayRange} onChange={(e) => handleParamChange('maxDisplayRange', parseFloat(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>

          {/* Ocean Environment Section */}
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-navy-700 pb-2">
              <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                <Waves size={16} /> Ocean Environment
              </h3>
              <button
                onClick={() => handleParamChange('afternoonEffect', !params.afternoonEffect)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${params.afternoonEffect ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-navy-800 text-slate-400 border border-navy-700'}`}
                title="Toggle Afternoon Effect (Surface Heating)"
              >
                <Sun size={12} /> Afternoon Effect
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">MLD (m)</label><span className="text-[10px] text-cyan-400 font-mono">{params.mixedLayerDepth}</span></div>
                <input type="range" min="10" max="300" step="5" value={params.mixedLayerDepth} onChange={(e) => handleParamChange('mixedLayerDepth', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Surf Temp (°C)</label><span className="text-[10px] text-cyan-400 font-mono">{params.surfaceTemp}</span></div>
                <input type="range" min="10" max="35" step="0.5" value={params.surfaceTemp} onChange={(e) => handleParamChange('surfaceTemp', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Bot Temp (°C)</label><span className="text-[10px] text-cyan-400 font-mono">{params.bottomTemp}</span></div>
                <input type="range" min="0" max="15" step="0.5" value={params.bottomTemp} onChange={(e) => handleParamChange('bottomTemp', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Salinity (PSU)</label><span className="text-[10px] text-cyan-400 font-mono">{params.salinity}</span></div>
                <input type="range" min="30" max="40" step="0.1" value={params.salinity} onChange={(e) => handleParamChange('salinity', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Wind (m/s)</label><span className="text-[10px] text-cyan-400 font-mono">{params.windSpeed}</span></div>
                <input type="range" min="0" max="30" step="1" value={params.windSpeed} onChange={(e) => handleParamChange('windSpeed', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Clouds (%)</label><span className="text-[10px] text-cyan-400 font-mono">{params.cloudCover}</span></div>
                <input type="range" min="0" max="100" step="5" value={params.cloudCover} onChange={(e) => handleParamChange('cloudCover', parseFloat(e.target.value))} className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400">Time (Hr)</label><span className="text-[10px] text-cyan-400 font-mono">{params.timeOfDay}:00</span></div>
                <input type="range" min="0" max="23" step="1" value={params.timeOfDay} onChange={(e) => handleParamChange('timeOfDay', parseFloat(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Section: Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[300px]">
        {/* Sound Speed vs Depth Chart (Dual Axis) */}
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 flex flex-col relative group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Activity size={16} className="text-cyan-500" /> Sound Speed & Temperature vs Depth
            </h3>
            <button onClick={() => setEnlargedGraph('ssp')} className="text-slate-500 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100">
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
            {renderSSPChart()}
          </div>
        </div>

        {/* Detection Margin Chart */}
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 flex flex-col relative group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Radio size={16} className="text-purple-500" /> Signal-to-Noise Ratio (SNR)
            </h3>
            <button onClick={() => setEnlargedGraph('tl')} className="text-slate-500 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100">
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
            {renderTLChart()}
          </div>
        </div>
      </div>

      {/* Ray Tracing Chart */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 flex flex-col flex-none min-h-[350px] relative group">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Layers size={16} className="text-cyan-500" /> Acoustic Ray Trace (Propagation Paths)
          </h3>
          <button onClick={() => setEnlargedGraph('ray')} className="text-slate-500 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100">
            <Maximize2 size={16} />
          </button>
        </div>
        
        {/* Active Paths Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {activePaths.map(path => (
            <span key={path} className="px-2 py-1 bg-cyan-900/30 border border-cyan-700/50 text-cyan-300 text-[10px] rounded-md font-mono">
              {path}
            </span>
          ))}
        </div>

        <div className="flex-1 w-full min-h-[300px]">
          {renderRayChart()}
        </div>
      </div>

      {/* Enlarged Graph Modal */}
      {enlargedGraph && (
        <div className="fixed inset-0 z-[9999] bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-navy-800">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                {enlargedGraph === 'ssp' && <><Activity className="text-cyan-500" /> Sound Speed & Temperature vs Depth</>}
                {enlargedGraph === 'tl' && <><Radio className="text-purple-500" /> Signal-to-Noise Ratio (SNR)</>}
                {enlargedGraph === 'ray' && <><Layers className="text-cyan-500" /> Acoustic Ray Trace (Propagation Paths)</>}
              </h2>
              <button 
                onClick={() => setEnlargedGraph(null)}
                className="p-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-6 w-full h-full">
              {enlargedGraph === 'ssp' && renderSSPChart()}
              {enlargedGraph === 'tl' && renderTLChart()}
              {enlargedGraph === 'ray' && renderRayChart()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
