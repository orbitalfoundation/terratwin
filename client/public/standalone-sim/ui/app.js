import { deepClone } from '../utils/deepClone.js';
import { sys } from '../utils/sys.js';
import { prototypical_plot } from '../prototypes/plot.js';
import { volume_service } from '../services/volume.js';
import { StatsCanvas } from './stats-canvas.js';
import { dem_service } from '../services/dem.js';
import { ConfigPanel } from './config-panel.js';

export class BambooSimApp {
    constructor() {
        this.plot = null;
        this.isRunning = false;
        this.currentDay = 0;
        this.animationId = null;
        this.statsCanvas = null;
        this.configPanel = null;
        this.activeTab = '3d';
        this.demVolume = null;
        
        // Initialize volume service early so 3D view is ready
        console.log('BambooSimApp: Initializing volume service...');
        sys(volume_service);
        
        // Load DEM data automatically
        this.loadDEM();
        
        this.initializeUI();
        this.bindEvents();
    }
    
    initializeUI() {
        // Set active tab
        document.querySelector('[data-tab="3d"]').classList.add('active');
        document.querySelector('[data-content="3d"]').classList.remove('hidden');
    }
    
    bindEvents() {
        // Tab switching
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Control buttons
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('stepBtn').addEventListener('click', () => this.step(1));
        document.getElementById('yearBtn').addEventListener('click', () => this.step(365));
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        
        // Speed control
        document.getElementById('speedControl').addEventListener('input', (e) => {
            document.getElementById('speedValue').textContent = e.target.value + 'x';
        });
        
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('[data-content]').forEach(content => {
            content.classList.add('hidden');
        });
        document.querySelector(`[data-content="${tabName}"]`).classList.remove('hidden');
        
        this.activeTab = tabName;
        
        // Initialize stats canvas if switching to stats tab
        if (tabName === 'stats') {
            if (!this.statsCanvas) {
                this.statsCanvas = new StatsCanvas('statsCanvas');
            }
            // Update stats immediately when switching to stats tab
            if (this.plot && this.plot.stats) {
                this.statsCanvas.update(this.plot.stats, this.currentDay);
            }
        }
        
        // Initialize config panel if switching to config tab
        if (tabName === 'config') {
            if (!this.configPanel) {
                this.configPanel = new ConfigPanel('configPanel');
            }
            // Update metrics in config panel
            this.updateConfigMetrics();
        }
    }
    
    initializePlot() {
        console.log('BambooSimApp: Initializing plot...');
        
        // Create plot
        this.plot = deepClone(prototypical_plot);
        this.plot.id = 1;
        this.plot.field.width = 100;
        this.plot.field.depth = 100;
        this.plot.field.ENABLE_INTERCROPPING = true;
        
        // Pass DEM data to plot if available
        if (this.demVolume && this.demVolume.volume.demData) {
            this.plot.demData = this.demVolume.volume.demData;
            console.log('BambooSimApp: Passed DEM data to plot');
        }
        
        // Register plot with sys
        sys(this.plot);
        
        // Send all entities through sys so volume service can see them
        this.registerAllEntities();
        this.updateStats();
    }
    
    registerAllEntities() {
        // Register all children with sys
        this.plot.children.forEach(entity => {
            sys(entity);
            
            // Register grandchildren (culms, coffee plants)
            if (entity.children) {
                entity.children.forEach(child => sys(child));
            }
        });
    }
    
    updateAllEntities() {
        // No longer needed - volume service updates itself during onstep
    }
    
