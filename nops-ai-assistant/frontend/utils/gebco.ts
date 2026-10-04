/**
 * Mocks loading a GEBCO GeoTIFF file into memory.
 */
export const loadGebcoFile = async (file: File): Promise<boolean> => {
  try {
    console.log(`Attempting to load GEBCO file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("GEBCO file loaded successfully (Mocked).");
    return true;
  } catch (error) {
    console.error("Error loading GEBCO file.", error);
    return false;
  }
};

/**
 * Mocks extracting the depth (elevation) at a specific latitude and longitude.
 * Returns positive depth in meters.
 */
export const getDepthAtLocation = async (lat: number, lng: number): Promise<number | null> => {
  // Generate a synthetic bathymetry based on lat/lng to simulate real terrain
  const baseDepth = 3500;
  
  // Create some "seamounts" and "trenches" using sine waves
  const variation1 = Math.sin(lat * 15) * Math.cos(lng * 15) * 1500;
  const variation2 = Math.sin(lat * 5) * Math.cos(lng * 8) * 1000;
  
  let depth = baseDepth + variation1 + variation2;
  
  // Ensure depth doesn't go above sea level (keep it at least 10m deep)
  return Math.max(10, depth);
};

/**
 * Extracts a 2D bathymetry profile along a specific bearing line.
 */
export const getBathyProfile = async (startLat: number, startLng: number, bearing: number, maxRangeKm: number, stepKm: number = 1): Promise<number[]> => {
  const profile: number[] = [];
  for (let r = 0; r <= maxRangeKm; r += stepKm) {
    // 1 degree of latitude is ~111.32 km
    const rangeInDegreesLat = r / 111.32;
    const rangeInDegreesLng = r / (111.32 * Math.cos(startLat * (Math.PI / 180)));
    
    // Convert bearing to standard math angle (0 is North, 90 is East)
    const mathAngle = (90 - bearing) * (Math.PI / 180);
    
    const lat = startLat + rangeInDegreesLat * Math.sin(mathAngle);
    const lng = startLng + rangeInDegreesLng * Math.cos(mathAngle);
    
    const depth = await getDepthAtLocation(lat, lng);
    
    if (depth !== null) {
      profile.push(depth);
    } else {
      profile.push(profile.length > 0 ? profile[profile.length - 1] : 4000);
    }
  }
  return profile;
};
