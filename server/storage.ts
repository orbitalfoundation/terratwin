import { type Plot, type InsertPlot, plots } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getPlot(id: string): Promise<Plot | undefined>;
  getAllPlots(): Promise<Plot[]>;
  createPlot(plot: InsertPlot): Promise<Plot>;
  updatePlot(id: string, plot: Partial<InsertPlot>): Promise<Plot | undefined>;
  deletePlot(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getPlot(id: string): Promise<Plot | undefined> {
    const [plot] = await db.select().from(plots).where(eq(plots.id, id));
    return plot || undefined;
  }

  async getAllPlots(): Promise<Plot[]> {
    const allPlots = await db.select().from(plots);
    return allPlots;
  }

  async createPlot(insertPlot: InsertPlot): Promise<Plot> {
    const [plot] = await db
      .insert(plots)
      .values(insertPlot)
      .returning();
    return plot;
  }

  async updatePlot(id: string, plotUpdate: Partial<InsertPlot>): Promise<Plot | undefined> {
    const [plot] = await db
      .update(plots)
      .set(plotUpdate)
      .where(eq(plots.id, id))
      .returning();
    return plot || undefined;
  }

  async deletePlot(id: string): Promise<boolean> {
    const result = await db.delete(plots).where(eq(plots.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
