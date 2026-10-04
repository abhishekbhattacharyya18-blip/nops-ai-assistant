import { EnvironmentalParams, SSPDataPoint, TLDataPoint, RayDataPoint } from '../types';

/**
 * Calculates sound speed using the corrected Medwin equation.
 * c = 1449.2 + 4.6T - 0.055T² + 0.00029T³ + (1.34 - 0.01T)(S - 35) + 0.016D
 * This yields realistic values around 1450 - 1550 m/s.
 */
export const calculateSoundSpeed = (T: number, S: number, D: number): number => {
  return 1449.2 + 4.6 * T - 0.055 * Math.pow(T, 2) + 0.00029 * Math.pow(T, 3) +
         (1.34 - 0.01 * T) * (S - 35) + 0.016 * D;
};

/**
 * Generates a simulated Sound Speed Profile (SSP) based on surface/bottom temps.
 * Properly models the Mixed Layer Depth (MLD) as an isothermal layer, which 
 * creates a positive sound speed gradient due to pressure, resulting in a surface duct.
 */
export const generateSSP = (params: EnvironmentalParams, maxPlotDepth: number = 4000): SSPDataPoint[] => {
  const data: SSPDataPoint[] = [];
  const maxDepth = Math.max(params.oceanDepth, maxPlotDepth); 
  const mixedLayerDepth = params.mixedLayerDepth; 

  // Diurnal Warming Calculation (Afternoon Effect)
  let surfaceWarming = 0;
  if (params.afternoonEffect) {
    surfaceWarming = 3.0; // Strong artificial spike for demonstration
  } else {
    const daylight = (params.timeOfDay >= 6 && params.timeOfDay <= 18) 
      ? Math.sin(Math.PI * (params.timeOfDay - 6) / 12) 
      : 0;
    const cloudFactor = 1 - (params.cloudCover / 100);
    const mixingFactor = Math.max(0, 1 - (params.windSpeed / 30));
    surfaceWarming = 2.0 * daylight * cloudFactor * mixingFactor;
  }

  // Ensure we calculate exactly at critical depths to capture sharp gradient changes
  const depthsSet = new Set<number>();
  for (let d = 0; d <= maxDepth; d += 20) depthsSet.add(d);
  depthsSet.add(20); // Afternoon effect boundary
  depthsSet.add(mixedLayerDepth);
  depthsSet.add(maxDepth);
  
  const sortedDepths = Array.from(depthsSet).sort((a, b) => a - b);

  for (const d of sortedDepths) {
    let temp;
    if (d <= mixedLayerDepth) {
      // Isothermal mixed layer base
      temp = params.surfaceTemp;
      // Apply afternoon effect spike in the top 20 meters (creates negative gradient / shadow zone)
      if (d <= 20) {
         temp += surfaceWarming * (1 - d / 20);
      }
    } else {
      // Thermocline: temperature drops exponentially with depth below MLD
      temp = params.bottomTemp + (params.surfaceTemp - params.bottomTemp) * Math.exp(-(d - mixedLayerDepth) / 300);
    }
    
    const speed = calculateSoundSpeed(temp, params.salinity, d);
    data.push({ depth: d, soundSpeed: Number(speed.toFixed(2)), temperature: Number(temp.toFixed(2)) });
  }
  
  return data;
};

/**
 * Generates simulated Transmission Loss (TL) and calculates SNR and Detection Margins
 * using the full Sonar Equations for both Passive and Active modes.
 */
export const generateTL = (params: EnvironmentalParams, bathyProfile: number[] = [], rayData: RayDataPoint[] = []): TLDataPoint[] => {
  const data: TLDataPoint[] = [];
  const maxRangeKm = params.maxDisplayRange || 100; 
  const stepKm = 1;
  
  const f = params.frequency;
  // Thorp's formula for absorption coefficient alpha (dB/km)
  const alpha = (0.11 * f * f) / (1 + f * f) + (44 * f * f) / (4100 + f * f) + 2.75e-4 * f * f;

  // Passive FOM uses the Target's Source Level
  const fomPassive = params.targetSourceLevel - (params.noiseLevel - params.directivityIndex) - params.detectionThreshold;
  // Active FOM uses the Sonar's Source Level + Target Strength
  const fomActive = params.sourceLevel + params.targetStrength - (params.noiseLevel - params.directivityIndex) - params.detectionThreshold;

  // Layer penalty logic
  let layerPenalty = 0;
  const mixedLayer = params.mixedLayerDepth;
  if (params.sourceDepth <= mixedLayer && params.targetDepth <= mixedLayer) {
    layerPenalty = -5; // Surface duct advantage
  } else if ((params.sourceDepth <= mixedLayer && params.targetDepth > mixedLayer) || 
             (params.sourceDepth > mixedLayer && params.targetDepth <= mixedLayer)) {
    layerPenalty = 15; // Strong cross-layer penalty
  }

  for (let r = 1; r <= maxRangeKm; r += stepKm) {
    const r_m = r * 1000;
    // Practical spreading: 15 log10(r)
    const spreading = 15 * Math.log10(r_m);
    const absorption = alpha * r;
    
    // Calculate ray density penalty/gain based on actual ray trace data
    let rayPenalty = 0;
    if (rayData.length > 0) {
      const rayPoint = rayData.find(d => Math.abs(d.range - r) < 0.1);
      if (rayPoint) {
        let minDist = Infinity;
        // Check vertical distance from target depth to all rays at this range
        Object.keys(rayPoint).forEach(key => {
          if (key.startsWith('ray_') && rayPoint[key] !== undefined) {
            const dist = Math.abs((rayPoint[key] as number) - params.targetDepth);
            if (dist < minDist) minDist = dist;
          }
        });

        // Allowed gap scales with range due to natural ray divergence
        const allowedGap = 50 + r * 20; 
        
        if (minDist > allowedGap) {
          // Target is in a shadow zone (no rays nearby)
          const shadowDepth = minDist - allowedGap;
          rayPenalty = Math.min(60, shadowDepth * 0.5);
        } else {
          // Inside the bundle. Check for convergence (high density)
          const densityBonus = Math.max(0, (allowedGap * 0.2 - minDist) * 0.1);
          rayPenalty = -Math.min(10, densityBonus);
        }
      }
    }

    const tl = spreading + absorption + layerPenalty + rayPenalty;
    
    // Calculate Signal-to-Noise Ratio (SNR)
    const snrPassive = params.targetSourceLevel - tl - (params.noiseLevel - params.directivityIndex);
    const snrActive = params.sourceLevel - (2 * tl) + params.targetStrength - (params.noiseLevel - params.directivityIndex);
    
    // Calculate Margin (Signal Excess) = SNR - DT
    const marginPassive = snrPassive - params.detectionThreshold;
    const marginActive = snrActive - params.detectionThreshold; 
    
    data.push({ 
      range: r, 
      loss: Number(tl.toFixed(2)),
      snrPassive: Number(snrPassive.toFixed(2)),
      snrActive: Number(snrActive.toFixed(2)),
      marginPassive: Number(marginPassive.toFixed(2)),
      marginActive: Number(marginActive.toFixed(2))
    });
  }
  return data;
};

