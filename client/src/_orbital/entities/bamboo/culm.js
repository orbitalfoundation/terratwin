import { prototypical_entity } from './entity.js';

// A dendrocalamus asper culm prototype - clone to use
export const prototypical_dendrocalamus_asper_culm = {
        ...prototypical_entity,
        
        kind: 'culm',

        metadata: {
                title: 'Giant Bamboo Culm',
                description: 'A single pole of Dendrocalamus asper, one of the largest bamboo species',
                unsplashImage: 'https://images.unsplash.com/photo-1567450489212-d37b5ba1b639'
        },

        culm: {
                age: 0,
                USD_PER_CULM: 12.0,
                CO2_KG_PER_CULM: 2.21,
                JOULES_PER_HARVEST: 3600000, // 1 kWh = 3.6 MJ (rough estimate for harvesting energy)
                
                // Growth parameters
                MAX_HEIGHT_METERS: 30,        // Giant bamboo can reach 30m
                GROWTH_RATE: 0.02,           // Controls steepness of S-curve (reaches ~95% height by 2 years)
                GROWTH_MIDPOINT_DAYS: 180,   // Days when growth is fastest (6 months)
                WIDTH_TO_HEIGHT_RATIO: 0.005, // Roughly 15cm diameter at full height
                
                // Position-based growth modifiers
                distanceFromCenter: 0,        // Distance from clump center (meters)
                growthSpeedModifier: 1.0,     // Multiplier for growth speed based on position
                initialTiltAngle: 0,          // Initial tilt angle (radians)
                initialTiltDirection: 0       // Initial tilt direction (radians)
        },
        
        // Rendering information
        volume: {
                xyz: [ 0,0,0 ],
                hwd: [ 0,0,0 ],
                ypr: [ 0,0,0 ],
                shape: 'cylinder',
                color: 0x228B22,  // Forest green (will be varied per culm)
                opacity: 1.0
        }
}

prototypical_dendrocalamus_asper_culm.onstep = function(daysElapsed) {
        const self = this
        self.culm.age += daysElapsed
        
        // Apply growth speed modifier based on distance from center
        const effectiveAge = self.culm.age * self.culm.growthSpeedModifier
        
        // S-curve growth: rapid at first, slowing with age
        // Using logistic growth function with modified age
        const currentHeight = self.culm.MAX_HEIGHT_METERS / (1 + Math.exp(-self.culm.GROWTH_RATE * (effectiveAge - self.culm.GROWTH_MIDPOINT_DAYS)))
        self.volume.hwd[0] = currentHeight
        
        // Width grows proportionally but slower
        self.volume.hwd[1] = self.volume.hwd[0] * self.culm.WIDTH_TO_HEIGHT_RATIO
        self.volume.hwd[2] = self.volume.hwd[1] // depth same as width (circular)
        
        // Adjust tilt angle - becomes straighter as it grows
        // Start with initial tilt, reduce to 20% of initial when fully grown
        const growthProgress = currentHeight / self.culm.MAX_HEIGHT_METERS
        const currentTiltAngle = self.culm.initialTiltAngle * (1 - 0.8 * growthProgress)
        
        // Update rotation
        self.volume.ypr = [
                self.culm.initialTiltDirection, // Yaw: direction of tilt (unchanged)
                currentTiltAngle,               // Pitch: amount of tilt (reduces with growth)
                0                               // Roll: no roll
        ]
        
        // Enhanced color variation with age, distance, and randomness
        // Age factor: 0 to 1 over first 2 years
        const ageFactor = Math.min(self.culm.age / 730, 1.0)
        
        // Create a consistent random seed for this culm based on its position
        // This ensures the same culm always has the same color variation
        const seedX = Math.floor(self.volume.xyz[0] * 1000)
        const seedZ = Math.floor(self.volume.xyz[2] * 1000)
        const randomSeed = (seedX * 73 + seedZ * 197) % 1000
        const random1 = (Math.sin(randomSeed * 0.0123) + 1) / 2 // 0-1
        const random2 = (Math.sin(randomSeed * 0.0456) + 1) / 2 // 0-1
        const random3 = (Math.sin(randomSeed * 0.0789) + 1) / 2 // 0-1
        
        // Distance factor: culms further from center get brighter colors
        // Normalize distance to 0-1 range (assuming max distance of ~20m)
        const distanceFactor = Math.min(self.culm.distanceFromCenter / 20, 1.0)
        const edgeBrightness = distanceFactor * 0.4 // Up to 40% brighter on edges
        
        // Base color variations - more diverse green palette
        const colorVariants = [
            { r: 34, g: 139, b: 34 },   // Forest green (original)
            { r: 50, g: 175, b: 50 },   // Lime green
            { r: 60, g: 179, b: 113 },  // Medium sea green
            { r: 46, g: 125, b: 50 },   // Dark forest green
            { r: 85, g: 107, b: 47 },   // Dark olive green
            { r: 124, g: 252, b: 0 },   // Lawn green (bright)
            { r: 152, g: 251, b: 152 }, // Pale green
            { r: 144, g: 238, b: 144 }  // Light green
        ]
        
        // Select base color variant based on random seed
        const colorIndex = Math.floor(random1 * colorVariants.length)
        const baseColor = colorVariants[colorIndex]
        
        // Apply age-based variation
        let r = baseColor.r + (1 - ageFactor) * 30 // Brighter when young
        let g = baseColor.g + (1 - ageFactor) * 20 // More green when young  
        let b = baseColor.b - (1 - ageFactor) * 10 // Less blue when young
        
        // Apply edge brightness boost
        r += edgeBrightness * 60
        g += edgeBrightness * 80
        b += edgeBrightness * 20
        
        // Add random variation (±20% for each channel for more diversity)
        r += (random2 - 0.5) * 80 // ±40
        g += (random3 - 0.5) * 80 // ±40
        b += (random1 - 0.5) * 60 // ±30
        
        // Ensure values stay within valid range [0, 255]
        r = Math.max(0, Math.min(255, Math.floor(r)))
        g = Math.max(0, Math.min(255, Math.floor(g)))
        b = Math.max(0, Math.min(255, Math.floor(b)))
        
        // Convert to hex color
        self.volume.color = (r << 16) | (g << 8) | b
}
