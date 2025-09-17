import { type Plot, type InsertPlot } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getPlot(id: string): Promise<Plot | undefined>;
  getAllPlots(): Promise<Plot[]>;
  createPlot(plot: InsertPlot): Promise<Plot>;
  updatePlot(id: string, plot: Partial<InsertPlot>): Promise<Plot | undefined>;
  deletePlot(id: string): Promise<boolean>;
  flushAllPlots(): Promise<void>;
}

export class MemStorage implements IStorage {
  private plots: Map<string, Plot>;

  constructor() {
    this.plots = new Map();
    // No initial data - start with empty plots
  }

  private seedData() {
    const samplePlots: Plot[] = [
      {
        id: "1",
        name: "North Field",
        latitude: 45.5231,
        longitude: -122.6765,
        area: 124,
        bambooType: "Moso Bamboo",
        status: "active",
        notes: "Optimal growing conditions. Consider implementing drip irrigation system for improved water management.",
        createdAt: "2024-09-10T10:00:00Z",
        updatedAt: "2024-09-15T14:30:00Z",
      },
      {
        id: "2", 
        name: "South Grove",
        latitude: 45.5189,
        longitude: -122.6742,
        area: 89,
        bambooType: "Giant Timber Bamboo",
        status: "active",
        notes: "Good drainage, monitor for pest activity during spring months.",
        createdAt: "2024-09-08T09:15:00Z",
        updatedAt: "2024-09-12T11:45:00Z",
      },
      {
        id: "3",
        name: "East Section",
        latitude: 45.5298,
        longitude: -122.6698,
        area: 156,
        bambooType: "Black Bamboo",
        status: "planning",
        notes: "Soil preparation in progress. Planning spring planting.",
        createdAt: "2024-09-05T16:20:00Z",
        updatedAt: "2024-09-10T08:30:00Z",
      },
    ];

    samplePlots.forEach(plot => {
      this.plots.set(plot.id, plot);
    });
  }

  async getPlot(id: string): Promise<Plot | undefined> {
    return this.plots.get(id);
  }

  async getAllPlots(): Promise<Plot[]> {
    return Array.from(this.plots.values());
  }

  async createPlot(insertPlot: InsertPlot): Promise<Plot> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const plot: Plot = {
      ...insertPlot,
      id,
      notes: insertPlot.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.plots.set(id, plot);
    return plot;
  }

  async updatePlot(id: string, plotUpdate: Partial<InsertPlot>): Promise<Plot | undefined> {
    const existingPlot = this.plots.get(id);
    if (!existingPlot) {
      return undefined;
    }

    const updatedPlot: Plot = {
      ...existingPlot,
      ...plotUpdate,
      updatedAt: new Date().toISOString(),
    };
    
    this.plots.set(id, updatedPlot);
    return updatedPlot;
  }

  async deletePlot(id: string): Promise<boolean> {
    return this.plots.delete(id);
  }

}

export const storage = new MemStorage();