/**
 * Simulates acoustic ray tracing using Snell's law and a simplified Euler integration.
 */
export const generateRayPaths = (params: EnvironmentalParams, ssp: SSPDataPoint[], bathyProfile: number[] = []): RayDataPoint[] => {
  const maxRangeKm = params.maxDisplayRange || 100;
  const maxRange = maxRangeKm * 1000; // in meters
  const ds = 10; // 10m integration steps for high accuracy in shallow ducts

  // Helper to get bottom depth at a specific range
  const getBottomDepth = (r_meters: number) => {
    if (!bathyProfile || bathyProfile.length === 0) return params.oceanDepth;
    const r_km = r_meters / 1000;
    const idx = Math.floor(r_km);
    if (idx >= bathyProfile.length - 1) return bathyProfile[bathyProfile.length - 1];
    const remainder = r_km - idx;
    return bathyProfile[idx] * (1 - remainder) + bathyProfile[idx + 1] * remainder;
  };

  // Helper to get sound speed (c) and gradient (g) at a specific depth
  const getSSP = (z: number, currentMaxDepth: number) => {
    if (z <= 0) return { c: ssp[0].soundSpeed, g: (ssp[1].soundSpeed - ssp[0].soundSpeed) / (ssp[1].depth - ssp[0].depth) };
    if (z >= currentMaxDepth) {
      const last = ssp[ssp.length - 1];
      const prev = ssp[ssp.length - 2];
      return { c: last.soundSpeed, g: (last.soundSpeed - prev.soundSpeed) / (last.depth - prev.depth) };
    }
    
    let idx = ssp.findIndex(p => p.depth > z);
    if (idx === -1) idx = ssp.length - 1;
    if (idx === 0) idx = 1;
    
    const p1 = ssp[idx - 1];
    const p2 = ssp[idx];
    const g = (p2.soundSpeed - p1.soundSpeed) / (p2.depth - p1.depth);
    const c = p1.soundSpeed + g * (z - p1.depth);
    return { c, g };
  };

  // Launch angles: Finer resolution near horizontal to catch surface ducts
  const angles: number[] = [];
  for (let i = -15; i <= 15; i++) {
    if (i >= -4 && i <= 4) {
      angles.push(i);
      if (i !== 4) angles.push(i + 0.5);
    } else {
      angles.push(i);
    }
  }
  
  // Initialize grid for Recharts (0 to maxRangeKm)
  const rangeGrid = Array.from({ length: maxRangeKm + 1 }, (_, i) => i);
  const rayData: RayDataPoint[] = rangeGrid.map(r => ({ 
    range: r,
    bottom: getBottomDepth(r * 1000)
  }));

  angles.forEach((angleDeg, index) => {
    let r = 0;
    let z = params.sourceDepth;
    let theta = angleDeg * Math.PI / 180;
    
    let currentGridIdx = 0;
    rayData[currentGridIdx][`ray_${index}`] = z;
    currentGridIdx++;

    while (r < maxRange && currentGridIdx <= maxRangeKm) {
      const currentBottom = getBottomDepth(r);
      const { c, g } = getSSP(z, currentBottom);
      
      const dr = ds * Math.cos(theta);
      r += dr;
      z += ds * Math.sin(theta);
      
      // Update angle based on sound speed gradient (Snell's Law paraxial approx)
      theta += (-g / c) * Math.cos(theta) * ds;

      // Surface reflection
      if (z <= 0) { 
        z = -z; 
        theta = -theta; 
      }
      // Bottom reflection
      if (z >= currentBottom) { 
        z = currentBottom - (z - currentBottom); 
        theta = -theta; 
      }

      // Record depth at each 1km grid boundary
      while (currentGridIdx <= maxRangeKm && r >= currentGridIdx * 1000) {
        rayData[currentGridIdx][`ray_${index}`] = Number(z.toFixed(1));
        currentGridIdx++;
      }
    }
  });

  return rayData;
};
