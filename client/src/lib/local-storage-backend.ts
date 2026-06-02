import type { Plot, InsertPlot } from '@shared/schema';

const STORAGE_KEY = 'terratwin_plots';

// Seeded demo data: Mindanao, Philippines bamboo farms
const DEMO_PLOTS: Plot[] = [
  {
    id: 'demo-plot-1',
    name: 'Davao Highlands Plot A',
    latitude: 7.0731,
    longitude: 125.6128,
    area: 5000,
    bambooType: 'Dendrocalamus asper',
    status: 'active',
    notes: 'Primary demonstration plot in Davao del Norte highlands region. Good drainage and high fertility.',
    polygonOutline: null,
    speciesDensity: 'high',
    harvestYears: 5,
    harvestRate: 20,
    elevation: 450,
    slopeFacing: 135,
    steepness: 15,
    rainfall: 2400,
    drainage: 8000,
    soilSalts: 30,
    soilNitrogen: 65,
    soilMicrobialMass: 70,
    soilEarthworms: 60,
    soilAcidity: 6.2,
    soilFertility: 72,
    pestBambooBorer: 'false',
    pestAphids: 'false',
    pestFungalPathogens: 'false',
    interventionWeeding: 'true',
    interventionMulching: 'true',
    interventionFertilization: 'false',
    interventionPestControl: 'false',
    intercroppingLegumes: 'true',
    intercroppingHerbs: 'false',
    intercroppingSpecialtyCrops: 'false',
    intercroppingAnimals: 'false',
    createdAt: '2024-01-15 08:00:00',
    updatedAt: '2024-01-15 08:00:00',
  },
  {
    id: 'demo-plot-2',
    name: 'Bukidnon Valley Plot B',
    latitude: 8.0515,
    longitude: 124.6220,
    area: 8500,
    bambooType: 'Dendrocalamus asper',
    status: 'planning',
    notes: 'Planned expansion in Bukidnon province valley. Cooler temperatures at elevation. Aphid management underway.',
    polygonOutline: null,
    speciesDensity: 'medium',
    harvestYears: 6,
    harvestRate: 25,
    elevation: 680,
    slopeFacing: 90,
    steepness: 8,
    rainfall: 2100,
    drainage: 6000,
    soilSalts: 25,
    soilNitrogen: 58,
    soilMicrobialMass: 55,
    soilEarthworms: 50,
    soilAcidity: 6.5,
    soilFertility: 65,
    pestBambooBorer: 'false',
    pestAphids: 'true',
    pestFungalPathogens: 'false',
    interventionWeeding: 'false',
    interventionMulching: 'false',
    interventionFertilization: 'true',
    interventionPestControl: 'true',
    intercroppingLegumes: 'false',
    intercroppingHerbs: 'true',
    intercroppingSpecialtyCrops: 'false',
    intercroppingAnimals: 'false',
    createdAt: '2024-02-01 09:00:00',
    updatedAt: '2024-02-01 09:00:00',
  },
  {
    id: 'demo-plot-3',
    name: 'Cotabato Floodplain Plot C',
    latitude: 7.2047,
    longitude: 124.2310,
    area: 12000,
    bambooType: 'Dendrocalamus asper',
    status: 'active',
    notes: 'Large-scale planting along Cotabato river corridor. High rainfall and rich alluvial soils. Bamboo borer present — pest control active.',
    polygonOutline: null,
    speciesDensity: 'high',
    harvestYears: 4,
    harvestRate: 15,
    elevation: 85,
    slopeFacing: 180,
    steepness: 3,
    rainfall: 2800,
    drainage: 12000,
    soilSalts: 45,
    soilNitrogen: 72,
    soilMicrobialMass: 78,
    soilEarthworms: 80,
    soilAcidity: 5.8,
    soilFertility: 80,
    pestBambooBorer: 'true',
    pestAphids: 'false',
    pestFungalPathogens: 'false',
    interventionWeeding: 'true',
    interventionMulching: 'true',
    interventionFertilization: 'true',
    interventionPestControl: 'true',
    intercroppingLegumes: 'true',
    intercroppingHerbs: 'true',
    intercroppingSpecialtyCrops: 'true',
    intercroppingAnimals: 'false',
    createdAt: '2024-03-10 10:00:00',
    updatedAt: '2024-03-10 10:00:00',
  },
];

