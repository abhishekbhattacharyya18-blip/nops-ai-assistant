export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface EnvironmentalParams {
  // Ocean Environment
  oceanDepth: number; // m
  surfaceTemp: number; // °C
  bottomTemp: number; // °C
  salinity: number; // PSU
  windSpeed: number; // m/s
  cloudCover: number; // %
  timeOfDay: number; // 0-23 hours
  afternoonEffect: boolean; // Toggle for strong surface heating
  mixedLayerDepth: number; // MLD in meters

  // Sonar Parameters
  frequency: number; // kHz
  sourceDepth: number; // m
  receiverDepth: number; // m
  sourceLevel: number; // Active SL (dB)
  targetSourceLevel: number; // Passive Target SL (dB)
  noiseLevel: number; // NL (dB)
  directivityIndex: number; // DI (dB)
  detectionThreshold: number; // DT (dB)
  targetStrength: number; // TS (dB)
  bearing: number; // degrees (0-359)
  maxDisplayRange: number; // km (Controls the X-axis scale for plots)

  // Target Parameters
  targetType: 'submarine' | 'surface_ship';
  targetRange: number; // km
  targetDepth: number; // m (Depth of the contact: 0-10m for surface, >50m for sub-surface)
}

export interface SSPDataPoint {
  depth: number;
  soundSpeed: number;
  temperature: number;
}

export interface TLDataPoint {
  range: number;
  loss: number; // 1-way Transmission Loss
  snrPassive: number; // Signal-to-Noise Ratio (Passive)
  snrActive: number; // Signal-to-Noise Ratio (Active)
  marginPassive: number; // Signal Excess (Passive)
  marginActive: number; // Signal Excess (Active)
}

export interface RayDataPoint {
  range: number;
  bottom?: number; // Depth of the sea floor at this range
  [key: string]: number | undefined; // Dynamic keys for each ray (e.g., ray_0, ray_1)
}

export interface Point {
  lat: number;
  lng: number;
}