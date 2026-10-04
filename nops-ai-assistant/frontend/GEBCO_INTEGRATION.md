# GEBCO Bathymetry Integration in NOPS

The Naval Oceanography Prediction System (NOPS) utilizes GEBCO (General Bathymetric Chart of the Oceans) `.tif` files to provide real-world, dynamic sea-floor topography for acoustic modeling. Here is exactly how the software processes and utilizes this data based on the codebase:

## 1. In-Browser Parsing (`utils/gebco.ts`)
When you upload a `.tif` file via the dashboard, the software uses the `geotiff` JavaScript library to parse the file entirely locally within your browser. No data is sent to a server. It extracts the raw image data and the geographic bounding box (minimum and maximum Latitude and Longitude).

## 2. Coordinate Translation
When you click on the Tactical Map to set the ship's position, the software translates those geographic coordinates (Lat/Lng) into specific pixel coordinates (X/Y) on the loaded GeoTIFF image using linear interpolation against the bounding box.

## 3. Depth Extraction
It reads the elevation value of the specific pixel. In GEBCO data, negative values represent ocean depth (bathymetry), and positive values represent land elevation. The software converts these negative values into positive depth in meters (`getDepthAtLocation`). If a point is on land (positive elevation), it defaults to a shallow 10m depth to prevent the acoustic model from crashing.

## 4. 2D Bathymetry Profiling
Based on your ship's position, the chosen **Bearing**, and the **Max Plot Range**, the software calculates a 2D transect line across the globe. It samples the GEBCO data at 1km intervals along this line using trigonometric projections to build a complete 2D profile of the ocean floor (`getBathyProfile`).

## 5. Dynamic Acoustic Ray Tracing (`utils/acoustics.ts`)
This is where the data directly impacts the physics model:
*   **Standard Model:** Without GEBCO, acoustic rays bounce off a flat, uniform bottom defined by a single `oceanDepth` parameter.
*   **GEBCO Model:** The `generateRayPaths` function continuously checks the ray's current range and depth against the dynamic bathymetry profile (`getBottomDepth(r)`). 
*   **Terrain Reflection:** If an acoustic ray hits a seamount, trench, or continental shelf, it reflects off that specific terrain feature. This accurately models how underwater mountains can block Convergence Zones (CZ) or how continental slopes can alter Bottom Bounce propagation paths.

## 6. Visualization (`components/SonarDashboard.tsx`)
The extracted bathymetry profile is passed to the Recharts rendering engine. It uses an `<Area type="stepAfter" dataKey="bottom" ... />` component to visually draw the solid sea floor at the bottom of the Acoustic Ray Trace graph. This allows you to visually see the sound waves interacting with the real-world terrain in real-time.