function loadPlots(): Plot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted storage — reset to demo data
  }
  savePlots(DEMO_PLOTS);
  return [...DEMO_PLOTS];
}

function savePlots(plots: Plot[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plots));
}

function nowString(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export const localBackend = {
  async getAllPlots(): Promise<Plot[]> {
    return loadPlots();
  },

  async getPlot(id: string): Promise<Plot | undefined> {
    return loadPlots().find(p => p.id === id);
  },

  async createPlot(insertPlot: InsertPlot): Promise<Plot> {
    const plots = loadPlots();
    const now = nowString();
    const plot: Plot = {
      id: crypto.randomUUID(),
      name: insertPlot.name,
      latitude: insertPlot.latitude,
      longitude: insertPlot.longitude,
      area: insertPlot.area,
      bambooType: insertPlot.bambooType,
      status: insertPlot.status ?? 'planning',
      notes: insertPlot.notes ?? null,
      polygonOutline: insertPlot.polygonOutline ?? null,
      speciesDensity: insertPlot.speciesDensity ?? 'low',
      harvestYears: insertPlot.harvestYears ?? 5,
      harvestRate: insertPlot.harvestRate ?? 20,
      elevation: insertPlot.elevation ?? 0,
      slopeFacing: insertPlot.slopeFacing ?? 0,
      steepness: insertPlot.steepness ?? 0,
      rainfall: insertPlot.rainfall ?? 0,
      drainage: insertPlot.drainage ?? 5000,
      soilSalts: insertPlot.soilSalts ?? 50,
      soilNitrogen: insertPlot.soilNitrogen ?? 50,
      soilMicrobialMass: insertPlot.soilMicrobialMass ?? 50,
      soilEarthworms: insertPlot.soilEarthworms ?? 50,
      soilAcidity: insertPlot.soilAcidity ?? 7.0,
      soilFertility: insertPlot.soilFertility ?? 50,
      pestBambooBorer: insertPlot.pestBambooBorer ?? 'false',
      pestAphids: insertPlot.pestAphids ?? 'false',
      pestFungalPathogens: insertPlot.pestFungalPathogens ?? 'false',
      interventionWeeding: insertPlot.interventionWeeding ?? 'false',
      interventionMulching: insertPlot.interventionMulching ?? 'false',
      interventionFertilization: insertPlot.interventionFertilization ?? 'false',
      interventionPestControl: insertPlot.interventionPestControl ?? 'false',
      intercroppingLegumes: insertPlot.intercroppingLegumes ?? 'false',
      intercroppingHerbs: insertPlot.intercroppingHerbs ?? 'false',
      intercroppingSpecialtyCrops: insertPlot.intercroppingSpecialtyCrops ?? 'false',
      intercroppingAnimals: insertPlot.intercroppingAnimals ?? 'false',
      createdAt: now,
      updatedAt: now,
    };
    savePlots([...plots, plot]);
    return plot;
  },

  async updatePlot(id: string, plotUpdate: Partial<InsertPlot>): Promise<Plot | undefined> {
    const plots = loadPlots();
    const idx = plots.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    const updated: Plot = { ...plots[idx], ...plotUpdate, updatedAt: nowString() };
    plots[idx] = updated;
    savePlots(plots);
    return updated;
  },

  async deletePlot(id: string): Promise<boolean> {
    const plots = loadPlots();
    const filtered = plots.filter(p => p.id !== id);
    if (filtered.length === plots.length) return false;
    savePlots(filtered);
    return true;
  },
};
