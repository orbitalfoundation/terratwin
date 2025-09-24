export const dem_service = {
	id: 'dem-service',
	kind: 'service',
	
	// Cache for downloaded tiles
	tileCache: new Map(),
	
	// Configuration
	config: {
		// Using Mapbox Terrain-RGB tiles (free tier available)
		// Format: https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=YOUR_TOKEN
		// Alternative free option: Terrarium tiles from AWS
		tileUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
		// Satellite imagery sources
		satelliteUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		// Alternative satellite sources:
		// Sentinel-2 cloudless: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
		// USGS: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'
		tileSize: 256,
		maxZoom: 15,
		encoding: 'terrarium' // 'terrarium' or 'mapbox'
	},
	
	// Convert lat/lon to tile coordinates
	latLonToTile: function(lat, lon, zoom) {
		const n = Math.pow(2, zoom);
		const x = Math.floor((lon + 180) / 360 * n);
		const latRad = lat * Math.PI / 180;
		const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
		return { x, y, z: zoom };
	},
	
	// Convert tile coordinates back to lat/lon (for tile bounds)
	tileToLatLon: function(x, y, z) {
		const n = Math.pow(2, z);
		const lon = x / n * 360 - 180;
		const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
		const lat = latRad * 180 / Math.PI;
		return { lat, lon };
	},
	
	// Decode elevation from pixel values
	decodeElevation: function(r, g, b) {
		if (this.config.encoding === 'terrarium') {
			// Terrarium encoding: elevation = (r * 256 + g + b / 256) - 32768
			return (r * 256 + g + b / 256) - 32768;
		} else if (this.config.encoding === 'mapbox') {
			// Mapbox encoding: elevation = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1)
			return -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
		}
		return 0;
	},
	
	// Fetch a single tile
	fetchTile: async function(x, y, z) {
		const key = `${z}/${x}/${y}`;
		
		// Check cache
		if (this.tileCache.has(key)) {
			return this.tileCache.get(key);
		}
		
		const url = this.config.tileUrl
			.replace('{z}', z)
			.replace('{x}', x)
			.replace('{y}', y);
		
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			
			const blob = await response.blob();
			const bitmap = await createImageBitmap(blob);
			
			// Draw to canvas to get pixel data
			const canvas = document.createElement('canvas');
			canvas.width = this.config.tileSize;
			canvas.height = this.config.tileSize;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(bitmap, 0, 0);
			
			const imageData = ctx.getImageData(0, 0, this.config.tileSize, this.config.tileSize);
			const elevationData = new Float32Array(this.config.tileSize * this.config.tileSize);
			
			// Decode elevation for each pixel
			for (let i = 0; i < imageData.data.length; i += 4) {
				const r = imageData.data[i];
				const g = imageData.data[i + 1];
				const b = imageData.data[i + 2];
				const elevation = this.decodeElevation(r, g, b);
				elevationData[i / 4] = elevation;
			}
			
			const tileData = {
				x, y, z,
				elevations: elevationData,
				bounds: {
					sw: this.tileToLatLon(x, y + 1, z),
					ne: this.tileToLatLon(x + 1, y, z)
				}
			};
			
			this.tileCache.set(key, tileData);
			return tileData;
			
		} catch (error) {
			console.error(`Failed to fetch tile ${key}:`, error);
			return null;
		}
	},
	
	// Get elevation data for a region
	getElevationData: async function(bounds, zoom = null) {
		// bounds = { north, south, east, west } in degrees
		
		// Auto-determine zoom if not specified
		if (zoom === null) {
			const latRange = bounds.north - bounds.south;
			const lonRange = bounds.east - bounds.west;
			const maxRange = Math.max(latRange, lonRange);
			
			// Rough heuristic for zoom level
			if (maxRange > 10) zoom = 6;
			else if (maxRange > 5) zoom = 8;
			else if (maxRange > 1) zoom = 10;
			else if (maxRange > 0.5) zoom = 12;
			else if (maxRange > 0.1) zoom = 13;
			else zoom = 14;
			
			zoom = Math.min(zoom, this.config.maxZoom);
		}
		
		// Get tile bounds
		const nwTile = this.latLonToTile(bounds.north, bounds.west, zoom);
		const seTile = this.latLonToTile(bounds.south, bounds.east, zoom);
		
		const tiles = [];
		const promises = [];
		
		// Fetch all required tiles
		for (let x = nwTile.x; x <= seTile.x; x++) {
			for (let y = nwTile.y; y <= seTile.y; y++) {
				promises.push(this.fetchTile(x, y, zoom));
			}
		}
		
		const tileResults = await Promise.all(promises);
		const validTiles = tileResults.filter(t => t !== null);
		
		if (validTiles.length === 0) {
			throw new Error('No elevation data available for this region');
		}
		
		// Combine tiles into a single elevation grid
		const tilesX = seTile.x - nwTile.x + 1;
		const tilesY = seTile.y - nwTile.y + 1;
		const width = tilesX * this.config.tileSize;
		const height = tilesY * this.config.tileSize;
		const elevations = new Float32Array(width * height);
		
		// Copy each tile's data into the combined array
		validTiles.forEach(tile => {
			const tileOffsetX = (tile.x - nwTile.x) * this.config.tileSize;
			const tileOffsetY = (tile.y - nwTile.y) * this.config.tileSize;
			
			for (let y = 0; y < this.config.tileSize; y++) {
				for (let x = 0; x < this.config.tileSize; x++) {
					const srcIndex = y * this.config.tileSize + x;
					const dstX = tileOffsetX + x;
					const dstY = tileOffsetY + y;
					const dstIndex = dstY * width + dstX;
					elevations[dstIndex] = tile.elevations[srcIndex];
				}
			}
		});
		
		// Calculate actual bounds of the data
		const actualBounds = {
			north: this.tileToLatLon(nwTile.x, nwTile.y, zoom).lat,
			south: this.tileToLatLon(seTile.x, seTile.y + 1, zoom).lat,
			west: this.tileToLatLon(nwTile.x, nwTile.y + 1, zoom).lon,
			east: this.tileToLatLon(seTile.x + 1, seTile.y, zoom).lon
		};
		
		return {
			elevations,
			width,
			height,
			bounds: actualBounds,
			zoom,
			// Helper method to get elevation at specific lat/lon
			getElevationAt: function(lat, lon) {
				if (lat < this.bounds.south || lat > this.bounds.north ||
					lon < this.bounds.west || lon > this.bounds.east) {
					return null;
				}
				
				const x = (lon - this.bounds.west) / (this.bounds.east - this.bounds.west) * (this.width - 1);
				const y = (this.bounds.north - lat) / (this.bounds.north - this.bounds.south) * (this.height - 1);
				
				// Bilinear interpolation
				const x0 = Math.floor(x);
				const x1 = Math.min(x0 + 1, this.width - 1);
				const y0 = Math.floor(y);
				const y1 = Math.min(y0 + 1, this.height - 1);
				
				const fx = x - x0;
				const fy = y - y0;
				
				const v00 = this.elevations[y0 * this.width + x0];
				const v10 = this.elevations[y0 * this.width + x1];
				const v01 = this.elevations[y1 * this.width + x0];
				const v11 = this.elevations[y1 * this.width + x1];
				
				const v0 = v00 * (1 - fx) + v10 * fx;
				const v1 = v01 * (1 - fx) + v11 * fx;
				
				return v0 * (1 - fy) + v1 * fy;
			}
		};
	},
	
	// Fetch satellite imagery for a region
	getSatelliteImagery: async function(bounds, zoom = null) {
		// Auto-determine zoom if not specified (same logic as DEM)
		if (zoom === null) {
			const latRange = bounds.north - bounds.south;
			const lonRange = bounds.east - bounds.west;
			const maxRange = Math.max(latRange, lonRange);
			
			if (maxRange > 10) zoom = 6;
			else if (maxRange > 5) zoom = 8;
			else if (maxRange > 1) zoom = 10;
			else if (maxRange > 0.5) zoom = 12;
			else if (maxRange > 0.1) zoom = 13;
			else zoom = 14;
			
			zoom = Math.min(zoom, this.config.maxZoom);
		}
		
		// Get tile bounds
		const nwTile = this.latLonToTile(bounds.north, bounds.west, zoom);
		const seTile = this.latLonToTile(bounds.south, bounds.east, zoom);
		
		const promises = [];
		const tilePositions = [];
		
		// Fetch all required tiles
		for (let x = nwTile.x; x <= seTile.x; x++) {
			for (let y = nwTile.y; y <= seTile.y; y++) {
				promises.push(this.fetchSatelliteTile(x, y, zoom));
				tilePositions.push({x, y});
			}
		}
		
		const tileResults = await Promise.all(promises);
		
		// Create canvas to combine tiles
		const tilesX = seTile.x - nwTile.x + 1;
		const tilesY = seTile.y - nwTile.y + 1;
		const canvas = document.createElement('canvas');
		canvas.width = tilesX * this.config.tileSize;
		canvas.height = tilesY * this.config.tileSize;
		const ctx = canvas.getContext('2d');
		
		// Draw each tile to the canvas
		for (let i = 0; i < tileResults.length; i++) {
			const tile = tileResults[i];
			if (tile) {
				const pos = tilePositions[i];
				const x = (pos.x - nwTile.x) * this.config.tileSize;
				const y = (pos.y - nwTile.y) * this.config.tileSize;
				ctx.drawImage(tile, x, y);
			}
		}
		
		// Calculate actual bounds
		const actualBounds = {
			north: this.tileToLatLon(nwTile.x, nwTile.y, zoom).lat,
			south: this.tileToLatLon(seTile.x, seTile.y + 1, zoom).lat,
			west: this.tileToLatLon(nwTile.x, nwTile.y + 1, zoom).lon,
			east: this.tileToLatLon(seTile.x + 1, seTile.y, zoom).lon
		};
		
		return {
			canvas,
			imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
			width: canvas.width,
			height: canvas.height,
			bounds: actualBounds,
			zoom
		};
	},
	
	// Fetch a single satellite tile
	fetchSatelliteTile: async function(x, y, z) {
		const url = this.config.satelliteUrl
			.replace('{z}', z)
			.replace('{x}', x)
			.replace('{y}', y);
		
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			
			const blob = await response.blob();
			const bitmap = await createImageBitmap(blob);
			return bitmap;
		} catch (error) {
			console.error(`Failed to fetch satellite tile ${z}/${x}/${y}:`, error);
			return null;
		}
	},
	
	// Clear cache
	clearCache: function() {
		this.tileCache.clear();
	},
	
	// Example usage method
	example: async function() {
		// Example: Get elevation data for Mount Fuji area
		const bounds = {
			north: 35.4,
			south: 35.3,
			east: 138.8,
			west: 138.7
		};
		
		try {
			const demData = await this.getElevationData(bounds);
			console.log('DEM data:', demData);
			console.log('Elevation at center:', demData.getElevationAt(35.35, 138.75));
			return demData;
		} catch (error) {
			console.error('Failed to get elevation data:', error);
		}
	},
	
	// General function to create DEM volume
	getDemVolume: async function(params = {}) {
		// Default parameters
		const {
			bounds = {
				north: 36.063,  // Grand Canyon default
				south: 36.053,
				east: -112.103,
				west: -112.113
			},
			zoom = 14,
			id = 'terrain-dem',
			position = [50, 0, 50],
			sceneSize = [100, 100],  // width, depth in scene units
			heightScale = 0.01,
			color = 0x8B4513,  // Saddle brown
			includeSatellite = false  // Whether to fetch satellite imagery
		} = params;
		
		try {
			console.log('DEM Service: Fetching DEM data...');
			console.log('DEM Service: Bounds:', bounds);
			const demData = await this.getElevationData(bounds, zoom);
			console.log('DEM Service: Received data - width:', demData.width, 'height:', demData.height);
			
			// Find min/max elevations for scaling
			let minElev = Infinity;
			let maxElev = -Infinity;
			for (let i = 0; i < demData.elevations.length; i++) {
				const elev = demData.elevations[i];
				if (elev < minElev) minElev = elev;
				if (elev > maxElev) maxElev = elev;
			}
			
			console.log(`DEM Service: Elevation range: ${minElev}m to ${maxElev}m`);
			
			// Fetch satellite imagery if requested
			let satelliteData = null;
			if (includeSatellite) {
				console.log('DEM Service: Fetching satellite imagery...');
				try {
					satelliteData = await this.getSatelliteImagery(bounds, zoom);
					console.log('DEM Service: Satellite imagery loaded - width:', satelliteData.width, 'height:', satelliteData.height);
				} catch (error) {
					console.error('DEM Service: Failed to load satellite imagery:', error);
				}
			}
			
			// Create volume object for sys()
			const demVolume = {
				id: id,
				kind: 'dem',
				volume: {
					shape: 'dem',
					xyz: position,
					hwd: [
						(maxElev - minElev) * heightScale,
						sceneSize[0],
						sceneSize[1]
					],
					color: color,
					demData: {
						elevations: demData.elevations,
						width: demData.width,
						height: demData.height,
						minElev: minElev,
						maxElev: maxElev,
						bounds: demData.bounds,
						heightScale: heightScale,
						sceneSize: sceneSize,
						position: position,
						// Helper method to get elevation at scene coordinates
						getElevationAtSceneCoords: function(sceneX, sceneZ) {
							// Convert scene coordinates to normalized coordinates (0-1)
							const normX = (sceneX - position[0] + sceneSize[0]/2) / sceneSize[0];
							const normZ = (sceneZ - position[2] + sceneSize[1]/2) / sceneSize[1];
							
							// Check bounds
							if (normX < 0 || normX > 1 || normZ < 0 || normZ > 1) {
								return 0; // Default elevation if outside bounds
							}
							
							// Convert to DEM pixel coordinates
							const pixelX = normX * (this.width - 1);
							const pixelZ = normZ * (this.height - 1);
							
							// Bilinear interpolation
							const x0 = Math.floor(pixelX);
							const x1 = Math.min(x0 + 1, this.width - 1);
							const z0 = Math.floor(pixelZ);
							const z1 = Math.min(z0 + 1, this.height - 1);
							
							const fx = pixelX - x0;
							const fz = pixelZ - z0;
							
							const v00 = this.elevations[z0 * this.width + x0];
							const v10 = this.elevations[z0 * this.width + x1];
							const v01 = this.elevations[z1 * this.width + x0];
							const v11 = this.elevations[z1 * this.width + x1];
							
							const v0 = v00 * (1 - fx) + v10 * fx;
							const v1 = v01 * (1 - fx) + v11 * fx;
							const elevation = v0 * (1 - fz) + v1 * fz;
							
							// Return scaled elevation for scene
							return (elevation - this.minElev) * this.heightScale;
						},
						// Satellite imagery data if available
						satelliteData: satelliteData
					}
				}
			};
			
			console.log('DEM Service: Created volume object:', demVolume);
			return demVolume;
		} catch (error) {
			console.error('DEM Service: Failed to create DEM volume:', error);
			return null;
		}
	},
	
	// Test Grand Canyon DEM as volume object (now uses getDemVolume)
	testGrandCanyonVolume: async function() {
		return this.getDemVolume({
			bounds: {
				north: 36.063,
				south: 36.053,
				east: -112.103,
				west: -112.113
			}
		});
	}
};
