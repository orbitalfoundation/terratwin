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
  polygonOutline: json("polygon_outline"), // Array of [longitude, latitude, elevation] triplets
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
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
    z.number()                     // elevation
  ])).optional(),
});

export type InsertPlot = z.infer<typeof insertPlotSchema>;
export type Plot = typeof plots.$inferSelect;