    updateStats() {
        let totalBambooHeight = 0;
        let culmCount = 0;
        let totalCoffeeHeight = 0;
        let coffeePlantCount = 0;
        
        this.plot.children.forEach(entity => {
            if (entity.clump) {
                entity.children.forEach(culm => {
                    totalBambooHeight += culm.volume.hwd[0];
                    culmCount++;
                });
            } else if (entity.coffeerow) {
                entity.children.forEach(plant => {
                    totalCoffeeHeight += plant.volume.hwd[0];
                    coffeePlantCount++;
                });
            }
        });
        
        const avgBambooHeight = culmCount > 0 ? totalBambooHeight / culmCount : 0;
        const avgCoffeeHeight = coffeePlantCount > 0 ? totalCoffeeHeight / coffeePlantCount : 0;
        
        // Update UI
        document.getElementById('day').textContent = this.currentDay;
        document.getElementById('year').textContent = Math.floor(this.currentDay / 365);
        document.getElementById('bambooHeight').textContent = avgBambooHeight.toFixed(2) + 'm';
        document.getElementById('coffeeHeight').textContent = avgCoffeeHeight.toFixed(2) + 'm';
        document.getElementById('harvested').textContent = Math.round(this.plot.stats.cumulativeHarvest);
        document.getElementById('value').textContent = '$' + this.plot.stats.cumulativeValue.toFixed(2);
        
        // Update stats canvas if active
        if (this.statsCanvas && this.activeTab === 'stats' && this.plot) {
            this.statsCanvas.update(this.plot.stats, this.currentDay);
        }
        
        // Update config panel metrics if active
        if (this.configPanel && this.activeTab === 'config') {
            this.updateConfigMetrics();
        }
    }
    
    simulationStep(days = 1) {
        // Always step one day at a time, even when running at higher speeds
        for (let i = 0; i < days; i++) {
            sys({step: 1});
            this.currentDay++;
        }
        
        this.updateStats();
    }
    
    animate() {
        if (this.isRunning) {
            const speed = parseInt(document.getElementById('speedControl').value);
            this.simulationStep(speed);
            this.animationId = setTimeout(() => this.animate(), 100);
        }
    }
    
    start() {
        if (!this.plot) {
            this.initializePlot();
        }
        this.isRunning = true;
        this.animate();
    }
    
    pause() {
        this.isRunning = false;
        if (this.animationId) {
            clearTimeout(this.animationId);
        }
    }
    
    step(days) {
        if (!this.plot) {
            this.initializePlot();
        }
        this.simulationStep(days);
    }
    
    reset() {
        console.log('BambooSimApp: Resetting simulation...');
        this.pause();
        this.currentDay = 0;
        this.plot = null;
        
        // Send reset command to volume service through sys
        sys({ volume: { command: 'reset' } });
        
        this.updateStats();
    }
    
    async loadDEM() {
        console.log('BambooSimApp: Loading DEM data...');
        
        try {
            // Load DEM for the plot area (Grand Canyon for now)
            this.demVolume = await dem_service.getDemVolume({
                bounds: {
                    north: 36.063,
                    south: 36.053,
                    east: -112.103,
                    west: -112.113
                },
                position: [50, 0, 50],
                sceneSize: [100, 100],  // Match plot size
                heightScale: 0.01,
                includeSatellite: true  // Enable satellite imagery
            });
            
            if (this.demVolume) {
                console.log('BambooSimApp: Sending DEM volume to sys()');
                sys(this.demVolume);
                console.log('BambooSimApp: DEM loaded successfully');
                
                // Set camera to center on plot
                sys({
                    id: 'camera-target',
                    volume: {
                        shape: 'camera',
                        xyz: [50, 0, 50] // Center of the 100x100 plot
                    }
                });
            } else {
                console.error('BambooSimApp: DEM volume was null');
            }
        } catch (error) {
            console.error('BambooSimApp: Failed to load DEM:', error);
        }
    }
    
    updateConfigMetrics() {
        if (!this.configPanel || !this.plot) return;
        
        let culmCount = 0;
        let clumpCount = 0;
        
        this.plot.children.forEach(entity => {
            if (entity.clump) {
                clumpCount++;
                culmCount += entity.children.length;
            }
        });
        
        const metrics = {
            avgHeight: this.plot.stats.totalGrowth[this.plot.stats.totalGrowth.length - 1] || 0,
            clumps: clumpCount,
            livePoles: culmCount,
            harvested: this.plot.stats.cumulativeHarvest,
            co2: this.plot.stats.cumulativeCO2
        };
        
        this.configPanel.updateMetrics(metrics);
    }
}
