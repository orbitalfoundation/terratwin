import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlotSchema } from "@shared/schema";
import { generateChatResponse } from "./openai-service";
import { HttpError } from "./http-error";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Text-to-speech endpoint
  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: "alloy",
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      });
      
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ message: "Failed to generate speech" });
    }
  });

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

  // Update plot (support both PATCH and PUT)
  const updatePlotHandler = async (req: any, res: any) => {
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
  };

  app.patch("/api/plots/:id", updatePlotHandler);
  app.put("/api/plots/:id", updatePlotHandler);

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

  // Debug logging endpoint
  app.post("/api/debug-log", async (req, res) => {
    const { event, data } = req.body;
    const timestamp = new Date().toISOString();
    console.log(`🐛 CLIENT DEBUG [${timestamp}]: ${event}`, data || '');
    return res.json({ logged: true });
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

  // Chat endpoint for AI assistant
  const chatRequestSchema = z.object({
    message: z.string().min(1).max(1000),
    context: z.object({
      currentPage: z.string(),
      currentPlotId: z.string().optional(),
      availablePlots: z.array(z.object({
        id: z.string(),
        name: z.string(),
        status: z.string()
      }))
    }).optional()
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context } = chatRequestSchema.parse(req.body);
      const agenticResponse = await generateChatResponse(message, context);
      res.json(agenticResponse);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid message format", errors: error.errors });
      }
      
      // Handle HttpError with proper status codes
      if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
      }
      
      console.error('Chat API error:', error);
      res.status(500).json({ message: "AI service is temporarily unavailable. Please try again." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
