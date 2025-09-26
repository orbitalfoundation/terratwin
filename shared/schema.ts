import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const plots = pgTable("plots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  area: real("area").notNull(), // in square meters
  bambooType: text("bamboo_type").notNull(),
  status: text("status").notNull().default("planning"), // planning, active, inactive
  notes: text("notes"),
  polygonOutline: json("polygon_outline"), // Array of [x, y, z] world coordinate triplets
  // Species & Schedule
  speciesDensity: text("species_density").default("low"), // low, medium, high
  harvestYears: integer("harvest_years").default(5),
  harvestRate: integer("harvest_rate").default(20), // percentage
  // Plot Environment
  elevation: real("elevation").default(0),
  slopeFacing: real("slope_facing").default(0), // degrees
  steepness: real("steepness").default(0), // percentage
  rainfall: real("rainfall").default(0), // mm/yr
  drainage: real("drainage").default(5000), // m³/yr
  // Soil Conditions
  soilSalts: real("soil_salts").default(50), // 0-100
  soilNitrogen: real("soil_nitrogen").default(50), // 0-100
  soilMicrobialMass: real("soil_microbial_mass").default(50), // 0-100
  soilEarthworms: real("soil_earthworms").default(50), // 0-100
  soilAcidity: real("soil_acidity").default(7.0), // pH 0-14
  soilFertility: real("soil_fertility").default(50), // 0-100
  // Pests
  pestBambooBorer: text("pest_bamboo_borer").default("false"), // boolean as text
  pestAphids: text("pest_aphids").default("false"), // boolean as text
  pestFungalPathogens: text("pest_fungal_pathogens").default("false"), // boolean as text
  // Intervention
  interventionWeeding: text("intervention_weeding").default("false"), // boolean as text
  interventionMulching: text("intervention_mulching").default("false"), // boolean as text
  interventionFertilization: text("intervention_fertilization").default("false"), // boolean as text
  interventionPestControl: text("intervention_pest_control").default("false"), // boolean as text
  // Intercropping
  intercroppingLegumes: text("intercropping_legumes").default("false"), // boolean as text
  intercroppingHerbs: text("intercropping_herbs").default("false"), // boolean as text
  intercroppingSpecialtyCrops: text("intercropping_specialty_crops").default("false"), // boolean as text
  intercroppingAnimals: text("intercropping_animals").default("false"), // boolean as text
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertPlotSchema = createInsertSchema(plots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  area: z.number().positive(),
  status: z.enum(["planning", "active", "inactive"]).default("planning"),
  polygonOutline: z.array(z.tuple([
    z.number(), // x world coordinate
    z.number(), // y world coordinate  
    z.number()  // z world coordinate
  ])).optional(),
  // Species & Schedule
  speciesDensity: z.enum(["low", "medium", "high"]).optional(),
  harvestYears: z.number().int().min(1).max(20).optional(),
  harvestRate: z.number().int().min(0).max(100).optional(),
  // Plot Environment
  elevation: z.number().optional(),
  slopeFacing: z.number().min(0).max(360).optional(),
  steepness: z.number().min(0).max(100).optional(),
  rainfall: z.number().min(0).optional(),
  drainage: z.number().min(0).optional(),
  // Soil Conditions
  soilSalts: z.number().min(0).max(100).optional(),
  soilNitrogen: z.number().min(0).max(100).optional(),
  soilMicrobialMass: z.number().min(0).max(100).optional(),
  soilEarthworms: z.number().min(0).max(100).optional(),
  soilAcidity: z.number().min(0).max(14).optional(),
  soilFertility: z.number().min(0).max(100).optional(),
  // Pests (stored as text, converted to/from boolean)
  pestBambooBorer: z.string().optional(),
  pestAphids: z.string().optional(),
  pestFungalPathogens: z.string().optional(),
  // Intervention (stored as text, converted to/from boolean)
  interventionWeeding: z.string().optional(),
  interventionMulching: z.string().optional(),
  interventionFertilization: z.string().optional(),
  interventionPestControl: z.string().optional(),
  // Intercropping (stored as text, converted to/from boolean)
  intercroppingLegumes: z.string().optional(),
  intercroppingHerbs: z.string().optional(),
  intercroppingSpecialtyCrops: z.string().optional(),
  intercroppingAnimals: z.string().optional(),
});

export type InsertPlot = z.infer<typeof insertPlotSchema>;
export type Plot = typeof plots.$inferSelect;
