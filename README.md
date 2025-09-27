# TERRATWIN V0.1
Sep 26 2025

This is a rough cut prototype of a civic model of a bamboo agroforestry management app.

Farmers throughout asia harvest the giant bamboo species 'Dendrocalamus asper', also called "Petung" or "Dragon bamboo". Harvesting giant bamboo, particularly the clump-forming Dendrocalamus giganteus, is challenging because the culms are entangled at the top, making it a high labor cost process. There are also many other considerations such as elevation, slope, soil conditions, pests and choices around interventions.

While there are many academic models and simulations, the goal here is to provide 'civic models' that a farmer might actually use themselves - both as a predictive tool but also as a communication tool for sponsorship and support.

This demo leverages https://orbital.foundation to implement a simulation core that models the behavior of bamboo plots over time and visualize up to one hectare at a time. Cesium provides pretty globe data (which we render with the Nasa Tile Renderer). Elevation data and satellite data for the DEM is provided from a variety of places (see source code).

## Running

A few exports should be set prior to running, Neondb supports public psql urls, and so does replit (which uses Neon) - you can point to the replit database url and then develop locally while still using the replit database.

export DATABASE_URL="pgsql://..."
export CESIUM_KEY="..."

npm install
npm run dev

