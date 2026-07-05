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
                MAX_HEIGHT_METERS: 15,       // rendered height target (species can hit 30m; halved for scene readability)
                GROWTH_RATE: 0.02,           // Controls steepness of S-curve (reaches ~95% height by 2 years)
                GROWTH_MIDPOINT_DAYS: 180,   // Days when growth is fastest (6 months)
                WIDTH_TO_HEIGHT_RATIO: 0.009, // ~13cm radius at full height

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

        // Color. Real groves show far more variety than "green with a few
        // yellow stalks": most culms sit in a green..yellow-green band, but
        // there are golden/straw culms, older brown-olive ones, and - very
        // characteristic of D. asper - younger culms wearing a powdery
        // gray-green bloom. Each culm picks a lifetime identity once
        // (deterministic from position) and blends into it as it matures.
        if (self.culm._variant === undefined) {
                const seedX = Math.floor(self.volume.xyz[0] * 1000)
                const seedZ = Math.floor(self.volume.xyz[2] * 1000)
                const seed = (seedX * 73856093) ^ (seedZ * 19349663)
                const rand = (n) => {
                        const s = Math.sin(seed * 0.0001 + n * 12.9898) * 43758.5453
                        return s - Math.floor(s)
                }
                const roll = rand(4)
                let v
                if (roll < 0.52) {        // fresh to deep greens
                        v = { hue: 84 + rand(5) * 22, sat: 0.32 + rand(6) * 0.16, lit: 0.30 + rand(7) * 0.10 }
                } else if (roll < 0.72) { // yellow-greens
                        v = { hue: 62 + rand(5) * 16, sat: 0.36 + rand(6) * 0.14, lit: 0.34 + rand(7) * 0.10 }
                } else if (roll < 0.83) { // golden / straw
                        v = { hue: 46 + rand(5) * 10, sat: 0.42 + rand(6) * 0.14, lit: 0.42 + rand(7) * 0.12 }
                } else if (roll < 0.93) { // powdery gray-green bloom
                        v = { hue: 96 + rand(5) * 18, sat: 0.10 + rand(6) * 0.10, lit: 0.44 + rand(7) * 0.12 }
                } else {                  // brown-olive elders
                        v = { hue: 44 + rand(5) * 14, sat: 0.24 + rand(6) * 0.10, lit: 0.27 + rand(7) * 0.07 }
                }
                self.culm._variant = v
        }

        const v = self.culm._variant
        const ageYears = self.culm.age / 365

        // blend from dark sheathed shoot into the culm's identity over year one
        const t = Math.min(ageYears / 1.0, 1)
        let hue = 70 + (v.hue - 70) * t
        let sat = 0.30 + (v.sat - 0.30) * t
        let lit = 0.24 + (v.lit - 0.24) * t

        // old culms drift slightly warmer and paler
        const m = Math.max(0, Math.min((ageYears - 3) / 4, 1))
        hue -= m * 8
        lit += m * 0.04

        // culms at the clump edge catch a touch more light
        lit += Math.min(self.culm.distanceFromCenter / 2, 1.0) * 0.03
        lit = Math.max(0.15, Math.min(0.62, lit))

        self.volume.color = hslToHex(hue / 360, sat, lit)
}

function hslToHex(h, s, l) {
        const k = (n) => (n + h * 12) % 12
        const a = s * Math.min(l, 1 - l)
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
        const r = Math.round(f(0) * 255)
        const g = Math.round(f(8) * 255)
        const b = Math.round(f(4) * 255)
        return (r << 16) | (g << 8) | b
}
