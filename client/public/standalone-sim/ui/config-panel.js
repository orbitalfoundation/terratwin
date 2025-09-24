export class ConfigPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.config = this.getDefaultConfig();
        this.render();
    }
    
    getDefaultConfig() {
        return {
            timeline: {
                startYear: 2025,
                endYear: 2035,
                currentYear: 2025
            },
            species: {
                type: 'golden-bamboo',
                density: 'low',
                harvestYears: 5,
                harvestRate: 20
            },
            plot: {
                area: 100,
                elevation: 0,
                slopeFacing: 0,
                steepness: 0,
                latitude: 0,
                longitude: 0,
                rainfall: 0,
                drainage: 5000
            },
            soil: {
                salts: 50,
                nitrogen: 50,
                microbialMass: 50,
                earthworms: 50,
                acidity: 7.0,
                fertility: 50
            },
            pests: {
                bambooBorer: false,
                aphids: false,
                fungalPathogens: false
            },
            intervention: {
                weeding: false,
                mulching: false,
                fertilization: false,
                pestControl: false
            },
            intercropping: {
                legumes: false,
                herbs: false,
                specialtyCrops: false,
                animals: false
            }
        };
    }
    
    render() {
        this.container.innerHTML = `
            <div class="config-panel bg-gray-800 p-6 rounded-lg">
                <h2 class="text-2xl font-bold mb-2">Bamboo Growth Simulation</h2>
                <p class="text-gray-400 mb-6">Carbon sequestration model from ${this.config.timeline.startYear} – ${this.config.timeline.endYear}</p>
                
                <!-- Timeline Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Timeline</h3>
                    <div class="bg-gray-700 p-4 rounded">
                        <label class="block text-sm text-gray-400 mb-2">Year: <span class="text-white">${this.config.timeline.currentYear}</span></label>
                        <input type="range" min="${this.config.timeline.startYear}" max="${this.config.timeline.endYear}" 
                               value="${this.config.timeline.currentYear}" class="w-full" id="yearSlider">
                    </div>
                </div>
                
                <!-- Growth Metrics Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Growth Metrics</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Avg Height:</span>
                            <span id="avgHeight">0 m</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Clumps:</span>
                            <span id="clumps">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Live Poles:</span>
                            <span id="livePoles">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Harvested:</span>
                            <span id="harvested">0</span>
                        </div>
                        <div class="flex justify-between col-span-2">
                            <span class="text-gray-400">CO₂ Sequestered:</span>
                            <span id="co2">0 kg</span>
                        </div>
                    </div>
                </div>
                
                <!-- Species & Schedule Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Species & Schedule</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Species</label>
                            <select class="w-full bg-gray-700 rounded px-3 py-2" id="species">
                                <option value="golden-bamboo">Golden Bamboo</option>
                                <option value="giant-bamboo">Giant Bamboo</option>
                                <option value="black-bamboo">Black Bamboo</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Density</label>
                            <select class="w-full bg-gray-700 rounded px-3 py-2" id="density">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Harvest in (yrs)</label>
                            <input type="number" value="${this.config.species.harvestYears}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="harvestYears">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Harvest Rate (%)</label>
                            <input type="number" value="${this.config.species.harvestRate}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="harvestRate">
                        </div>
                    </div>
                </div>
                
                <!-- Plot Info Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Plot Info</h3>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Area (ha)</label>
                            <input type="number" value="${this.config.plot.area}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="area">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Elevation (m)</label>
                            <input type="number" value="${this.config.plot.elevation}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="elevation">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Slope Facing (°)</label>
                            <input type="number" value="${this.config.plot.slopeFacing}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="slopeFacing">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Steepness (%)</label>
                            <input type="number" value="${this.config.plot.steepness}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="steepness">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Latitude</label>
                            <input type="number" value="${this.config.plot.latitude}" step="0.0001"
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="latitude">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Longitude</label>
                            <input type="number" value="${this.config.plot.longitude}" step="0.0001"
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="longitude">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Rainfall (mm/yr)</label>
                            <input type="number" value="${this.config.plot.rainfall}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="rainfall">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Drainage (m³/yr)</label>
                            <input type="number" value="${this.config.plot.drainage}" 
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="drainage">
                        </div>
                    </div>
                </div>
                
                <!-- Soil Conditions Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Soil Conditions</h3>
                    <div class="space-y-3">
                        ${this.renderSlider('Salts', 'salts', this.config.soil.salts)}
                        ${this.renderSlider('Nitrogen', 'nitrogen', this.config.soil.nitrogen)}
                        ${this.renderSlider('Microbial Mass', 'microbialMass', this.config.soil.microbialMass)}
                        ${this.renderSlider('Earthworms', 'earthworms', this.config.soil.earthworms)}
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Acidity (pH)</label>
                            <input type="number" value="${this.config.soil.acidity}" min="0" max="14" step="0.1"
                                   class="w-full bg-gray-700 rounded px-3 py-2" id="acidity">
                        </div>
                        ${this.renderSlider('Fertility', 'fertility', this.config.soil.fertility)}
                    </div>
                </div>
                
                <!-- Pests Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Pests</h3>
                    <div class="space-y-2">
                        ${this.renderCheckbox('Bamboo Borer', 'bambooBorer', this.config.pests.bambooBorer)}
                        ${this.renderCheckbox('Aphids', 'aphids', this.config.pests.aphids)}
                        ${this.renderCheckbox('Fungal Pathogens', 'fungalPathogens', this.config.pests.fungalPathogens)}
                    </div>
                </div>
                
                <!-- Intervention Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Intervention</h3>
                    <div class="space-y-2">
                        ${this.renderCheckbox('Weeding', 'weeding', this.config.intervention.weeding)}
                        ${this.renderCheckbox('Mulching', 'mulching', this.config.intervention.mulching)}
                        ${this.renderCheckbox('Fertilization', 'fertilization', this.config.intervention.fertilization)}
                        ${this.renderCheckbox('Pest Control', 'pestControl', this.config.intervention.pestControl)}
                    </div>
                </div>
                
                <!-- Intercropping Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Intercropping</h3>
                    <div class="space-y-2">
                        ${this.renderCheckbox('Legumes (beans, peas, lentils)', 'legumes', this.config.intercropping.legumes)}
                        ${this.renderCheckbox('Herbs (ginger, turmeric)', 'herbs', this.config.intercropping.herbs)}
                        ${this.renderCheckbox('Specialty Crops (coffee, cacao, tea)', 'specialtyCrops', this.config.intercropping.specialtyCrops)}
                        ${this.renderCheckbox('Animals (fowl, pigs)', 'animals', this.config.intercropping.animals)}
                    </div>
                </div>
            </div>
        `;
        
        this.bindEvents();
    }
    
    renderSlider(label, id, value) {
        return `
            <div>
                <label class="block text-sm text-gray-400 mb-1">${label}</label>
                <div class="flex items-center space-x-3">
                    <input type="range" min="0" max="100" value="${value}" 
                           class="flex-1" id="${id}">
                    <span class="text-sm w-12 text-right">${value}%</span>
                </div>
            </div>
        `;
    }
    
    renderCheckbox(label, id, checked) {
        return `
            <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" ${checked ? 'checked' : ''} 
                       class="rounded bg-gray-700 border-gray-600" id="${id}">
                <span class="text-sm">${label}</span>
            </label>
        `;
    }
    
    bindEvents() {
        // Add event listeners for all inputs
        // For now, just log changes since it's not wired up
        this.container.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', (e) => {
                console.log(`Config changed: ${e.target.id} = ${e.target.value || e.target.checked}`);
            });
        });
        
        // Update slider value displays
        this.container.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const valueSpan = e.target.parentElement.querySelector('span');
                if (valueSpan && e.target.id !== 'yearSlider') {
                    valueSpan.textContent = e.target.value + '%';
                } else if (e.target.id === 'yearSlider') {
                    e.target.parentElement.querySelector('span.text-white').textContent = e.target.value;
                }
            });
        });
    }
    
    getConfig() {
        // Return current configuration values
        return this.config;
    }
    
    updateMetrics(metrics) {
        // Update the growth metrics display
        if (metrics.avgHeight !== undefined) {
            document.getElementById('avgHeight').textContent = metrics.avgHeight.toFixed(2) + ' m';
        }
        if (metrics.clumps !== undefined) {
            document.getElementById('clumps').textContent = metrics.clumps;
        }
        if (metrics.livePoles !== undefined) {
            document.getElementById('livePoles').textContent = metrics.livePoles;
        }
        if (metrics.harvested !== undefined) {
            document.getElementById('harvested').textContent = metrics.harvested;
        }
        if (metrics.co2 !== undefined) {
            document.getElementById('co2').textContent = metrics.co2.toFixed(0) + ' kg';
        }
    }
}
