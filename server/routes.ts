import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlotSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all plots
  app.get("/api/plots", async (req, res) => {
    try {
      const plots = await storage.getAllPlots();
      res.json(plots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plots" });
    }
  });

  // Get single plot
  app.get("/api/plots/:id", async (req, res) => {
    try {
      const plot = await storage.getPlot(req.params.id);
      if (!plot) {
        return res.status(404).json({ message: "Plot not found" });
      }
      res.json(plot);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plot" });
    }
  });

  // Create new plot
  app.post("/api/plots", async (req, res) => {
    try {
      const validatedData = insertPlotSchema.parse(req.body);
      const plot = await storage.createPlot(validatedData);
      res.status(201).json(plot);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid plot data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create plot" });
    }
  });

  // Update plot
  app.patch("/api/plots/:id", async (req, res) => {
    try {
      const validatedData = insertPlotSchema.partial().parse(req.body);
      const plot = await storage.updatePlot(req.params.id, validatedData);
      if (!plot) {
        return res.status(404).json({ message: "Plot not found" });
      }
      res.json(plot);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid plot data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update plot" });
    }
  });

  // Delete plot
  app.delete("/api/plots/:id", async (req, res) => {
    try {
      const success = await storage.deletePlot(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Plot not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete plot" });
    }
  });

  // Admin endpoint to flush all plots
  app.delete("/api/admin/plots", async (req, res) => {
    try {
      await storage.flushAllPlots();
      res.json({ message: "All plots have been deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to flush plots" });
    }
  });

  // Get Cesium key for frontend
  app.get("/api/cesium-key", async (req, res) => {
    try {
      const cesiumKey = process.env.CESIUM_KEY;
      res.json({ cesiumKey: cesiumKey || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to get Cesium key" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
